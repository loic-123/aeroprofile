"""Tiled weather fetching: sample wind along the route, not just at the centroid.

Open-Meteo delivers a ~10 km-grid value. For rides crossing mountains or
multiple valleys, a single centroid lookup misses the real wind the cyclist
felt. We batch-request weather at ~5 km tiles along the route (N up to ~6 by
default to stay under API limits) and stitch the tiles by nearest-tile
selection per sample.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from math import atan2, cos, radians, sin, sqrt

import numpy as np
import pandas as pd

from aeroprofile.weather.open_meteo import fetch_weather
from aeroprofile.weather.interpolation import interpolate_weather


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _pick_tile_anchors(
    lats: np.ndarray, lons: np.ndarray, tile_km: float, max_tiles: int
) -> list[tuple[int, float, float]]:
    """Walk along the route and drop an anchor every `tile_km` kilometres."""
    if len(lats) < 2:
        return [(0, float(lats[0]), float(lons[0]))]
    anchors: list[tuple[int, float, float]] = [(0, float(lats[0]), float(lons[0]))]
    cum = 0.0
    target = tile_km * 1000.0
    for i in range(1, len(lats)):
        cum += _haversine(lats[i - 1], lons[i - 1], lats[i], lons[i])
        if cum >= target:
            anchors.append((i, float(lats[i]), float(lons[i])))
            cum = 0.0
            if len(anchors) >= max_tiles:
                break
    if anchors[-1][0] != len(lats) - 1:
        anchors.append((len(lats) - 1, float(lats[-1]), float(lons[-1])))
    # Deduplicate: cap at max_tiles keeping endpoints + evenly spaced
    if len(anchors) > max_tiles:
        idxs = np.linspace(0, len(anchors) - 1, max_tiles).astype(int)
        anchors = [anchors[j] for j in idxs]
    return anchors


async def fetch_weather_tiled(
    lats: np.ndarray,
    lons: np.ndarray,
    ride_date: date | str,
    tile_km: float = 10.0,
    max_tiles: int = 3,
) -> list[tuple[int, dict]]:
    """Return a list of (first_point_index, hourly_weather_dict) tiles.

    Open-Meteo's free tier rate-limits parallel requests (HTTP 429), so
    tiles are fetched SEQUENTIALLY with a small inter-request delay.
    Defaults are conservative: 3 tiles max (start / middle / end), 10 km
    spacing. For a 100 km mountain ride that's still enough to catch the
    main wind gradient.
    """
    anchors = _pick_tile_anchors(lats, lons, tile_km, max_tiles)
    tiles: list[tuple[int, dict]] = []
    for i, (idx, lat, lon) in enumerate(anchors):
        try:
            data = await fetch_weather(lat, lon, ride_date)
            if isinstance(data, dict):
                tiles.append((idx, data))
        except Exception:
            # Skip failed tiles; the pipeline will fall back to a single
            # centroid fetch upstream if the list ends up empty.
            pass
        # 300 ms between requests keeps us well under Open-Meteo's
        # published 600 calls/minute / 10 calls/second limit.
        if i < len(anchors) - 1:
            await asyncio.sleep(0.3)
    return tiles


def interpolate_tiled_weather(
    tiles: list[tuple[int, dict]],
    timestamps: list[datetime],
) -> pd.DataFrame:
    """Blend per-tile interpolated weather onto per-sample timestamps.

    For each sample index i, we pick the tile whose anchor index is closest
    (and <= i for stability). For smoothness, neighbours are linearly
    blended within ±5 samples of a tile boundary.
    """
    n = len(timestamps)
    if not tiles:
        raise ValueError("No weather tiles fetched.")
    if len(tiles) == 1:
        return interpolate_weather(tiles[0][1], timestamps)

    # Interpolate each tile to the full timeline once
    per_tile_df = [interpolate_weather(hourly, timestamps) for _, hourly in tiles]
    anchor_idx = np.array([i for i, _ in tiles], dtype=int)

    # For each sample, compute linear weights to the two nearest anchors
    sample_i = np.arange(n)
    # right-side anchor index for each sample
    right = np.searchsorted(anchor_idx, sample_i, side="right")
    right = np.clip(right, 1, len(anchor_idx) - 1)
    left = right - 1
    a_l = anchor_idx[left]
    a_r = anchor_idx[right]
    span = np.where(a_r > a_l, a_r - a_l, 1)
    w_r = np.clip((sample_i - a_l) / span, 0.0, 1.0)
    w_l = 1.0 - w_r

    # Blend the 5 weather columns using u/v decomposition for wind direction
    ws_l = per_tile_df[0]["wind_speed_ms"].to_numpy() * 0  # placeholder
    # Build by gather
    cols = ["wind_speed_ms", "wind_dir_deg", "temperature_c", "humidity_pct", "surface_pressure_hpa"]
    out = {}
    for c in cols:
        arr_l = np.empty(n)
        arr_r = np.empty(n)
        for j in range(n):
            arr_l[j] = per_tile_df[left[j]][c].iloc[j]
            arr_r[j] = per_tile_df[right[j]][c].iloc[j]
        if c == "wind_dir_deg":
            continue  # handled after via vector blend
        out[c] = w_l * arr_l + w_r * arr_r

    # Wind direction: vector blend
    def uv(ws, wd):
        u = -ws * np.sin(np.radians(wd))
        v = -ws * np.cos(np.radians(wd))
        return u, v

    ws_full = out["wind_speed_ms"]
    # recompute wind_dir via u/v from each tile
    wd_l = np.empty(n)
    wd_r = np.empty(n)
    ws_tmp_l = np.empty(n)
    ws_tmp_r = np.empty(n)
    for j in range(n):
        wd_l[j] = per_tile_df[left[j]]["wind_dir_deg"].iloc[j]
        wd_r[j] = per_tile_df[right[j]]["wind_dir_deg"].iloc[j]
        ws_tmp_l[j] = per_tile_df[left[j]]["wind_speed_ms"].iloc[j]
        ws_tmp_r[j] = per_tile_df[right[j]]["wind_speed_ms"].iloc[j]
    u_l, v_l = uv(ws_tmp_l, wd_l)
    u_r, v_r = uv(ws_tmp_r, wd_r)
    u_b = w_l * u_l + w_r * u_r
    v_b = w_l * v_l + w_r * v_r
    # overwrite wind_speed with the vector-blended magnitude (more consistent)
    out["wind_speed_ms"] = np.sqrt(u_b * u_b + v_b * v_b)
    out["wind_dir_deg"] = (np.degrees(np.arctan2(-u_b, -v_b)) + 360.0) % 360.0

    return pd.DataFrame(out)
