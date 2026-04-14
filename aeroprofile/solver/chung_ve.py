"""Robert Chung's Virtual Elevation method as a (CdA, Crr) estimator.

The idea: given a power trace and GPS altitude, reconstruct an altitude trace
from the energy balance using candidate (CdA, Crr). The pair that minimises
the RMS between reconstructed and measured altitude IS the correct (CdA, Crr).

Why it's better than per-point power residuals on mountain / noisy rides:
- It integrates the energy balance over time, so 1 s of power-meter or
  altimeter noise averages out rather than adding a squared residual.
- It naturally enforces closure: on an out-and-back the endpoints MUST match
  in altitude, which gives a strong constraint on (CdA, Crr).
- It is robust to braking / coasting points because those only add to
  kinetic-energy changes (already modelled).

Reference: Robert Chung, "Estimating CdA with a power meter." The method is
the basis of Golden Cheetah's CdA tool and the ER / BestBikeSplit workflow.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares

from aeroprofile.physics.constants import G, ETA_DEFAULT


@dataclass
class ChungResult:
    cda: float
    crr: float
    cda_ci: tuple[float, float]
    crr_ci: tuple[float, float]
    r_squared_elev: float  # R² between virtual and real elevation
    residuals: np.ndarray
    n_points: int
    prior_adaptive_factor: float = 1.0
    cda_raw: float | None = None
    cda_raw_ci: tuple[float, float] | None = None


def _virtual_elevation_vec(
    V, V_air, rho, P, dt, CdA, Crr, mass, eta,
    block_starts: np.ndarray | None = None,
) -> np.ndarray:
    """Vectorised virtual-elevation integration.

    Returns the cumulative altitude change predicted by the energy balance.
    Starting altitude is assumed zero; compare to (alt_real - alt_real[0]).

    ``block_starts`` is a boolean array marking the first sample of each
    contiguous block after filtering. At block starts, the kinetic-energy
    delta is reset (we cannot trust v_prev across a gap).
    """
    E_in = P * eta * dt
    E_aero = 0.5 * CdA * rho * np.sign(V_air) * V_air * V_air * V * dt
    E_roll = Crr * mass * G * V * dt
    v_prev = np.concatenate(([V[0]], V[:-1]))
    E_kin = 0.5 * mass * (V * V - v_prev * v_prev)
    if block_starts is not None:
        E_kin = np.where(block_starts, 0.0, E_kin)
    E_pot = E_in - E_aero - E_roll - E_kin
    dh = E_pot / (mass * G)
    dh[0] = 0.0
    return np.cumsum(dh)


def _residuals_ve(params, V, V_air, rho, P, dt, alt_real, mass, eta,
                  block_starts, crr_prior_mean, crr_prior_sigma,
                  cda_prior_mean=None, cda_prior_sigma=None,
                  adaptive_factor: float = 1.0):
    """Stack of residuals for least_squares.

    Primary: alt_virtual minus the real altitude change, per BLOCK (we reset
    both the virtual integration and the target to zero at every block
    boundary so cross-gap drift is not penalised).
    Secondary (optional): Gaussian prior on Crr.
    """
    CdA, Crr = params
    ve = _virtual_elevation_vec(V, V_air, rho, P, dt, CdA, Crr, mass, eta, block_starts)
    # Zero-out target at each block start so both traces restart from zero.
    target = alt_real - alt_real[0]
    if block_starts is not None:
        # Subtract the target baseline at each block start, running per-block
        baseline = np.zeros_like(target)
        baseline[0] = target[0]
        for i in range(1, len(target)):
            baseline[i] = target[i - 1] if block_starts[i] else baseline[i - 1]
        target_adj = target - baseline
        ve_adj = ve - np.where(block_starts, ve, 0).cumsum() * 0  # placeholder
        # Simpler: align per-block by subtracting running block start values
        ve_start = np.zeros_like(ve)
        ve_start[0] = ve[0]
        for i in range(1, len(ve)):
            ve_start[i] = ve[i - 1] if block_starts[i] else ve_start[i - 1]
        res = (ve - ve_start) - target_adj
    else:
        res = ve - target
    n = len(res)
    # Prior weight is INDEPENDENT of the residual (Gelman BDA3 ch.14).
    # See wind_inverse.py for the full explanation.
    # adaptive_factor scales only the CdA prior (0 = MLE, >1 = renforcé).
    prior_weight_base = 0.3 * np.sqrt(n)
    prior_weight_cda = prior_weight_base * adaptive_factor
    extras = []
    if crr_prior_mean is not None and crr_prior_sigma is not None:
        extras.append(prior_weight_base * (Crr - crr_prior_mean) / crr_prior_sigma)
    if (cda_prior_mean is not None and cda_prior_sigma is not None
            and cda_prior_sigma > 0 and adaptive_factor > 0):
        extras.append(prior_weight_cda * (CdA - cda_prior_mean) / cda_prior_sigma)
    if extras:
        return np.concatenate([res, np.array(extras)])
    return res


def _solve_chung_ve_inner(
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    crr_prior_mean: float | None = 0.0035,
    crr_prior_sigma: float | None = 0.0012,
    cda_prior_mean: float | None = 0.30,
    cda_prior_sigma: float | None = 0.12,
    cda_lower: float = 0.15,
    cda_upper: float = 0.60,
    adaptive_factor: float = 1.0,
) -> ChungResult:
    """Estimate (CdA, Crr) by minimising altitude-reconstruction error.

    Arguments
    ---------
    df: DataFrame that must contain columns v_ground, v_air, rho, power,
        dt, altitude_smooth, filter_valid.
    mass: total rider + bike mass (kg).
    eta: drivetrain efficiency.
    crr_fixed: if provided, Crr is held constant and only CdA is solved.
    crr_prior_mean, crr_prior_sigma: weak Gaussian prior on Crr (set to
        None to disable). Default ≈ asphalt road pneus tubeless.
    """
    valid = df[df["filter_valid"]].reset_index(drop=True)
    if len(valid) < 60:
        raise ValueError(
            f"Trop peu de points valides ({len(valid)}) pour la méthode Chung "
            "(≥ 60 requis)."
        )

    V = np.asarray(valid["v_ground"].to_numpy(), dtype=float)
    V_air = np.asarray(valid["v_air"].to_numpy(), dtype=float)
    rho = np.asarray(valid["rho"].to_numpy(), dtype=float)
    P = np.asarray(valid["power"].to_numpy(), dtype=float)
    dt = np.asarray(valid["dt"].to_numpy(), dtype=float)
    alt_real = np.asarray(valid["altitude_smooth"].to_numpy(), dtype=float)

    # Detect block starts: the original row index in df is not contiguous after
    # filtering. A "new block" begins when the original index jumps.
    orig_idx = np.asarray(valid.index.to_numpy() if hasattr(valid, "index") else np.arange(len(valid)), dtype=int)
    # Because we reset_index(drop=True) above, we need the original index.
    # Reconstruct from df["filter_valid"] instead.
    if "dt" in df.columns:
        # Use jumps in timestamp delta as block boundary proxy: if dt > 3s, block.
        block_starts = np.zeros(len(V), dtype=bool)
        block_starts[0] = True
        block_starts[1:] = dt[1:] > 3.0
    else:
        block_starts = np.zeros(len(V), dtype=bool)
        block_starts[0] = True

    if crr_fixed is not None:
        def res1(x):
            return _residuals_ve(
                (x[0], crr_fixed), V, V_air, rho, P, dt, alt_real, mass, eta,
                block_starts, None, None,
                cda_prior_mean, cda_prior_sigma,
                adaptive_factor=adaptive_factor,
            )
        mid = (cda_lower + cda_upper) / 2
        starts = [(cda_lower + 0.02,), (mid,), (cda_upper - 0.02,)]
        best = None
        for x0 in starts:
            r = least_squares(res1, x0=x0, bounds=([cda_lower], [cda_upper]), method="trf")
            if best is None or r.cost < best.cost:
                best = r
        cda = float(best.x[0])
        n, p_ = len(best.fun), 1
        s2 = 2.0 * best.cost / max(n - p_, 1)
        try:
            cov = s2 * np.linalg.inv(best.jac.T @ best.jac)
            se = float(np.sqrt(max(cov[0, 0], 0.0)))
        except np.linalg.LinAlgError:
            se = float("nan")
        cda_ci = (cda - 1.96 * se, cda + 1.96 * se)
        crr_ci = (crr_fixed, crr_fixed)
    else:
        bounds_lower = [cda_lower, 0.0015]
        bounds_upper = [cda_upper, 0.012]
        mid = (cda_lower + cda_upper) / 2
        starts = [(cda_lower + 0.02, 0.003), (mid, 0.005), (cda_upper - 0.02, 0.007)]
        best = None
        for x0 in starts:
            def _res_free(x, af=adaptive_factor):
                return _residuals_ve(
                    x, V, V_air, rho, P, dt, alt_real, mass, eta,
                    block_starts, crr_prior_mean, crr_prior_sigma,
                    cda_prior_mean, cda_prior_sigma, adaptive_factor=af,
                )
            r = least_squares(
                _res_free,
                x0=x0,
                bounds=(bounds_lower, bounds_upper),
                method="trf",
            )
            if best is None or r.cost < best.cost:
                best = r
        cda = float(best.x[0])
        crr = float(best.x[1])
        # Drop the prior residual for the CI calculation so it reflects the data
        n_data = len(alt_real)
        fun_data = best.fun[:n_data]
        jac_data = best.jac[:n_data, :]
        n, p_ = n_data, 2
        s2 = float(np.sum(fun_data ** 2)) / max(n - p_, 1)
        try:
            cov = s2 * np.linalg.inv(jac_data.T @ jac_data)
            se = np.sqrt(np.maximum(np.diag(cov), 0.0))
            cda_ci = (cda - 1.96 * se[0], cda + 1.96 * se[0])
            crr_ci = (crr - 1.96 * se[1], crr + 1.96 * se[1])
        except np.linalg.LinAlgError:
            cda_ci = (float("nan"), float("nan"))
            crr_ci = (float("nan"), float("nan"))

    # Final residuals (data only), R² vs real altitude change
    final_crr = crr_fixed if crr_fixed is not None else crr
    ve_final = _virtual_elevation_vec(
        V, V_air, rho, P, dt, cda, final_crr, mass, eta, block_starts,
    )
    # Per-block baseline alignment
    target = alt_real - alt_real[0]
    baseline = np.zeros_like(target)
    baseline[0] = target[0]
    for i in range(1, len(target)):
        baseline[i] = target[i - 1] if block_starts[i] else baseline[i - 1]
    ve_start = np.zeros_like(ve_final)
    ve_start[0] = ve_final[0]
    for i in range(1, len(ve_final)):
        ve_start[i] = ve_final[i - 1] if block_starts[i] else ve_start[i - 1]
    res_data = (ve_final - ve_start) - (target - baseline)
    ss_res = float(np.sum(res_data ** 2))
    ss_tot = float(np.sum((target - target.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return ChungResult(
        cda=cda,
        crr=crr_fixed if crr_fixed is not None else crr,
        cda_ci=cda_ci,
        crr_ci=crr_ci,
        r_squared_elev=r2,
        residuals=res_data,
        n_points=len(valid),
    )


def solve_chung_ve(
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    crr_prior_mean: float | None = 0.0035,
    crr_prior_sigma: float | None = 0.0012,
    cda_prior_mean: float | None = 0.30,
    cda_prior_sigma: float | None = 0.12,
    cda_lower: float = 0.15,
    cda_upper: float = 0.60,
) -> ChungResult:
    """Wrapper: two-pass adaptive prior + optional MLE pass for ``cda_raw``.

    1. Pass 0 (if prior active): MLE (adaptive_factor = 0) → ``cda_raw``.
    2. Pass 1: default prior weight (adaptive_factor = 1).
    3. Pass 2 (if sigma_Hess / sigma_prior > 1): prior renforcé.
    """
    kwargs = dict(
        mass=mass, eta=eta, crr_fixed=crr_fixed,
        crr_prior_mean=crr_prior_mean, crr_prior_sigma=crr_prior_sigma,
        cda_prior_mean=cda_prior_mean, cda_prior_sigma=cda_prior_sigma,
        cda_lower=cda_lower, cda_upper=cda_upper,
    )
    prior_active = cda_prior_sigma is not None and cda_prior_sigma > 0

    # Pass 0: MLE pur
    raw_cda = None
    raw_ci = None
    if prior_active:
        try:
            raw = _solve_chung_ve_inner(df, adaptive_factor=0.0, **kwargs)
            raw_cda = float(raw.cda)
            raw_ci = raw.cda_ci
        except Exception:
            pass

    # Pass 1: poids de base
    result = _solve_chung_ve_inner(df, adaptive_factor=1.0, **kwargs)
    adaptive_factor = 1.0

    # Pass 2: adaptatif
    if prior_active:
        sigma_hess = (result.cda_ci[1] - result.cda_ci[0]) / 3.92
        if not np.isnan(sigma_hess) and sigma_hess > 0 and cda_prior_sigma > 0:
            ratio = float(sigma_hess / cda_prior_sigma)
            if ratio > 1.0:
                try:
                    result2 = _solve_chung_ve_inner(df, adaptive_factor=ratio, **kwargs)
                    result = result2
                    adaptive_factor = ratio
                except Exception:
                    pass

    result.prior_adaptive_factor = float(adaptive_factor)
    result.cda_raw = raw_cda
    result.cda_raw_ci = raw_ci
    return result
