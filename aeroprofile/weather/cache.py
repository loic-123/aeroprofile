"""Weather cache: avoid re-fetching the same Open-Meteo data.

Caches by (lat_round, lon_round, date) with 0.01° resolution (~1 km).
Two layers:
  1. In-memory dict (fast, lost on restart)
  2. Disk JSON files in a temp directory (survives restarts within the same day)
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import date
from pathlib import Path

_mem_cache: dict[str, dict] = {}

_CACHE_DIR = Path(tempfile.gettempdir()) / "aeroprofile_weather_cache"


def _key(lat: float, lon: float, day: date | str) -> str:
    # Round to 0.01° (~1 km) so nearby tile anchors on the same grid cell
    # share the same cache entry
    lat_r = round(lat, 2)
    lon_r = round(lon, 2)
    day_s = day if isinstance(day, str) else day.isoformat()
    return f"{lat_r}_{lon_r}_{day_s}"


def get(lat: float, lon: float, day: date | str) -> dict | None:
    """Return cached hourly weather dict, or None if not cached."""
    k = _key(lat, lon, day)

    # 1. Memory
    if k in _mem_cache:
        return _mem_cache[k]

    # 2. Disk
    fp = _CACHE_DIR / f"{k}.json"
    if fp.exists():
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            _mem_cache[k] = data  # promote to memory
            return data
        except Exception:
            pass

    return None


def put(lat: float, lon: float, day: date | str, hourly: dict) -> None:
    """Store hourly weather dict in both memory and disk cache."""
    k = _key(lat, lon, day)
    _mem_cache[k] = hourly

    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        fp = _CACHE_DIR / f"{k}.json"
        fp.write_text(json.dumps(hourly), encoding="utf-8")
    except Exception:
        pass  # disk write failure is non-fatal


def cache_stats() -> dict:
    """Return cache statistics."""
    mem_count = len(_mem_cache)
    disk_count = 0
    try:
        if _CACHE_DIR.exists():
            disk_count = len(list(_CACHE_DIR.glob("*.json")))
    except Exception:
        pass
    return {"memory": mem_count, "disk": disk_count, "dir": str(_CACHE_DIR)}
