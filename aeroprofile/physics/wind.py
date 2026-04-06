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


def compute_yaw_angle(
    v_ground,
    bearing_deg,
    wind_speed_ms,
    wind_dir_deg,
    wind_height_factor: float | None = None,
    z0: float = 0.03,
) -> np.ndarray:
    """Yaw angle of the apparent wind relative to the rider's heading (degrees).

    Yaw = 0 means pure headwind or tailwind. Yaw = 90 means pure crosswind.
    Returned as absolute value in [0, 90].

    Used to correct CdA for yaw dependence (Crouch et al. 2014):
    CdA increases by ~5-10% at 10° yaw due to asymmetric flow separation.
    """
    if wind_height_factor is None:
        wind_height_factor = wind_log_law_scale(z0=z0)
    wind_at_rider = np.asarray(wind_speed_ms, dtype=float) * wind_height_factor
    bearing = np.asarray(bearing_deg, dtype=float)
    wind_dir = np.asarray(wind_dir_deg, dtype=float)
    v_g = np.asarray(v_ground, dtype=float)

    # Wind components in the rider's frame
    # crosswind = wind perpendicular to rider heading
    crosswind = wind_at_rider * np.sin(np.radians(wind_dir - bearing))
    # headwind component
    headwind = wind_at_rider * np.cos(np.radians(wind_dir - bearing))
    # Apparent wind: ground speed + headwind along heading, crosswind perpendicular
    v_along = v_g + headwind
    v_cross = crosswind
    # Yaw = angle between apparent wind vector and rider heading
    yaw = np.degrees(np.arctan2(np.abs(v_cross), np.abs(v_along)))
    return np.clip(yaw, 0.0, 90.0)


def cda_yaw_correction(yaw_deg: np.ndarray, k: float = 0.0035) -> np.ndarray:
    """Multiplicative correction to CdA from yaw angle.

    CdA_effective = CdA_0 × (1 + k × yaw²)

    Per Crouch, Burton et al. (2014), CdA increases roughly quadratically
    with yaw angle. k ≈ 0.0035 gives ~3.5% increase at 10° yaw and ~14%
    at 20° yaw, consistent with wind-tunnel measurements.

    The solver estimates CdA_0 (zero-yaw CdA) and this function converts
    to the effective CdA at each point.
    """
    yaw = np.asarray(yaw_deg, dtype=float)
    return 1.0 + k * yaw * yaw
