"""Hierarchical (random-effects) solver for joint multi-ride CdA estimation.

Model:
    CdA_i ~ N(mu, tau²)            (each ride has its own CdA, drawn from
                                     a normal centred on the rider's "true" mean)
    Crr   = constant                (assumed identical across rides since
                                     equipment doesn't change)
    P_i   = sum_t residuals from Chung VE on ride i

Joint optimisation over (mu, log(tau), Crr, CdA_1, ..., CdA_N) by minimising:

    sum_i [
        sum_t (h_virtual_i,t - h_real_i,t)²       # Chung VE per ride
      + ((CdA_i - mu) / tau)²                      # random-effects penalty
    ]
  + optional prior on mu (typically not used: we want pure MLE)

This is the standard random-effects model from meta-analysis
(DerSimonian & Laird 1986, Gelman BDA3 ch.5). It is mathematically more
rigorous than per-ride MLE + post-hoc averaging because:

1. The Crr is shared → information from rides with strong Crr signal
   improves CdA estimates on rides with weak Crr signal.
2. The CdA_i are jointly constrained → an outlier ride is automatically
   pulled toward the consensus, and tau quantifies the inter-ride spread.
3. The uncertainty on mu comes from the global Hessian, not from the
   propagation of per-ride errors.

Returns: dict with mu, tau, crr, per_ride [(cda_i, sigma_i, residuals_i)].
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd
from scipy.optimize import least_squares

from aeroprofile.physics.constants import ETA_DEFAULT
from aeroprofile.solver.chung_ve import _virtual_elevation_vec


@dataclass
class HierarchicalResult:
    mu_cda: float                    # mean CdA across rides (the parameter of interest)
    mu_cda_ci: tuple[float, float]   # 95% CI on mu
    tau: float                        # inter-ride standard deviation
    crr: float                        # shared Crr
    crr_ci: tuple[float, float]
    per_ride_cda: list[float]         # CdA_i for each ride
    per_ride_sigma: list[float]       # ±1σ on each CdA_i
    per_ride_r2: list[float]          # R² of altitude reconstruction per ride
    n_rides: int
    n_points_total: int


def _ride_residuals(
    cda: float, crr: float,
    V, V_air, rho, P, dt, alt_real, block_starts,
    mass: float, eta: float,
) -> np.ndarray:
    """Block-aligned VE residuals for one ride."""
    ve = _virtual_elevation_vec(V, V_air, rho, P, dt, cda, crr, mass, eta, block_starts)
    target = alt_real - alt_real[0]
    # Block alignment: re-zero target and VE at each block start
    n = len(target)
    baseline = np.zeros(n)
    ve_start = np.zeros(n)
    baseline[0] = target[0]
    ve_start[0] = ve[0]
    for i in range(1, n):
        if block_starts[i]:
            baseline[i] = target[i - 1]
            ve_start[i] = ve[i - 1]
        else:
            baseline[i] = baseline[i - 1]
            ve_start[i] = ve_start[i - 1]
    return (ve - ve_start) - (target - baseline)


def solve_hierarchical(
    dfs: Sequence[pd.DataFrame],
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    tau_init: float = 0.03,
    cda_init: float = 0.32,
    cda_lower: float = 0.10,
    cda_upper: float = 0.80,
    cda_prior_mean: float | None = None,
    cda_prior_sigma: float | None = None,
) -> HierarchicalResult:
    """Joint hierarchical MLE on N rides.

    Each df must contain columns: v_ground, v_air, rho, power, dt,
    altitude_smooth, filter_valid (and optionally cda_yaw_factor though
    we ignore it here for simplicity).

    Parameters are: [mu, log_tau, crr (or omitted), cda_1, ..., cda_N].
    Optimised with scipy.optimize.least_squares (TRF) which gives us the
    Hessian for free at the optimum.
    """
    # Pre-extract per-ride arrays (only valid filtered points)
    rides_data = []
    for df in dfs:
        valid = df[df["filter_valid"]].reset_index(drop=True)
        if len(valid) < 60:
            continue
        V = np.asarray(valid["v_ground"].to_numpy(), dtype=float)
        V_air = np.asarray(valid["v_air"].to_numpy(), dtype=float)
        rho = np.asarray(valid["rho"].to_numpy(), dtype=float)
        P = np.asarray(valid["power"].to_numpy(), dtype=float)
        dt = np.asarray(valid["dt"].to_numpy(), dtype=float)
        alt_real = np.asarray(valid["altitude_smooth"].to_numpy(), dtype=float)
        # Block starts from dt jumps
        block_starts = np.zeros(len(V), dtype=bool)
        block_starts[0] = True
        block_starts[1:] = dt[1:] > 3.0
        rides_data.append({
            "V": V, "V_air": V_air, "rho": rho, "P": P, "dt": dt,
            "alt_real": alt_real, "block_starts": block_starts,
            "n": len(V),
        })

    n_rides = len(rides_data)
    if n_rides == 0:
        raise ValueError("No valid rides for hierarchical solve")

    # Parameter layout
    has_crr = crr_fixed is None
    n_params = 2 + (1 if has_crr else 0) + n_rides  # mu, log_tau, [crr,] cda_1..N

    def _unpack(x):
        mu = x[0]
        log_tau = x[1]
        tau = np.exp(log_tau)
        idx = 2
        if has_crr:
            crr = x[idx]
            idx += 1
        else:
            crr = crr_fixed
        cdas = x[idx:idx + n_rides]
        return mu, tau, crr, cdas

    n_points_total = sum(rd["n"] for rd in rides_data)

    def residuals(x):
        mu, tau, crr, cdas = _unpack(x)
        all_res = []
        # VE residuals per ride (weighted by 1/sqrt(n) for balance)
        for i, rd in enumerate(rides_data):
            cda_i = cdas[i]
            r_i = _ride_residuals(
                cda_i, crr,
                rd["V"], rd["V_air"], rd["rho"], rd["P"], rd["dt"],
                rd["alt_real"], rd["block_starts"], mass, eta,
            )
            # Normalise so each ride contributes equally regardless of length
            # (otherwise long rides dominate the optimisation)
            r_i = r_i / np.sqrt(rd["n"])
            all_res.append(r_i)
        # Random-effects penalty: (cda_i - mu) / tau
        # tau is a parameter to estimate — but the solver tends to push it
        # toward 0 (overfitting). We add a soft floor to avoid singularity.
        tau_safe = max(tau, 0.005)
        for cda_i in cdas:
            all_res.append(np.array([(cda_i - mu) / tau_safe]))
        # Optional prior on mu
        if cda_prior_mean is not None and cda_prior_sigma is not None and cda_prior_sigma > 0:
            # Weight calibrated to be ~3 "virtual rides" worth
            pw = 0.3 * np.sqrt(n_rides)
            all_res.append(np.array([pw * (mu - cda_prior_mean) / cda_prior_sigma]))
        # Soft penalty on log_tau to keep tau in [0.005, 0.20]
        # (a half-Cauchy prior would be more rigorous, but this is enough)
        if tau > 0.20:
            all_res.append(np.array([(tau - 0.20) / 0.05]))
        elif tau < 0.005:
            all_res.append(np.array([(0.005 - tau) / 0.005]))
        else:
            all_res.append(np.array([0.0]))
        return np.concatenate(all_res)

    # Initial guess
    x0 = np.zeros(n_params)
    x0[0] = cda_init                       # mu
    x0[1] = np.log(tau_init)               # log_tau
    idx = 2
    if has_crr:
        x0[idx] = 0.005
        idx += 1
    for i in range(n_rides):
        x0[idx + i] = cda_init             # initial CdA per ride

    # Bounds
    lb = np.full(n_params, -np.inf)
    ub = np.full(n_params, np.inf)
    lb[0] = cda_lower; ub[0] = cda_upper             # mu
    lb[1] = np.log(0.005); ub[1] = np.log(0.20)       # log_tau
    idx = 2
    if has_crr:
        lb[idx] = 0.0015; ub[idx] = 0.012
        idx += 1
    for i in range(n_rides):
        lb[idx + i] = cda_lower; ub[idx + i] = cda_upper

    # Solve
    result = least_squares(residuals, x0=x0, bounds=(lb, ub), method="trf", max_nfev=2000)

    mu, tau, crr, cdas = _unpack(result.x)

    # Confidence intervals from Hessian
    n_data = sum(rd["n"] for rd in rides_data)  # rough estimate of effective n
    p = n_params
    if n_data > p:
        s2 = 2.0 * result.cost / max(n_data - p, 1)
        try:
            cov = s2 * np.linalg.inv(result.jac.T @ result.jac)
            se = np.sqrt(np.maximum(np.diag(cov), 0.0))
            mu_ci = (float(mu - 1.96 * se[0]), float(mu + 1.96 * se[0]))
            crr_ci = (
                (float(crr - 1.96 * se[2]), float(crr + 1.96 * se[2]))
                if has_crr else (float(crr), float(crr))
            )
            cda_idx_start = 3 if has_crr else 2
            per_ride_sigma = [float(se[cda_idx_start + i]) for i in range(n_rides)]
        except np.linalg.LinAlgError:
            mu_ci = (float("nan"), float("nan"))
            crr_ci = (float("nan"), float("nan"))
            per_ride_sigma = [0.05] * n_rides
    else:
        mu_ci = (float("nan"), float("nan"))
        crr_ci = (float("nan"), float("nan"))
        per_ride_sigma = [0.05] * n_rides

    # Per-ride R² (informational)
    per_ride_r2 = []
    for i, rd in enumerate(rides_data):
        r_i = _ride_residuals(
            cdas[i], crr,
            rd["V"], rd["V_air"], rd["rho"], rd["P"], rd["dt"],
            rd["alt_real"], rd["block_starts"], mass, eta,
        )
        target = rd["alt_real"] - rd["alt_real"][0]
        ss_res = float(np.sum(r_i ** 2))
        ss_tot = float(np.sum((target - target.mean()) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
        per_ride_r2.append(r2)

    return HierarchicalResult(
        mu_cda=float(mu),
        mu_cda_ci=mu_ci,
        tau=float(tau),
        crr=float(crr),
        crr_ci=crr_ci,
        per_ride_cda=[float(c) for c in cdas],
        per_ride_sigma=per_ride_sigma,
        per_ride_r2=per_ride_r2,
        n_rides=n_rides,
        n_points_total=n_points_total,
    )
