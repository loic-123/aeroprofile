"""Wind, bearing, and air-speed computations."""

from __future__ import annotations

import numpy as np


def compute_bearing(lat1, lon1, lat2, lon2):
    """Bearing in degrees (0=N, 90=E). Scalar or array."""
    lat1_r = np.radians(lat1)
    lat2_r = np.radians(lat2)
    dlon = np.radians(np.asarray(lon2) - np.asarray(lon1))
    x = np.sin(dlon) * np.cos(lat2_r)
    y = np.cos(lat1_r) * np.sin(lat2_r) - np.sin(lat1_r) * np.cos(lat2_r) * np.cos(dlon)
    return (np.degrees(np.arctan2(x, y)) + 360.0) % 360.0


def compute_bearing_series(lat, lon):
    """Per-point bearing from successive GPS points."""
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    n = len(lat)
    out = np.zeros(n)
    if n < 2:
        return out
    out[1:] = compute_bearing(lat[:-1], lon[:-1], lat[1:], lon[1:])
    out[0] = out[1]
    return out


def compute_v_air(
    v_ground,
    bearing_deg,
    wind_speed_ms,
    wind_dir_deg,
    wind_height_factor: float = 0.7,
):
    """Rider's speed relative to air.

    wind_dir_deg: meteorological convention — direction the wind is COMING FROM (0=N).
    A wind blowing from North against a rider heading North is a headwind.
    """
    wind_at_rider = np.asarray(wind_speed_ms, dtype=float) * wind_height_factor
    # Headwind component: positive when wind opposes rider direction.
    # If wind_dir == bearing → wind comes from rider's front → headwind.
    headwind = wind_at_rider * np.cos(np.radians(np.asarray(wind_dir_deg) - np.asarray(bearing_deg)))
    v_air = np.asarray(v_ground, dtype=float) + headwind
    return v_air
