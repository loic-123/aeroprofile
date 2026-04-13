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

import numpy as np
from scipy.optimize import least_squares

from aeroprofile.physics.constants import G, ETA_DEFAULT
from aeroprofile.physics.wind import compute_v_air, cda_yaw_correction


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
    """Jointly estimate (CdA, Crr, wind_per_segment) via Chung VE.

    Returns dict with keys cda, crr, r_squared, residuals, v_air_solved,
    heading_variance, n_segments, n_points. Returns None if heading
    variance is too low.
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
        extras = []
        pw = 0.3 * np.sqrt(n)

        # Wind prior per segment
        for s in range(n_seg):
            extras.append(pw * (wind_uv[s, 0] - u_prior[s]) / (wind_prior_sigma_ms * n_seg))
            extras.append(pw * (wind_uv[s, 1] - v_prior[s]) / (wind_prior_sigma_ms * n_seg))

        # Crr prior
        if has_crr:
            extras.append(pw * (crr - crr_prior_mean) / crr_prior_sigma)

        # CdA prior (bike-type-aware)
        if cda_prior_sigma > 0:
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

    # Confidence intervals from Hessian (drop prior rows from residuals)
    n_data = len(res_alt)
    p_total = len(best.x)
    cda_ci = (float("nan"), float("nan"))
    crr_ci = (float("nan"), float("nan"))
    if n_data > p_total:
        try:
            # Use only data residuals (first n_data) for CI estimation
            jac_data = best.jac[:n_data, :]
            fun_data = best.fun[:n_data]
            s2 = float(np.sum(fun_data ** 2)) / max(n_data - p_total, 1)
            cov = s2 * np.linalg.inv(jac_data.T @ jac_data)
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
