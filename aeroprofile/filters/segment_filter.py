"""Segment filters that mark valid/invalid samples for the solver."""

from __future__ import annotations

import numpy as np
import pandas as pd

FILTER_NAMES = (
    "filter_stopped",
    "filter_low_speed",
    "filter_no_power",
    "filter_braking",
    "filter_hard_accel",
    "filter_steep_climb",
    "filter_descent",
    "filter_sharp_turn",
    "filter_negative_v_air",
    "filter_gps_jump",
    "filter_power_spike",
    "filter_unsteady",
    "filter_drafting",
)


def _arr(s) -> np.ndarray:
    """Return a fresh, writable float array from a pandas Series or array-like."""
    return np.array(s, dtype=float, copy=True)


def apply_filters(
    df: pd.DataFrame,
    mass: float = 75.0,
    min_block_seconds: int = 30,
    drop_descents: bool = False,
    max_gradient: float = 0.08,
    descent_gradient: float = -0.08,
    steady_speed_window_s: int = 15,
    steady_speed_cv_max: float = 0.15,
    min_power_w: float = 50.0,
    max_accel: float = 0.3,
    drafting_cda_threshold: float = 0.12,
) -> pd.DataFrame:
    """Adds one boolean column per filter plus ``filter_valid``. Mutates df.

    Thresholds follow literature consensus (Martin 1998; Chung VE; Golden
    Cheetah Aerolab; Debraux et al. 2011):

    - Descents are KEPT by default. High V_air in descents gives excellent
      aero signal (Chung's own method uses coast-down descents as premium
      CdA data). Braking and cornering ARE filtered out inside descents.
    - ``filter_low_power``: P < 50 W is dropped. Below that threshold the
      aero-force / power ratio is unusable regardless of gradient.
    - ``filter_hard_accel`` / ``filter_braking``: threshold ±0.3 m/s² per
      Martin et al. 1998 (tighter than our earlier ±1.5 which was too lax).
    - ``min_block_seconds``: 30 s contiguous blocks required for
      quasi-steady-state aero extraction.
    - ``filter_unsteady``: rolling CV of ground speed over 15 s must stay
      below 15% — drops punchy sprints, stops, brake-and-accelerate.
    - ``filter_sharp_turn``: drop |yaw_rate| > 10°/s (cornering loss).
    """
    n = len(df)
    v = _arr(df["v_ground"])
    p = _arr(df["power"])
    a = _arr(df["acceleration"])
    grad = _arr(df["gradient"])
    bearing = _arr(df["bearing"])
    v_air = _arr(df["v_air"])

    if "distance" in df.columns:
        d = _arr(df["distance"])
        dd = np.diff(d, prepend=d[0])
    else:
        dd = np.zeros(n)

    dt = _arr(df["dt"]) if "dt" in df.columns else np.ones(n)

    df["filter_stopped"] = v < 1.0
    df["filter_low_speed"] = v < 3.0
    # Low-power = unusable aero signal (Martin 1998: P < 50 W threshold).
    df["filter_no_power"] = p < min_power_w
    df["filter_braking"] = a < -max_accel
    df["filter_hard_accel"] = a > max_accel
    df["filter_steep_climb"] = grad > max_gradient
    if drop_descents:
        df["filter_descent"] = grad < descent_gradient
    else:
        # Only drop very steep descents (physics breaks down — coasting,
        # terminal velocity, uncontrolled braking).
        df["filter_descent"] = grad < descent_gradient

    # Bearing rate (deg/s), wrap-safe; per Debraux literature threshold 10°/s
    db = np.diff(bearing, prepend=bearing[0])
    db = (db + 180.0) % 360.0 - 180.0
    bearing_rate = np.abs(db) / np.where(dt > 0, dt, 1.0)
    df["filter_sharp_turn"] = bearing_rate > 10.0

    df["filter_negative_v_air"] = v_air <= 0
    df["filter_gps_jump"] = dd > 50.0

    # Power spike vs normalised power
    roll_p = pd.Series(p).rolling(window=30, min_periods=1).mean().to_numpy()
    np_val = float(np.mean(roll_p**4)) ** 0.25 if n > 0 else 0.0
    df["filter_power_spike"] = p > 3.0 * np_val if np_val > 0 else np.zeros(n, dtype=bool)

    # Unsteady speed: require rolling speed CV < threshold
    window = max(3, int(steady_speed_window_s))
    v_roll_mean = pd.Series(v).rolling(window=window, center=True, min_periods=window // 2).mean()
    v_roll_std = pd.Series(v).rolling(window=window, center=True, min_periods=window // 2).std()
    cv = (v_roll_std / v_roll_mean.replace(0, np.nan)).fillna(1.0).to_numpy()
    df["filter_unsteady"] = cv > steady_speed_cv_max

    # Drafting detection: compute instantaneous CdA and flag points where
    # it's impossibly low (< 0.18 m² at speed > 8 m/s on flat).
    # CdA_inst = (P×η - P_roll - P_grav - P_accel) / (0.5×ρ×V_air²×V)
    # If CdA_inst < threshold → rider is in a draft (or data is broken).
    if "rho" in df.columns:
        rho = _arr(df["rho"])
        from aeroprofile.physics.constants import G as _G, ETA_DEFAULT as _eta
        theta = np.arctan(grad)
        P_roll_est = 0.004 * mass * _G * np.cos(theta) * v  # Crr~0.004 guess
        P_grav_est = mass * _G * np.sin(theta) * v
        P_accel_est = mass * a * v
        numerator = p * _eta - P_roll_est - P_grav_est - P_accel_est
        denominator = 0.5 * rho * np.sign(v_air) * v_air * v_air * v
        with np.errstate(divide="ignore", invalid="ignore"):
            cda_inst = np.where(np.abs(denominator) > 1.0, numerator / denominator, 0.5)
        # Only flag at sufficient speed AND power on flat terrain.
        # CdA < 0.12 at 30+ km/h while pedalling hard = physically impossible
        # solo (even pro TT is ~0.17). Below that = certain drafting or data error.
        fast_flat_pedalling = (v > 8.0) & (np.abs(grad) < 0.02) & (p > 100.0)
        raw_draft = fast_flat_pedalling & (cda_inst < drafting_cda_threshold) & (cda_inst > 0)
        # A real drafting stint lasts at least 30 seconds — isolated low-CdA
        # points are noise, not drafting. Keep only contiguous blocks ≥ 30 s.
        draft_clean = np.array(raw_draft, dtype=bool, copy=True)
        i = 0
        while i < n:
            if not draft_clean[i]:
                i += 1
                continue
            j = i
            block_dur = 0.0
            while j < n and draft_clean[j]:
                block_dur += dt[j] if dt[j] > 0 else 0.0
                j += 1
            if block_dur < 30.0:
                draft_clean[i:j] = False
            i = j
        df["filter_drafting"] = draft_clean
    else:
        df["filter_drafting"] = np.zeros(n, dtype=bool)

    any_filter = np.zeros(n, dtype=bool)
    for name in FILTER_NAMES:
        any_filter = any_filter | np.asarray(df[name].to_numpy(), dtype=bool)
    df["filter_valid"] = ~any_filter

    # Keep only contiguous valid blocks of at least `min_block_seconds`
    valid = np.array(df["filter_valid"].to_numpy(), dtype=bool, copy=True)
    i = 0
    while i < n:
        if not valid[i]:
            i += 1
            continue
        j = i
        block_dur = 0.0
        while j < n and valid[j]:
            block_dur += dt[j] if dt[j] > 0 else 0.0
            j += 1
        if block_dur < min_block_seconds:
            valid[i:j] = False
        i = j
    df["filter_valid"] = valid
    return df
