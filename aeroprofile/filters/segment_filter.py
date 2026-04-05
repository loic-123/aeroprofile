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
    "filter_steep_descent",
    "filter_sharp_turn",
    "filter_negative_v_air",
    "filter_gps_jump",
    "filter_power_spike",
)


def apply_filters(df: pd.DataFrame, min_block_seconds: int = 10) -> pd.DataFrame:
    """Adds one boolean column per filter plus `filter_valid`. Mutates df."""
    n = len(df)
    v = df["v_ground"].to_numpy()
    p = df["power"].to_numpy()
    a = df["acceleration"].to_numpy()
    grad = df["gradient"].to_numpy()
    bearing = df["bearing"].to_numpy()
    v_air = df["v_air"].to_numpy()

    # distance jumps
    if "distance" in df.columns:
        d = df["distance"].to_numpy()
        dd = np.diff(d, prepend=d[0])
    else:
        dd = np.zeros(n)

    # dt
    dt = df["dt"].to_numpy() if "dt" in df.columns else np.ones(n)

    df["filter_stopped"] = v < 1.0
    df["filter_low_speed"] = v < 4.0
    df["filter_no_power"] = (p == 0) & (v > 3.0)
    df["filter_braking"] = a < -1.5
    df["filter_hard_accel"] = a > 1.5
    df["filter_steep_climb"] = grad > 0.08
    df["filter_steep_descent"] = grad < -0.08

    # bearing rate (deg/s), handle wrap
    db = np.diff(bearing, prepend=bearing[0])
    db = (db + 180.0) % 360.0 - 180.0
    bearing_rate = np.abs(db) / np.where(dt > 0, dt, 1.0)
    df["filter_sharp_turn"] = bearing_rate > 20.0

    df["filter_negative_v_air"] = v_air <= 0
    df["filter_gps_jump"] = dd > 50.0

    # Normalised power (NP) ≈ 4th-root mean of 30s rolling mean of P
    roll = pd.Series(p).rolling(window=30, min_periods=1).mean().to_numpy()
    np_val = float(np.mean(roll**4)) ** 0.25 if n > 0 else 0.0
    df["filter_power_spike"] = p > 3.0 * np_val if np_val > 0 else np.zeros(n, dtype=bool)

    any_filter = np.zeros(n, dtype=bool)
    for name in FILTER_NAMES:
        any_filter |= df[name].to_numpy()
    df["filter_valid"] = ~any_filter

    # Keep only contiguous valid blocks of at least `min_block_seconds`
    valid = df["filter_valid"].to_numpy().copy()
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
