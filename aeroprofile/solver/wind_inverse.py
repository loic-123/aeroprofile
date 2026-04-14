"""Joint estimation of (CdA, Crr, wind) via Chung Virtual Elevation.

When the rider's heading varies enough (loops, zig-zags, out-and-back),
the wind can be estimated as a free parameter rather than taken from the
weather API. This removes the dominant error source (Open-Meteo grid-cell
wind != actual wind at the rider).

The wind is modelled as a constant vector per time segment (default 30 min),
giving 2 extra parameters per segment. With Open-Meteo wind as a Gaussian
prior on each segment, the system is regularised even if the rider goes
straight for 30 min in one segment.

Unlike the original Martin-LS version, this solver uses the Chung Virtual
Elevation objective (minimise altitude reconstruction error). The VE
objective integrates the energy balance so 1 Hz noise averages out, giving
much more stable wind estimation.

Reference: AeroStar "wind solve" mode; Lim, Homan & Dalbert (2011).
"""

from __future__ import annotations

import logging

import numpy as np
from scipy.optimize import least_squares

from aeroprofile.physics.constants import G, ETA_DEFAULT
from aeroprofile.physics.wind import compute_v_air, cda_yaw_correction

logger = logging.getLogger(__name__)


def _heading_variance(bearing_deg: np.ndarray) -> float:
    br = np.radians(bearing_deg)
    R = np.sqrt(np.cos(br).mean() ** 2 + np.sin(br).mean() ** 2)
    return float(1.0 - R)


def _virtual_elevation_vec(V, V_air, rho, P, dt, CdA, Crr, mass, eta,
                           block_starts, cda_yaw_factor=None):
    CdA_eff = CdA * cda_yaw_factor if cda_yaw_factor is not None else CdA
    E_in = P * eta * dt
    E_aero = 0.5 * CdA_eff * rho * np.sign(V_air) * V_air * V_air * V * dt
    E_roll = Crr * mass * G * V * dt
    v_prev = np.concatenate(([V[0]], V[:-1]))
    E_kin = 0.5 * mass * (V * V - v_prev * v_prev)
    if block_starts is not None:
        E_kin = np.where(block_starts, 0.0, E_kin)
    E_pot = E_in - E_aero - E_roll - E_kin
    dh = E_pot / (mass * G)
    dh[0] = 0.0
    return np.cumsum(dh)


def _solve_with_wind_inner(
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    segment_minutes: float = 30.0,
    min_heading_variance: float = 0.25,
    wind_prior_sigma_ms: float = 2.0,
    crr_prior_mean: float = 0.0035,
    crr_prior_sigma: float = 0.0012,
    cda_prior_mean: float = 0.30,
    cda_prior_sigma: float = 0.12,
    cda_lower: float = 0.15,
    cda_upper: float = 0.60,
    adaptive_factor: float = 1.0,
):
    """Inner solver. ``adaptive_factor`` scales the prior weight (0 = MLE only,
    1 = default, >1 = prior renforcé). Used by ``solve_with_wind`` two-pass.
    """
    valid = df[df["filter_valid"]].reset_index(drop=True)
    n = len(valid)
    if n < 100:
        return None

    bearing = np.asarray(valid["bearing"].to_numpy(), dtype=float)
    hv = _heading_variance(bearing)
    if hv < min_heading_variance:
        return None

    V = np.asarray(valid["v_ground"].to_numpy(), dtype=float)
    rho = np.asarray(valid["rho"].to_numpy(), dtype=float)
    P = np.asarray(valid["power"].to_numpy(), dtype=float)
    dt = np.asarray(valid["dt"].to_numpy(), dtype=float)
    alt_real = np.asarray(valid["altitude_smooth"].to_numpy(), dtype=float)

    # Block starts for VE integration reset
    block_starts = np.zeros(n, dtype=bool)
    block_starts[0] = True
    block_starts[1:] = dt[1:] > 3.0

    # Open-Meteo wind as u/v priors per sample
    ws_api = np.asarray(valid["wind_speed_ms"].to_numpy(), dtype=float)
    wd_api = np.asarray(valid["wind_dir_deg"].to_numpy(), dtype=float)
    u_api = -ws_api * np.sin(np.radians(wd_api))
    v_api = -ws_api * np.cos(np.radians(wd_api))

    # Segment assignment
    ts = valid["timestamp"].astype("int64").to_numpy() // 1_000_000_000
    seg_dur = segment_minutes * 60.0
    t0 = ts[0]
    seg_idx = ((ts - t0) / seg_dur).astype(int)
    n_seg = int(seg_idx.max()) + 1

    # Prior centres per segment (guard against empty segments from gaps)
    u_prior = np.zeros(n_seg)
    v_prior = np.zeros(n_seg)
    for s in range(n_seg):
        mask = seg_idx == s
        if mask.any():
            u_prior[s] = u_api[mask].mean()
            v_prior[s] = v_api[mask].mean()
        else:
            u_prior[s] = u_api.mean()
            v_prior[s] = v_api.mean()

    # Parameter layout: [CdA, (Crr), u_0, v_0, ..., u_{n_seg-1}, v_{n_seg-1}]
    has_crr = crr_fixed is None

    def _unpack(x):
        idx = 1
        cda = x[0]
        if has_crr:
            crr = x[1]
            idx = 2
        else:
            crr = crr_fixed
        wind_uv = x[idx:].reshape(n_seg, 2)
        return cda, crr, wind_uv

    def _wind_from_uv(wind_uv):
        """Return (v_air, yaw_factor) from per-segment wind u/v."""
        u_pts = np.empty(n)
        v_pts = np.empty(n)
        for s in range(n_seg):
            mask = seg_idx == s
            u_pts[mask] = wind_uv[s, 0]
            v_pts[mask] = wind_uv[s, 1]
        ws = np.sqrt(u_pts ** 2 + v_pts ** 2)
        wd = (np.degrees(np.arctan2(-u_pts, -v_pts)) + 360.0) % 360.0
        v_air = compute_v_air(V, bearing, ws, wd, wind_height_factor=1.0)
        # Yaw angle: crosswind / apparent wind
        crosswind = ws * np.sin(np.radians(wd - bearing))
        headwind = ws * np.cos(np.radians(wd - bearing))
        v_along = V + headwind
        yaw_deg = np.degrees(np.arctan2(np.abs(crosswind), np.abs(v_along)))
        yaw_deg = np.clip(yaw_deg, 0.0, 90.0)
        yaw_fac = cda_yaw_correction(yaw_deg)
        return v_air, yaw_fac

    def _block_aligned_residuals(ve, target, block_starts):
        """Per-block baseline alignment so cross-gap drift isn't penalised."""
        baseline = np.zeros_like(target)
        baseline[0] = target[0]
        ve_start = np.zeros_like(ve)
        ve_start[0] = ve[0]
        for i in range(1, len(target)):
            if block_starts[i]:
                baseline[i] = target[i - 1]
                ve_start[i] = ve[i - 1]
            else:
                baseline[i] = baseline[i - 1]
                ve_start[i] = ve_start[i - 1]
        return (ve - ve_start) - (target - baseline)

    def residuals(x):
        cda, crr, wind_uv = _unpack(x)
        v_air, yaw_fac = _wind_from_uv(wind_uv)
        ve = _virtual_elevation_vec(V, v_air, rho, P, dt, cda, crr, mass, eta,
                                    block_starts, cda_yaw_factor=yaw_fac)
        target = alt_real - alt_real[0]
        res_alt = _block_aligned_residuals(ve, target, block_starts)

        # Priors
        # NOTE: prior weight is INDEPENDENT of the residual (Gelman BDA3 ch.14).
        # Multiplying by RMSE was a confusion between Tikhonov regularization
        # and Bayesian prior. With noisy data, the likelihood is mechanically
        # flatter — the prior already dominates the posterior naturally,
        # without needing to scale its weight up.
        #
        # B7 documentation: the "pass 0" run (adaptive_factor=0) disables the
        # CdA prior but INTENTIONALLY keeps the wind + Crr priors active. This
        # is what we call a "conditional MLE" — CdA is freed from its prior,
        # but wind is still regularised towards Open-Meteo and Crr towards the
        # road default. Lifting wind regularisation at pass 0 makes the
        # problem under-determined (150+ wind parameters vs ~3000 residuals
        # on a typical ride) and produces random CdA values that are worse
        # than a conditional MLE. The frontend treats `cda_raw` as "CdA
        # estimate with zero CdA prior", not "unregularized MLE". Keep this
        # consistent with the tooltip in ResultsDashboard.
        extras = []
        pw_base = 0.3 * np.sqrt(n)
        pw = pw_base * adaptive_factor  # 0 = MLE, 1 = default, >1 = renforcé

        # Wind prior per segment (always at base weight — see note above)
        for s in range(n_seg):
            extras.append(pw_base * (wind_uv[s, 0] - u_prior[s]) / (wind_prior_sigma_ms * n_seg))
            extras.append(pw_base * (wind_uv[s, 1] - v_prior[s]) / (wind_prior_sigma_ms * n_seg))

        # Crr prior (always at base weight — see note above)
        if has_crr:
            extras.append(pw_base * (crr - crr_prior_mean) / crr_prior_sigma)

        # CdA prior (bike-type-aware) — uses adaptive pw. At pass 0 (af=0)
        # this term is skipped entirely; only wind + Crr priors regularise.
        if cda_prior_sigma > 0 and adaptive_factor > 0:
            extras.append(pw * (cda - cda_prior_mean) / cda_prior_sigma)

        return np.concatenate([res_alt, np.array(extras)])

    # Bounds
    x0_list = [cda_prior_mean]
    lb_list = [cda_lower]
    ub_list = [cda_upper]
    if has_crr:
        x0_list.append(0.004)
        lb_list.append(0.0015)
        ub_list.append(0.012)
    for s in range(n_seg):
        x0_list.extend([u_prior[s], v_prior[s]])
        lb_list.extend([-20.0, -20.0])
        ub_list.extend([20.0, 20.0])

    x0 = np.array(x0_list)
    lb = np.array(lb_list)
    ub = np.array(ub_list)

    # Multi-start on CdA — denser sweep across the bounds to avoid local minima.
    # Critical: with the wind_inverse model (many parameters), the cost surface
    # has multiple valleys and the result depends on the starting point.
    # Use 5 starts uniformly spaced across the bounds.
    cda_starts = list(np.linspace(cda_lower + 0.02, cda_upper - 0.02, 5))
    best = None
    for c0 in cda_starts:
        x0_try = x0.copy()
        x0_try[0] = c0
        try:
            r = least_squares(residuals, x0=x0_try, bounds=(lb, ub),
                              method="trf", max_nfev=800)
            if best is None or r.cost < best.cost:
                best = r
        except Exception:
            continue

    if best is None:
        return None

    cda, crr, wind_uv = _unpack(best.x)
    v_air_solved, yaw_fac_final = _wind_from_uv(wind_uv)

    # R² on altitude reconstruction
    ve_final = _virtual_elevation_vec(V, v_air_solved, rho, P, dt,
                                      cda, crr, mass, eta, block_starts,
                                      cda_yaw_factor=yaw_fac_final)
    target = alt_real - alt_real[0]
    res_alt = _block_aligned_residuals(ve_final, target, block_starts)
    ss_res = float(np.sum(res_alt ** 2))
    ss_tot = float(np.sum((target - target.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Confidence intervals from the full Laplace approximation. We include
    # ALL residuals (data + prior rows) because the posterior Hessian is
    # the sum of the data Hessian and the prior Hessian. Excluding the
    # prior rows would give the wrong uncertainty in pass 2 (B8): when
    # the prior is adaptive and dominates, the data-only curvature is
    # flatter than the posterior curvature → σ_Hess overestimated →
    # spurious pass-2 triggering / miscalibrated IC displayed to the user.
    n_total = len(best.fun)
    p_total = len(best.x)
    cda_ci = (float("nan"), float("nan"))
    crr_ci = (float("nan"), float("nan"))
    if n_total > p_total:
        try:
            s2 = 2.0 * best.cost / max(n_total - p_total, 1)
            cov = s2 * np.linalg.inv(best.jac.T @ best.jac)
            se = np.sqrt(np.maximum(np.diag(cov), 0.0))
            cda_ci = (float(cda - 1.96 * se[0]), float(cda + 1.96 * se[0]))
            if has_crr:
                crr_ci = (float(crr - 1.96 * se[1]), float(crr + 1.96 * se[1]))
        except (np.linalg.LinAlgError, ValueError):
            pass

    return {
        "cda": float(cda),
        "crr": float(crr),
        "cda_ci": cda_ci,
        "crr_ci": crr_ci,
        "r_squared": r2,
        "residuals": res_alt,
        "n_points": n,
        "wind_uv": wind_uv,
        "v_air_solved": v_air_solved,
        "heading_variance": hv,
        "n_segments": n_seg,
    }


def solve_with_wind(
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    segment_minutes: float = 30.0,
    min_heading_variance: float = 0.25,
    wind_prior_sigma_ms: float = 2.0,
    crr_prior_mean: float = 0.0035,
    crr_prior_sigma: float = 0.0012,
    cda_prior_mean: float = 0.30,
    cda_prior_sigma: float = 0.12,
    cda_lower: float = 0.15,
    cda_upper: float = 0.60,
):
    """Wrapper: two-pass adaptive prior + optional raw (MLE) pass for display.

    1. Pass 0 (only if prior active): MLE with prior weight = 0, exposes cda_raw.
    2. Pass 1: default prior weight (adaptive_factor = 1).
    3. Pass 2 (only if sigma_Hess / sigma_prior > 1): prior renforcé.

    Adds ``prior_adaptive_factor``, ``cda_raw``, ``cda_raw_ci_low/high`` to the
    returned dict.
    """
    kwargs = dict(
        mass=mass, eta=eta, crr_fixed=crr_fixed,
        segment_minutes=segment_minutes,
        min_heading_variance=min_heading_variance,
        wind_prior_sigma_ms=wind_prior_sigma_ms,
        crr_prior_mean=crr_prior_mean, crr_prior_sigma=crr_prior_sigma,
        cda_prior_mean=cda_prior_mean, cda_prior_sigma=cda_prior_sigma,
        cda_lower=cda_lower, cda_upper=cda_upper,
    )
    prior_active = cda_prior_sigma is not None and cda_prior_sigma > 0
    logger.info(
        "wind_inverse start: prior(mean=%.3f sigma=%.3f active=%s) bounds=[%.2f,%.2f]",
        cda_prior_mean, cda_prior_sigma, prior_active, cda_lower, cda_upper,
    )

    # Pass 0: MLE pur (sans prior) pour affichage "CdA brut"
    raw_cda = None
    raw_ci = (float("nan"), float("nan"))
    if prior_active:
        try:
            raw = _solve_with_wind_inner(df, adaptive_factor=0.0, **kwargs)
            if raw is not None:
                raw_cda = float(raw["cda"])
                raw_ci = raw["cda_ci"]
                _raw_sigma = (raw_ci[1] - raw_ci[0]) / 3.92 if not np.isnan(raw_ci[0]) else float("nan")
                logger.info("  pass0 MLE: CdA=%.3f σ=%.3f Crr=%.5f R²=%.3f",
                            raw_cda, _raw_sigma, raw.get("crr", 0.0), raw.get("r_squared", 0.0))
            else:
                logger.info("  pass0 MLE: returned None")
        except Exception as e:
            logger.warning("  pass0 MLE failed: %s", e)

    # Pass 1: poids prior de base
    result = _solve_with_wind_inner(df, adaptive_factor=1.0, **kwargs)
    if result is None:
        logger.info("  pass1 base: returned None (solver aborted)")
        return None
    _p1_sigma = (result["cda_ci"][1] - result["cda_ci"][0]) / 3.92 if not np.isnan(result["cda_ci"][0]) else float("nan")
    logger.info("  pass1 base: CdA=%.3f σ=%.3f Crr=%.5f R²=%.3f",
                result["cda"], _p1_sigma, result["crr"], result["r_squared"])

    adaptive_factor = 1.0

    # Pass 2: adaptatif si données peu informatives
    if prior_active:
        sigma_hess = (result["cda_ci"][1] - result["cda_ci"][0]) / 3.92
        if np.isnan(sigma_hess) or sigma_hess <= 0:
            logger.info("  pass2 skipped: σ_Hess=NaN (Hessian degenerate — solver likely at bound)")
        elif cda_prior_sigma <= 0:
            logger.info("  pass2 skipped: prior sigma = 0")
        else:
            ratio_raw = float(sigma_hess / cda_prior_sigma)
            # Cap the adaptive prior weight. Beyond 3× the base prior, the
            # ride is effectively non-identifiable and must be flagged as
            # such by the quality gate — not "rescued" by a prior that
            # crushes the data.
            ratio = min(ratio_raw, 3.0)
            if ratio <= 1.0:
                logger.info("  pass2 skipped: ratio=%.2f ≤ 1 (data informative enough)", ratio)
            else:
                if ratio_raw > 3.0:
                    logger.info("  pass2 running: ratio=%.2f (capped from %.2f; σ_Hess=%.3f vs σ_prior=%.3f)",
                                ratio, ratio_raw, sigma_hess, cda_prior_sigma)
                else:
                    logger.info("  pass2 running: ratio=%.2f (σ_Hess=%.3f vs σ_prior=%.3f)",
                                ratio, sigma_hess, cda_prior_sigma)
                result2 = _solve_with_wind_inner(df, adaptive_factor=ratio, **kwargs)
                if result2 is not None:
                    _p2_sigma = (result2["cda_ci"][1] - result2["cda_ci"][0]) / 3.92 if not np.isnan(result2["cda_ci"][0]) else float("nan")
                    logger.info("  pass2 done: CdA=%.3f σ=%.3f Crr=%.5f R²=%.3f",
                                result2["cda"], _p2_sigma, result2["crr"], result2["r_squared"])
                    result = result2
                    adaptive_factor = ratio
                else:
                    logger.warning("  pass2 returned None — keeping pass1")

    result["prior_adaptive_factor"] = float(adaptive_factor)
    if raw_cda is not None:
        result["cda_raw"] = raw_cda
        result["cda_raw_ci_low"] = float(raw_ci[0]) if not np.isnan(raw_ci[0]) else None
        result["cda_raw_ci_high"] = float(raw_ci[1]) if not np.isnan(raw_ci[1]) else None
    else:
        result["cda_raw"] = None
        result["cda_raw_ci_low"] = None
        result["cda_raw_ci_high"] = None
    return result
