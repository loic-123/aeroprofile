"""Solver tests with synthetic data."""

import numpy as np
import pandas as pd

from aeroprofile.physics.power_model import power_model
from aeroprofile.solver.optimizer import solve_cda_crr


def _make_synthetic(cda_true=0.35, crr_true=0.004, n=1000, seed=42, noise_w=15):
    rng = np.random.default_rng(seed)
    # Speed 15–45 km/h → 4.17–12.5 m/s
    v = rng.uniform(4.17, 12.5, n)
    grad = rng.uniform(-0.03, 0.05, n)
    mass = 80.0
    rho = np.full(n, 1.2)
    v_air = v + rng.normal(0, 0.2, n)  # tiny wind noise
    accel = rng.normal(0, 0.1, n)
    P_true = power_model(v, v_air, grad, accel, mass, cda_true, crr_true, rho)
    P = P_true + rng.normal(0, noise_w, n)
    return pd.DataFrame(
        {
            "v_ground": v,
            "v_air": v_air,
            "gradient": grad,
            "acceleration": accel,
            "rho": rho,
            "power": P,
            "filter_valid": np.ones(n, dtype=bool),
        }
    )


def test_solver_synthetic_recovers_cda_crr():
    df = _make_synthetic(cda_true=0.35, crr_true=0.004, n=1500, noise_w=20)
    res = solve_cda_crr(df, mass=80.0)
    assert 0.315 <= res.cda <= 0.385
    assert 0.003 <= res.crr <= 0.005
    assert res.r_squared > 0.5


def test_solver_with_fixed_crr():
    df = _make_synthetic(cda_true=0.30, crr_true=0.005, n=800, noise_w=15)
    res = solve_cda_crr(df, mass=80.0, crr_fixed=0.005)
    assert abs(res.cda - 0.30) < 0.02
    assert res.crr_was_fixed is True
    assert res.crr == 0.005


def test_solver_different_cda():
    df = _make_synthetic(cda_true=0.25, crr_true=0.0035, n=1200, noise_w=10)
    res = solve_cda_crr(df, mass=75.0)
    assert abs(res.cda - 0.25) < 0.03
