"""Tests for the manual wind override path in ``pipeline.analyze``.

The user can supply ``manual_wind_ms`` + ``manual_wind_dir_deg`` when the
Open-Meteo API underestimates the true wind (documented ERA5 bias in
coastal / strong-wind zones, Jourdier 2020). The override replaces the
per-sample wind columns before v_air / yaw / VE are computed.

We verify:
  1. The override propagates into ``df["wind_speed_ms"]`` as the 10 m
     equivalent of the user value (back-converted via the log-law), so the
     downstream pipeline (which still applies the log-law) ends up at the
     user's rider-level value.
  2. The ``weather_source`` is tagged ``"manual_override"`` so the UI can
     signal it.
  3. Omitting one of the two fields leaves the API wind intact (the
     override requires *both* to be set).
"""

from __future__ import annotations

import asyncio
import math

import pytest

from aeroprofile.physics.wind import wind_log_law_scale
from aeroprofile.pipeline import analyze

FIXTURE = "tests/fixtures/loic/1h15_.fit"


def _run(**kwargs):
    return asyncio.run(analyze(FIXTURE, mass_kg=75.0, **kwargs))


def test_manual_wind_override_sets_10m_equiv_from_rider_value():
    """User supplies 10 m/s at rider height → df.wind_speed_ms stores the
    10 m equivalent (= 10 / log-law-scale), and weather_source flips."""
    rider_ms = 10.0
    dir_deg = 120.0
    result = _run(manual_wind_ms=rider_ms, manual_wind_dir_deg=dir_deg)

    expected_10m = rider_ms / wind_log_law_scale()
    ws_series = result.df["wind_speed_ms"].to_numpy()
    wd_series = result.df["wind_dir_deg"].to_numpy()

    assert math.isclose(ws_series[0], expected_10m, rel_tol=1e-3)
    assert ws_series.min() == pytest.approx(ws_series.max(), rel=1e-6), (
        "manual wind should be constant across the ride"
    )
    assert wd_series[0] == pytest.approx(dir_deg, abs=1e-6)
    assert result.weather_source == "manual_override"


def test_manual_wind_override_requires_both_fields():
    """Providing only speed OR only direction leaves the API wind in place."""
    # Baseline: API wind
    baseline = _run()
    api_ws_mean = float(baseline.df["wind_speed_ms"].mean())

    # Speed alone: override ignored
    r1 = _run(manual_wind_ms=10.0, manual_wind_dir_deg=None)
    assert r1.weather_source != "manual_override"
    assert float(r1.df["wind_speed_ms"].mean()) == pytest.approx(api_ws_mean, rel=1e-3)

    # Direction alone: override ignored
    r2 = _run(manual_wind_ms=None, manual_wind_dir_deg=180.0)
    assert r2.weather_source != "manual_override"
    assert float(r2.df["wind_speed_ms"].mean()) == pytest.approx(api_ws_mean, rel=1e-3)
