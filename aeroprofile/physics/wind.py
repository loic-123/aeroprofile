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


RIDER_HEIGHT_M = 1.3  # effective rider height for wind log-law
Z0_OPEN = 0.03        # roughness length, open terrain (m)
Z0_SUBURBAN = 0.5     # roughness length, suburban/forest (m)


def wind_log_law_scale(z0: float = 0.03, z_rider: float = RIDER_HEIGHT_M) -> float:
    """Logarithmic wind profile: v(z) = v_ref × ln(z/z0) / ln(z_ref/z0).

    Converts 10 m meteorological wind speed to wind at rider height.
    z0 = surface roughness: 0.03 m open terrain, ~0.1 m rural, 0.5 m forest.
    With z_rider = 1.3 m, z0 = 0.03 → factor ≈ 0.65.
    With z_rider = 1.3 m, z0 = 0.1  → factor ≈ 0.55.
    With z_rider = 1.3 m, z0 = 0.5  → factor ≈ 0.35.
    """
    z_ref = 10.0
    return np.log(z_rider / z0) / np.log(z_ref / z0)


def compute_v_air(
    v_ground,
    bearing_deg,
    wind_speed_ms,
    wind_dir_deg,
    wind_height_factor: float | None = None,
    z0: float = 0.03,
):
    """Rider's speed relative to air.

    wind_dir_deg: meteorological convention — direction the wind is COMING FROM (0=N).
    A wind blowing from North against a rider heading North is a headwind.

    The wind at 10 m from Open-Meteo is scaled to rider height (1.3 m) with
    a logarithmic profile based on surface roughness ``z0``. If
    ``wind_height_factor`` is provided, it overrides the log-law.
    """
    if wind_height_factor is None:
        wind_height_factor = wind_log_law_scale(z0=z0)
    wind_at_rider = np.asarray(wind_speed_ms, dtype=float) * wind_height_factor
    headwind = wind_at_rider * np.cos(np.radians(np.asarray(wind_dir_deg) - np.asarray(bearing_deg)))
    v_air = np.asarray(v_ground, dtype=float) + headwind
    return v_air
