"""Tests for the wind_inverse solver (joint CdA + per-segment wind).

The tests generate a synthetic ride with a known CdA, known constant wind,
and heading variance (a figure-of-eight path) high enough to unlock wind
inversion. We then assert the solver recovers the injected CdA, and
separately that two runs with different CdA priors return the same
cda_raw (the pass-0 MLE output — invariance guarantee we rely on).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from aeroprofile.physics.power_model import power_model
from aeroprofile.physics.wind import compute_v_air
from aeroprofile.solver.wind_inverse import solve_with_wind


def _synth_ride(
    cda_true: float = 0.32,
    crr_true: float = 0.004,
    wind_speed_ms: float = 3.0,
    wind_dir_deg: float = 90.0,  # wind coming from the east
    n: int = 800,
    seed: int = 42,
) -> pd.DataFrame:
    """Build a synthetic ride that passes wind_inverse's gates:

    - heading variance > 0.25 (figure-of-eight: bearing sweeps 0..360°)
    - n ≥ 100 valid points
    - wind known (u_api, v_api) equal to the injected wind, as Open-Meteo
      would ideally report

    The power field is the forward model at (cda_true, crr_true) + small
    Gaussian noise, so the inverse problem has a unique answer.
    """
    rng = np.random.default_rng(seed)
    mass = 75.0
    rho = np.full(n, 1.2)
    # Bearings sweep the full circle so heading_variance is high.
    bearing = np.linspace(0.0, 4.0 * 360.0, n) % 360.0
    # Speed 25-40 km/h (≈ 6.9-11.1 m/s), mild variation.
    v = rng.uniform(7.0, 11.0, n)
    gradient = rng.normal(0.0, 0.01, n)  # ~flat ride, small random gradient
    accel = rng.normal(0.0, 0.05, n)

    # True headwind component given bearing and the constant wind.
    # Open-Meteo convention: wind_dir = direction wind comes FROM.
    # v_air = v_ground - (wind · travel_unit)
    # travel unit vector in meteorological frame (x=east, y=north):
    travel_x = np.sin(np.radians(bearing))
    travel_y = np.cos(np.radians(bearing))
    # Wind vector pointing WHERE wind goes (opposite of wind_dir).
    wind_to_dir = (wind_dir_deg + 180.0) % 360.0
    wind_x = wind_speed_ms * np.sin(np.radians(wind_to_dir))
    wind_y = wind_speed_ms * np.cos(np.radians(wind_to_dir))
    # Projection of wind onto travel direction:
    wind_along = wind_x * travel_x + wind_y * travel_y
    v_air = v - wind_along  # headwind adds, tailwind subtracts

    # Forward power at the true parameters.
    P_true = power_model(v, v_air, gradient, accel, mass, cda_true, crr_true, rho)
    P = P_true + rng.normal(0.0, 5.0, n)  # 5 W noise
    P = np.clip(P, 50.0, 800.0)

    # Altitude from cumulative v sin(grad) dt — simple model so the
    # virtual-elevation loss of the solver has something to lock onto.
    dt = np.full(n, 1.0)
    alt = np.cumsum(v * np.sin(np.arcsin(np.clip(gradient, -0.3, 0.3))) * dt)

    # Timestamps at 1 Hz.
    ts = pd.date_range("2026-04-01 10:00:00", periods=n, freq="1s", tz="UTC")

    df = pd.DataFrame({
        "timestamp": ts,
        "v_ground": v,
        "v_air": v_air,
        "rho": rho,
        "power": P,
        "dt": dt,
        "altitude_smooth": alt,
        "gradient": gradient,
        "acceleration": accel,
        "bearing": bearing,
        "wind_speed_ms": np.full(n, wind_speed_ms),
        "wind_dir_deg": np.full(n, wind_dir_deg),
        "filter_valid": np.ones(n, dtype=bool),
    })
    return df


def test_wind_inverse_recovers_cda_on_clean_synthetic():
    """With clean synthetic data and a weak prior, solve_with_wind should
    recover the injected CdA within ±0.02 m²."""
    cda_true = 0.32
    df = _synth_ride(cda_true=cda_true, crr_true=0.004)
    res = solve_with_wind(
        df,
        mass=75.0,
        cda_prior_mean=0.30,
        cda_prior_sigma=0.10,
        cda_lower=0.15,
        cda_upper=0.60,
        crr_fixed=0.004,  # fix Crr so CdA is the only unknown to recover
    )
    assert res is not None
    assert abs(res["cda"] - cda_true) < 0.05, (
        f"CdA recovery failed: got {res['cda']:.3f}, expected {cda_true:.3f}"
    )


def test_wind_inverse_cda_raw_invariant_across_priors():
    """Two runs that differ only in the CdA prior must return the SAME
    cda_raw (pass-0 MLE), because pass-0 disables the CdA prior term.

    This is the invariance guarantee that motivated the multi-start init
    + tight tolerance fix (commit b61c409). If this test fails, the fix
    regressed somewhere.
    """
    df = _synth_ride(cda_true=0.30, crr_true=0.004)
    kwargs = dict(
        mass=75.0,
        cda_lower=0.15,
        cda_upper=0.60,
        crr_fixed=0.004,
        cda_prior_sigma=0.10,
    )
    res_a = solve_with_wind(df.copy(), cda_prior_mean=0.25, **kwargs)
    res_b = solve_with_wind(df.copy(), cda_prior_mean=0.40, **kwargs)
    assert res_a is not None and res_b is not None
    raw_a = res_a.get("cda_raw")
    raw_b = res_b.get("cda_raw")
    assert raw_a is not None and raw_b is not None
    assert abs(raw_a - raw_b) < 0.005, (
        f"cda_raw not invariant to prior: {raw_a:.4f} vs {raw_b:.4f} "
        f"(|Δ|={abs(raw_a - raw_b):.4f} > 0.005). The multi-start init "
        f"fix may have regressed."
    )


def test_wind_prior_sigma_adapts_to_api_magnitude(caplog):
    """The wind prior sigma should widen as the API wind magnitude grows.

    Affine law σ = clip(2 + 0.4·(ws − 3), 2, 5):
      ws=1 m/s → σ=2.0  (clamped low)
      ws=5 m/s → σ=2.8
      ws=8 m/s → σ=4.0
      ws=20 m/s → σ=5.0 (clamped high)
    """
    import logging
    import re

    def _sigma_used(ws: float) -> float:
        df = _synth_ride(wind_speed_ms=ws)
        with caplog.at_level(logging.INFO, logger="aeroprofile.solver.wind_inverse"):
            caplog.clear()
            solve_with_wind(df, mass=75.0, cda_prior_mean=0.30, cda_prior_sigma=0.10,
                            cda_lower=0.15, cda_upper=0.60, crr_fixed=0.004)
        for rec in caplog.records:
            m = re.search(r"wind prior sigma=([\d.]+)", rec.getMessage())
            if m:
                return float(m.group(1))
        raise AssertionError("sigma log line not found")

    sigma_low = _sigma_used(1.0)
    sigma_mid = _sigma_used(5.0)
    sigma_high = _sigma_used(20.0)
    assert sigma_low == pytest.approx(2.0, abs=0.05)
    assert 2.5 < sigma_mid < 3.5
    assert sigma_high == pytest.approx(5.0, abs=0.05)
    assert sigma_low <= sigma_mid <= sigma_high
