"""Martin et al. (1998) cycling power model."""

from __future__ import annotations

import numpy as np

from aeroprofile.physics.constants import G, ETA_DEFAULT, WHEEL_INERTIA_EFFECTIVE_MASS


def power_model(
    V_ground,
    V_air,
    gradient,
    acceleration,
    mass,
    CdA,
    Crr,
    rho,
    eta: float = ETA_DEFAULT,
    include_bearings: bool = True,
    include_wheel_inertia: bool = True,
):
    """Modelled measured power (W). Vectorised, per Martin et al. 1998.

    P_rider × η = P_aero + P_rolling + P_gravity + P_accel + P_bearings
      P_aero      = 0.5 × CdA × ρ × V_air² × V_ground
      P_rolling   = Crr × m × g × cos(θ) × V_ground
      P_gravity   = m × g × sin(θ) × V_ground
      P_accel     = (m + I/r²) × a × V_ground         [I/r² ≈ 0.14 kg]
      P_bearings  = V × (91 + 8.7·V) × 1e-3           [wheel-bearing losses]

    η defaults to 0.977 (Martin 1998). The wheel-inertia correction and
    bearing-loss term are Martin's explicit additions; both can be turned
    off for backward compatibility.
    """
    V_ground = np.asarray(V_ground, dtype=float)
    V_air = np.asarray(V_air, dtype=float)
    gradient = np.asarray(gradient, dtype=float)
    acceleration = np.asarray(acceleration, dtype=float)
    rho = np.asarray(rho, dtype=float)

    theta = np.arctan(gradient)
    P_aero = 0.5 * CdA * rho * np.sign(V_air) * V_air * V_air * V_ground
    P_roll = Crr * mass * G * np.cos(theta) * V_ground
    P_grav = mass * G * np.sin(theta) * V_ground

    m_eff = mass + (WHEEL_INERTIA_EFFECTIVE_MASS if include_wheel_inertia else 0.0)
    P_accel = m_eff * acceleration * V_ground

    if include_bearings:
        P_bearings = V_ground * (91.0 + 8.7 * V_ground) * 1e-3
    else:
        P_bearings = 0.0

    return (P_aero + P_roll + P_grav + P_accel + P_bearings) / eta


def residual_power(
    params,
    V_ground,
    V_air,
    gradient,
    acceleration,
    mass,
    rho,
    P_measured,
    eta: float = ETA_DEFAULT,
):
    """Residuals vector (P_model − P_measured) for scipy.optimize.least_squares."""
    CdA, Crr = params
    P_model = power_model(V_ground, V_air, gradient, acceleration, mass, CdA, Crr, rho, eta)
    return P_model - np.asarray(P_measured, dtype=float)
