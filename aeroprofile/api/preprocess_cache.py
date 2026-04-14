"""In-memory LRU cache for preprocessed ride DataFrames.

Both `/intervals/analyze-ride` and `/intervals/analyze-batch` preprocess the
same FIT file (parse → weather → filters). When the user runs a Method B
batch right after a Method A loop over the same rides, the batch endpoint
would otherwise re-download every FIT and re-hit Open-Meteo. We cache both
the raw bytes and the preprocessed tuple keyed by (athlete, activity, mass,
eta) so a warm batch takes ~seconds instead of minutes.

The cache is bounded (~200 rides), in-process, and safe under asyncio
concurrency (sets are atomic enough for our purposes).
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

_MAX_ENTRIES = 200

_fit_cache: "OrderedDict[str, bytes]" = OrderedDict()
_prep_cache: "OrderedDict[str, tuple[Any, Any, bool]]" = OrderedDict()


def _fit_key(athlete_id: str, activity_id: str) -> str:
    return f"{athlete_id}:{activity_id}"


def _prep_key(athlete_id: str, activity_id: str, mass_kg: float, eta: float) -> str:
    return f"{athlete_id}:{activity_id}:m{mass_kg:.2f}:e{eta:.4f}"


def get_fit(athlete_id: str, activity_id: str) -> bytes | None:
    k = _fit_key(athlete_id, activity_id)
    if k in _fit_cache:
        _fit_cache.move_to_end(k)
        return _fit_cache[k]
    return None


def put_fit(athlete_id: str, activity_id: str, data: bytes) -> None:
    k = _fit_key(athlete_id, activity_id)
    _fit_cache[k] = data
    _fit_cache.move_to_end(k)
    while len(_fit_cache) > _MAX_ENTRIES:
        _fit_cache.popitem(last=False)


def get_prep(athlete_id: str, activity_id: str, mass_kg: float, eta: float):
    k = _prep_key(athlete_id, activity_id, mass_kg, eta)
    if k in _prep_cache:
        _prep_cache.move_to_end(k)
        return _prep_cache[k]
    return None


def put_prep(athlete_id: str, activity_id: str, mass_kg: float, eta: float, value) -> None:
    k = _prep_key(athlete_id, activity_id, mass_kg, eta)
    _prep_cache[k] = value
    _prep_cache.move_to_end(k)
    while len(_prep_cache) > _MAX_ENTRIES:
        _prep_cache.popitem(last=False)
