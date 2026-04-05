"""Chung virtual-elevation method for visual validation."""

from __future__ import annotations

import numpy as np

from aeroprofile.physics.constants import G, ETA_DEFAULT


def virtual_elevation(df, CdA: float, Crr: float, mass: float, eta: float = ETA_DEFAULT):
    """Compute virtual elevation trace from the energy balance.

    If (CdA, Crr) are correct, virtual elevation should track the real trace.
    """
    n = len(df)
    v_elev = np.zeros(n)
    v = df["v_ground"].to_numpy()
    v_air = df["v_air"].to_numpy()
    rho = df["rho"].to_numpy()
    P = df["power"].to_numpy()
    dt = df["dt"].to_numpy() if "dt" in df.columns else np.ones(n)

    for i in range(1, n):
        dti = dt[i]
        if dti <= 0:
            v_elev[i] = v_elev[i - 1]
            continue
        E_input = P[i] * eta * dti
        E_aero = 0.5 * CdA * rho[i] * np.sign(v_air[i]) * v_air[i] * v_air[i] * v[i] * dti
        E_roll = Crr * mass * G * v[i] * dti
        E_accel = 0.5 * mass * (v[i] ** 2 - v[i - 1] ** 2)
        E_potential = E_input - E_aero - E_roll - E_accel
        delta_h = E_potential / (mass * G)
        v_elev[i] = v_elev[i - 1] + delta_h
    return v_elev
