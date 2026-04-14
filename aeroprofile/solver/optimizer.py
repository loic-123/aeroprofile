"""Least-squares solver for (CdA, Crr) with multi-start and confidence intervals."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares

from aeroprofile.physics.power_model import residual_power
from aeroprofile.physics.constants import ETA_DEFAULT


@dataclass
class SolverResult:
    cda: float
    crr: float
    cda_ci: tuple[float, float]
    crr_ci: tuple[float, float]
    r_squared: float
    residuals: np.ndarray
    n_points: int
    crr_was_fixed: bool = False
    prior_adaptive_factor: float = 1.0
    cda_raw: float | None = None
    cda_raw_ci: tuple[float, float] | None = None


def _confidence_intervals(result):
    """95% CI from Jacobian at optimum."""
    J = result.jac
    n = len(result.fun)
    p = len(result.x)
    if n <= p:
        return (np.nan, np.nan), (np.nan, np.nan)
    # cost = 0.5 * sum(fun²)
    s2 = 2.0 * result.cost / (n - p)
    try:
        cov = s2 * np.linalg.inv(J.T @ J)
        se = np.sqrt(np.maximum(np.diag(cov), 0.0))
    except np.linalg.LinAlgError:
        return (np.nan, np.nan), (np.nan, np.nan)
    return (
        (result.x[0] - 1.96 * se[0], result.x[0] + 1.96 * se[0]),
        (result.x[1] - 1.96 * se[1], result.x[1] + 1.96 * se[1]),
    )


def _r_squared(residuals, p_measured) -> float:
    p = np.asarray(p_measured, dtype=float)
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((p - p.mean()) ** 2))
    if ss_tot <= 0:
        return 0.0
    return 1.0 - ss_res / ss_tot


def check_speed_variety(v_ground: np.ndarray) -> tuple[bool, str]:
    """Return (insufficient, message). If speed std < 1.5 m/s → warn."""
    std = float(np.std(v_ground))
    if std < 1.5:
        return True, (
            "Variété de vitesse insuffisante pour séparer CdA et Crr. "
            "Crr sera fixé à 0.005 (valeur par défaut route). "
            "Pour résoudre les deux, faites une sortie avec montées ET plat rapide."
        )
    return False, ""


def _solve_cda_crr_inner(
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
) -> SolverResult:
    """Solve CdA and Crr (or CdA only with fixed Crr) via multi-start TRF.

    Two weak Gaussian priors keep the estimates physically plausible when
    the data are insufficient (short rides, drafting, heavy wind error):

    - Crr ~ N(0.004, 0.0015²): road-tyre asphalt reference.
    - CdA ~ N(0.30, 0.12²): intentionally very wide so the prior is only
      a soft stabiliser (stops the solver from hitting the 0.15 or 0.60
      bound when the problem is ill-conditioned). On a well-fit ride its
      effect is < 0.01 m² on CdA.

    Pass prior_mean=None to disable either prior.
    """
    valid = df[df["filter_valid"]].reset_index(drop=True)
    if len(valid) < 20:
        raise ValueError(
            f"Trop peu de points valides ({len(valid)}) après filtrage "
            "pour résoudre CdA/Crr."
        )

    V_ground = valid["v_ground"].to_numpy()
    V_air = valid["v_air"].to_numpy()
    gradient = valid["gradient"].to_numpy()
    accel = valid["acceleration"].to_numpy()
    rho = valid["rho"].to_numpy()
    P = valid["power"].to_numpy()
    yaw_factor = valid["cda_yaw_factor"].to_numpy() if "cda_yaw_factor" in valid.columns else None
    n_data = len(P)

    use_crr_prior = (
        crr_fixed is None
        and crr_prior_mean is not None
        and crr_prior_sigma is not None
        and crr_prior_sigma > 0
    )
    use_cda_prior = (
        cda_prior_mean is not None
        and cda_prior_sigma is not None
        and cda_prior_sigma > 0
    )

    if crr_fixed is not None:
        # 1D optimisation over CdA only
        def res1(x):
            return residual_power(
                (x[0], crr_fixed), V_ground, V_air, gradient, accel, mass, rho, P, eta,
                cda_yaw_factor=yaw_factor,
            )

        mid = (cda_lower + cda_upper) / 2
        starts = [(cda_lower + 0.02,), (mid,), (cda_upper - 0.02,)]
        best = None
        for x0 in starts:
            r = least_squares(res1, x0=x0, bounds=([cda_lower], [cda_upper]), method="trf")
            if best is None or r.cost < best.cost:
                best = r
        cda = float(best.x[0])
        # CI for CdA only
        n, p_ = len(best.fun), 1
        s2 = 2.0 * best.cost / max(n - p_, 1)
        try:
            cov = s2 * np.linalg.inv(best.jac.T @ best.jac)
            se = float(np.sqrt(max(cov[0, 0], 0.0)))
        except np.linalg.LinAlgError:
            se = float("nan")
        cda_ci = (cda - 1.96 * se, cda + 1.96 * se)
        crr_ci = (crr_fixed, crr_fixed)
        return SolverResult(
            cda=cda,
            crr=crr_fixed,
            cda_ci=cda_ci,
            crr_ci=crr_ci,
            r_squared=_r_squared(best.fun, P),
            residuals=best.fun,
            n_points=len(valid),
            crr_was_fixed=True,
        )

    bounds_lower = [cda_lower, 0.0015]
    bounds_upper = [cda_upper, 0.012]
    mid = (cda_lower + cda_upper) / 2
    starts = [(cda_lower + 0.02, 0.003), (mid, 0.005), (cda_upper - 0.02, 0.007)]

    # Weight priors to contribute like ~3 "ok" samples each (≈3 W residuals).
    # The prior is only meant as a stabiliser: with well-fit data it barely
    # moves the MAP estimate, with badly-fit data it stops the solver from
    # sticking to the bounds. Calibrated against synthetic recovery tests.
    mean_V = float(np.mean(V_ground))
    mean_V_air_sq = float(np.mean(V_air * V_air))
    mean_rho = float(np.mean(rho))
    crr_arm = mass * 9.80665 * mean_V  # ∂P/∂Crr
    cda_arm = 0.5 * mean_rho * mean_V_air_sq * mean_V  # ∂P/∂CdA
    prior_weight_w = 3.0  # ~3 W of "prior uncertainty"

    # Adaptive factor scales only the CdA prior term
    use_cda_prior_effective = use_cda_prior and adaptive_factor > 0

    def residuals_with_prior(x):
        base = residual_power(x, V_ground, V_air, gradient, accel, mass, rho, P, eta,
                              cda_yaw_factor=yaw_factor)
        extras = []
        if use_crr_prior:
            extras.append(prior_weight_w * crr_arm * (x[1] - crr_prior_mean) / crr_prior_sigma)
        if use_cda_prior_effective:
            extras.append(prior_weight_w * adaptive_factor * cda_arm * (x[0] - cda_prior_mean) / cda_prior_sigma)
        if extras:
            return np.concatenate([base, np.array(extras)])
        return base

    n_extra = int(use_crr_prior) + int(use_cda_prior_effective)

    best = None
    for x0 in starts:
        r = least_squares(
            residuals_with_prior,
            x0=x0,
            bounds=(bounds_lower, bounds_upper),
            method="trf",
        )
        if best is None or r.cost < best.cost:
            best = r

    cda, crr = float(best.x[0]), float(best.x[1])
    # CI from the DATA residuals only (drop the prior rows if present)
    fun_data = best.fun[:n_data] if n_extra else best.fun
    jac_data = best.jac[:n_data, :] if n_extra else best.jac
    p_params = 2
    if n_data > p_params:
        s2 = float(np.sum(fun_data ** 2)) / (n_data - p_params)
        try:
            cov = s2 * np.linalg.inv(jac_data.T @ jac_data)
            se = np.sqrt(np.maximum(np.diag(cov), 0.0))
            cda_ci = (cda - 1.96 * se[0], cda + 1.96 * se[0])
            crr_ci = (crr - 1.96 * se[1], crr + 1.96 * se[1])
        except np.linalg.LinAlgError:
            cda_ci = (float("nan"), float("nan"))
            crr_ci = (float("nan"), float("nan"))
    else:
        cda_ci = (float("nan"), float("nan"))
        crr_ci = (float("nan"), float("nan"))

    return SolverResult(
        cda=cda,
        crr=crr,
        cda_ci=cda_ci,
        crr_ci=crr_ci,
        r_squared=_r_squared(fun_data, P),
        residuals=fun_data,
        n_points=len(valid),
        crr_was_fixed=False,
    )


def solve_cda_crr(
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
) -> SolverResult:
    """Wrapper: two-pass adaptive prior + MLE pass for ``cda_raw``.

    When Crr is fixed, Martin LS doesn't apply a CdA prior term (see
    ``_solve_cda_crr_inner``), so the adaptive scaling is a no-op in that
    branch. The cascade in ``pipeline.py`` falls back to Chung VE / wind
    inverse for hard cases anyway.
    """
    kwargs = dict(
        mass=mass, eta=eta, crr_fixed=crr_fixed,
        crr_prior_mean=crr_prior_mean, crr_prior_sigma=crr_prior_sigma,
        cda_prior_mean=cda_prior_mean, cda_prior_sigma=cda_prior_sigma,
        cda_lower=cda_lower, cda_upper=cda_upper,
    )
    prior_active = (
        crr_fixed is None  # crr_fixed path has no CdA prior term
        and cda_prior_sigma is not None
        and cda_prior_sigma > 0
    )

    # Pass 0: MLE pur
    raw_cda = None
    raw_ci = None
    if prior_active:
        try:
            raw = _solve_cda_crr_inner(df, adaptive_factor=0.0, **kwargs)
            raw_cda = float(raw.cda)
            raw_ci = raw.cda_ci
        except Exception:
            pass

    # Pass 1: poids de base
    result = _solve_cda_crr_inner(df, adaptive_factor=1.0, **kwargs)
    adaptive_factor = 1.0

    # Pass 2: adaptatif
    if prior_active:
        sigma_hess = (result.cda_ci[1] - result.cda_ci[0]) / 3.92
        if not np.isnan(sigma_hess) and sigma_hess > 0 and cda_prior_sigma > 0:
            ratio = float(sigma_hess / cda_prior_sigma)
            if ratio > 1.0:
                try:
                    result = _solve_cda_crr_inner(df, adaptive_factor=ratio, **kwargs)
                    adaptive_factor = ratio
                except Exception:
                    pass

    result.prior_adaptive_factor = float(adaptive_factor)
    result.cda_raw = raw_cda
    result.cda_raw_ci = raw_ci
    return result
