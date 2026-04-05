"""Physics model tests."""

import numpy as np
import pytest

from aeroprofile.physics.air_density import compute_rho
from aeroprofile.physics.power_model import power_model
from aeroprofile.physics.wind import compute_bearing, compute_v_air


def test_power_flat_no_wind():
    """Flat, no wind, 30 km/h, 80 kg → ~150–220 W."""
    P = power_model(
        V_ground=8.33, V_air=8.33, gradient=0, acceleration=0,
        mass=80, CdA=0.35, Crr=0.004, rho=1.2,
    )
    assert 140 < float(P) < 220


def test_power_climb():
    """8% climb, 12 km/h, 80 kg → gravity dominates → 200–280 W."""
    P = power_model(
        V_ground=3.33, V_air=3.33, gradient=0.08, acceleration=0,
        mass=80, CdA=0.35, Crr=0.004, rho=1.15,
    )
    assert 200 < float(P) < 280


def test_power_descent_negative():
    """Steep descent (-10%), modest speed (30 km/h) → gravity dominates → P < 0."""
    P = power_model(
        V_ground=8.33, V_air=8.33, gradient=-0.10, acceleration=0,
        mass=80, CdA=0.35, Crr=0.004, rho=1.2,
    )
    assert float(P) < 0


def test_headwind_increases_power():
    """20 km/h headwind → V_air up → power up >50%."""
    P_calm = power_model(8.33, 8.33, 0, 0, 80, 0.35, 0.004, 1.2)
    P_wind = power_model(8.33, 8.33 + 5.56, 0, 0, 80, 0.35, 0.004, 1.2)
    assert float(P_wind) > float(P_calm) * 1.5


def test_rho_sea_level():
    """Sea level, 15°C, 50% humidity → ρ ~1.22."""
    rho = float(compute_rho(0, 15, 50))
    assert 1.20 < rho < 1.24


def test_rho_altitude():
    """1500 m, 25°C, 50% humidity → ρ around ~0.98 (ISA)."""
    rho = float(compute_rho(1500, 25, 50))
    assert 0.95 < rho < 1.05


def test_rho_humidity_lowers_density():
    """Humid air is LESS dense than dry air (water vapour is lighter)."""
    dry = float(compute_rho(0, 25, 10))
    humid = float(compute_rho(0, 25, 90))
    assert humid < dry


def test_bearing_east():
    """From (0,0) to (0, 1°E) → bearing ~90°."""
    b = float(compute_bearing(0.0, 0.0, 0.0, 1.0))
    assert abs(b - 90.0) < 0.1


def test_bearing_north():
    """From equator going north → bearing ~0°."""
    b = float(compute_bearing(0.0, 0.0, 1.0, 0.0))
    assert abs(b - 0.0) < 0.1


def test_v_air_headwind():
    """Rider at 10 m/s north, wind 5 m/s from north → headwind → V_air > V_ground."""
    # wind blowing FROM north (dir=0), rider heading north (bearing=0) → headwind
    v = float(compute_v_air(10.0, 0.0, 5.0, 0.0, wind_height_factor=1.0))
    assert v > 10.0
    assert abs(v - 15.0) < 0.01


def test_v_air_tailwind():
    """Rider heading north, wind FROM south (dir=180) → tailwind."""
    v = float(compute_v_air(10.0, 0.0, 5.0, 180.0, wind_height_factor=1.0))
    assert v < 10.0
    assert abs(v - 5.0) < 0.01


def test_v_air_crosswind():
    """Pure crosswind → no effect on V_air magnitude."""
    v = float(compute_v_air(10.0, 0.0, 5.0, 90.0, wind_height_factor=1.0))
    assert abs(v - 10.0) < 0.01
