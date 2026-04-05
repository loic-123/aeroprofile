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


def solve_cda_crr(
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    crr_prior_mean: float | None = 0.004,
    crr_prior_sigma: float | None = 0.0015,
) -> SolverResult:
    """Solve CdA and Crr (or CdA only with fixed Crr) via multi-start TRF.

    A weak Gaussian prior on Crr (default μ=0.004, σ=0.0015) keeps Crr from
    absorbing unmodelled errors (wind, aero, drafting) when the data are
    insufficient to constrain it on their own. Pass ``crr_prior_mean=None``
    to disable.
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
    n_data = len(P)

    use_prior = (
        crr_fixed is None
        and crr_prior_mean is not None
        and crr_prior_sigma is not None
        and crr_prior_sigma > 0
    )

    if crr_fixed is not None:
        # 1D optimisation over CdA only
        def res1(x):
            return residual_power(
                (x[0], crr_fixed), V_ground, V_air, gradient, accel, mass, rho, P, eta
            )

        starts = [(0.25,), (0.35,), (0.45,)]
        best = None
        for x0 in starts:
            r = least_squares(res1, x0=x0, bounds=([0.15], [0.60]), method="trf")
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

    bounds_lower = [0.15, 0.0015]
    bounds_upper = [0.60, 0.012]
    starts = [(0.25, 0.003), (0.35, 0.005), (0.45, 0.007)]

    # Weight the Crr prior so that it contributes like sqrt(N) "good" samples
    # (in watts). Prior sigma is in Crr units; multiply by a representative
    # ∂P/∂Crr = m·g·<V> to convert to watts-equivalent.
    if use_prior:
        mean_pwr_arm = mass * 9.80665 * float(np.mean(V_ground))
        prior_weight_w = np.sqrt(n_data) * 1.0  # ~1 W uncertainty equivalent

    def residuals_with_prior(x):
        base = residual_power(x, V_ground, V_air, gradient, accel, mass, rho, P, eta)
        if not use_prior:
            return base
        # Single extra residual: (Crr - μ) / σ × weight × arm
        prior_res = prior_weight_w * mean_pwr_arm * (x[1] - crr_prior_mean) / crr_prior_sigma
        return np.concatenate([base, [prior_res]])

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
    # CI from the DATA residuals only (drop the prior row if present)
    fun_data = best.fun[:n_data] if use_prior else best.fun
    jac_data = best.jac[:n_data, :] if use_prior else best.jac
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
