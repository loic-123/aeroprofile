"""Weather interpolation tests."""

from datetime import datetime, timedelta, timezone

import numpy as np

from aeroprofile.weather.interpolation import interpolate_weather


def _fake_hourly():
    t0 = datetime(2026, 4, 5, 0, 0, tzinfo=timezone.utc)
    times = [(t0 + timedelta(hours=i)).isoformat().replace("+00:00", "") for i in range(24)]
    return {
        "time": times,
        "windspeed_10m": [18.0] * 24,  # km/h (constant)
        "winddirection_10m": [270.0] * 24,
        "temperature_2m": [15.0] * 24,
        "relativehumidity_2m": [60.0] * 24,
        "surface_pressure": [1013.0] * 24,
    }


def test_wind_speed_km_h_converted_to_m_s():
    h = _fake_hourly()
    ts = [datetime(2026, 4, 5, 7, 0, tzinfo=timezone.utc)]
    df = interpolate_weather(h, ts)
    assert abs(df["wind_speed_ms"].iloc[0] - 5.0) < 0.01  # 18/3.6 = 5


def test_wind_direction_preserved():
    h = _fake_hourly()
    ts = [datetime(2026, 4, 5, 7, 30, tzinfo=timezone.utc)]
    df = interpolate_weather(h, ts)
    assert abs(df["wind_dir_deg"].iloc[0] - 270.0) < 0.5


def test_wrap_around_interpolation():
    """Direction 359° to 1° shouldn't interpolate to 180°."""
    t0 = datetime(2026, 4, 5, 0, 0, tzinfo=timezone.utc)
    times = [(t0 + timedelta(hours=i)).isoformat().replace("+00:00", "") for i in range(3)]
    h = {
        "time": times,
        "windspeed_10m": [10.0, 10.0, 10.0],
        "winddirection_10m": [359.0, 1.0, 1.0],
        "temperature_2m": [15.0, 15.0, 15.0],
        "relativehumidity_2m": [60.0, 60.0, 60.0],
        "surface_pressure": [1013.0, 1013.0, 1013.0],
    }
    # midpoint between hour 0 and 1
    ts = [datetime(2026, 4, 5, 0, 30, tzinfo=timezone.utc)]
    df = interpolate_weather(h, ts)
    d = df["wind_dir_deg"].iloc[0]
    # Should be near 0°, not near 180°
    assert d > 355.0 or d < 5.0
