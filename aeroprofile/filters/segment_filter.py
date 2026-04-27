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
    "filter_lap_excluded",
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
    excluded_lap_ranges: list[tuple] | None = None,
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

    # Drafting detection: CdA smoothed 10s drops below 70% of the ride's
    # median CdA on fast/flat/pedalling segments. This relative threshold
    # adapts automatically to each rider's morphology — a small rider with
    # CdA=0.25 gets threshold 0.175, a large rider at 0.40 gets 0.28.
    # 30% reduction corresponds to close drafting (Blocken et al. 2018).
    if "rho" in df.columns:
        rho = _arr(df["rho"])
        from aeroprofile.physics.constants import G as _G, ETA_DEFAULT as _eta
        theta = np.arctan(grad)
        P_roll_est = 0.004 * mass * _G * np.cos(theta) * v
        P_grav_est = mass * _G * np.sin(theta) * v
        P_accel_est = mass * a * v
        numerator = p * _eta - P_roll_est - P_grav_est - P_accel_est
        denominator = 0.5 * rho * np.sign(v_air) * v_air * v_air * v
        with np.errstate(divide="ignore", invalid="ignore"):
            cda_inst = np.where(np.abs(denominator) > 1.0, numerator / denominator, np.nan)
        # Smooth CdA over 10 seconds to eliminate noise
        cda_smooth_10s = pd.Series(cda_inst).rolling(window=10, center=True, min_periods=3).mean().to_numpy()
        # Compute median CdA on fast/flat/pedalling points only (representative of solo riding)
        fast_flat_pedalling = (v > 8.0) & (np.abs(grad) < 0.02) & (p > 100.0)
        cda_valid = cda_smooth_10s[fast_flat_pedalling & np.isfinite(cda_smooth_10s) & (cda_smooth_10s > 0.05) & (cda_smooth_10s < 0.8)]
        if len(cda_valid) > 30:
            cda_median = float(np.median(cda_valid))
            draft_threshold = cda_median * 0.70  # 30% reduction = drafting
            cda_smooth_safe = np.nan_to_num(cda_smooth_10s, nan=cda_median)
            raw_draft = fast_flat_pedalling & (cda_smooth_safe < draft_threshold) & (cda_smooth_safe > 0)
        else:
            raw_draft = np.zeros(n, dtype=bool)
        # Keep only contiguous blocks ≥ 20 seconds
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
            if block_dur < 20.0:
                draft_clean[i:j] = False
            i = j
        df["filter_drafting"] = draft_clean
    else:
        df["filter_drafting"] = np.zeros(n, dtype=bool)

    lap_excl = np.zeros(n, dtype=bool)
    if excluded_lap_ranges and "timestamp" in df.columns:
        # Strip tz so the comparison works regardless of which side carries tzinfo
        # (df timestamps are usually tz-naive after the pandas pipeline).
        ts_series = pd.to_datetime(df["timestamp"], utc=True).dt.tz_convert(None)
        ts = ts_series.to_numpy()
        for start, end in excluded_lap_ranges:
            s = pd.Timestamp(start)
            e = pd.Timestamp(end)
            if s.tzinfo is not None:
                s = s.tz_convert("UTC").tz_localize(None)
            if e.tzinfo is not None:
                e = e.tz_convert("UTC").tz_localize(None)
            lap_excl |= (ts >= np.datetime64(s)) & (ts < np.datetime64(e))
    df["filter_lap_excluded"] = lap_excl

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
