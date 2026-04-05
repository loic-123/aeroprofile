"""Interpolate hourly weather to per-point ride timestamps."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd


def interpolate_weather(hourly: dict, timestamps: list[datetime]) -> pd.DataFrame:
    """Interpolate hourly Open-Meteo data onto ride timestamps.

    Wind direction is interpolated via u/v vector decomposition to avoid
    the 359°→1° wrap-around artefact.
    Wind speed is converted from km/h → m/s.
    """
    times = hourly["time"]
    hour_dts = np.array(
        [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]
    )
    hour_epoch = np.array([dt.timestamp() for dt in hour_dts])

    ws_kmh = np.array(hourly["windspeed_10m"], dtype=float)
    wd_deg = np.array(hourly["winddirection_10m"], dtype=float)
    temp = np.array(hourly["temperature_2m"], dtype=float)
    rh = np.array(hourly["relativehumidity_2m"], dtype=float)
    sp = np.array(hourly["surface_pressure"], dtype=float)

    ws_ms = ws_kmh / 3.6

    # Decompose wind into u (East), v (North) components.
    # Meteorological convention: wd is direction wind comes FROM.
    u = -ws_ms * np.sin(np.radians(wd_deg))
    v = -ws_ms * np.cos(np.radians(wd_deg))

    target = np.array([t.astimezone(timezone.utc).timestamp() for t in timestamps])

    u_i = np.interp(target, hour_epoch, u)
    v_i = np.interp(target, hour_epoch, v)
    temp_i = np.interp(target, hour_epoch, temp)
    rh_i = np.interp(target, hour_epoch, rh)
    sp_i = np.interp(target, hour_epoch, sp)

    ws_i = np.sqrt(u_i**2 + v_i**2)
    wd_i = (np.degrees(np.arctan2(-u_i, -v_i)) + 360.0) % 360.0

    return pd.DataFrame(
        {
            "wind_speed_ms": ws_i,
            "wind_dir_deg": wd_i,
            "temperature_c": temp_i,
            "humidity_pct": rh_i,
            "surface_pressure_hpa": sp_i,
        }
    )
