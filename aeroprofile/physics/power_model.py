"""Martin et al. (1998) cycling power model."""

from __future__ import annotations

import numpy as np

from aeroprofile.physics.constants import G, ETA_DEFAULT, WHEEL_INERTIA_EFFECTIVE_MASS


def eta_variable(P_total: np.ndarray, eta_base: float = ETA_DEFAULT) -> np.ndarray:
    """Power-dependent drivetrain efficiency.

    η increases slightly with load (chain tension more efficient at higher
    torque) and decreases at very low power (proportionally more friction).
    Based on Spicer et al. (2001) measurements:
      η ≈ 0.977 at 150 W (reference)
      η ≈ 0.960 at 50 W
      η ≈ 0.985 at 400 W

    Modelled as: η = eta_base + 0.00003 × (P - 150), clipped to [0.95, 0.99].
    """
    P_total = np.asarray(P_total, dtype=float)
    eta = eta_base + 0.00003 * (P_total - 150.0)
    return np.clip(eta, 0.95, 0.99)


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
    variable_eta: bool = True,
    cda_yaw_factor=None,
):
    """Modelled measured power (W). Vectorised, per Martin et al. 1998.

    P_rider × η = P_aero + P_rolling + P_gravity + P_accel + P_bearings
      P_aero      = 0.5 × CdA × ρ × V_air² × V_ground
      P_rolling   = Crr × m × g × cos(θ) × V_ground
      P_gravity   = m × g × sin(θ) × V_ground
      P_accel     = (m + I/r²) × a × V_ground         [I/r² ≈ 0.14 kg]
      P_bearings  = V × (91 + 8.7·V) × 1e-3           [wheel-bearing losses]

    When ``variable_eta`` is True (default), η is power-dependent per
    Spicer et al. (2001) rather than a fixed constant. This better
    models the chain's actual behaviour at low vs high loads.
    """
    V_ground = np.asarray(V_ground, dtype=float)
    V_air = np.asarray(V_air, dtype=float)
    gradient = np.asarray(gradient, dtype=float)
    acceleration = np.asarray(acceleration, dtype=float)
    rho = np.asarray(rho, dtype=float)

    theta = np.arctan(gradient)
    # If yaw correction factors are provided, CdA becomes per-point:
    # CdA_eff = CdA_0 × yaw_factor (where CdA_0 is the solver's estimate
    # and yaw_factor accounts for crosswind-induced drag increase).
    CdA_eff = CdA
    if cda_yaw_factor is not None:
        CdA_eff = CdA * np.asarray(cda_yaw_factor, dtype=float)
    P_aero = 0.5 * CdA_eff * rho * np.sign(V_air) * V_air * V_air * V_ground
    P_roll = Crr * mass * G * np.cos(theta) * V_ground
    P_grav = mass * G * np.sin(theta) * V_ground

    m_eff = mass + (WHEEL_INERTIA_EFFECTIVE_MASS if include_wheel_inertia else 0.0)
    P_accel = m_eff * acceleration * V_ground

    if include_bearings:
        P_bearings = V_ground * (91.0 + 8.7 * V_ground) * 1e-3
    else:
        P_bearings = 0.0

    P_total = P_aero + P_roll + P_grav + P_accel + P_bearings

    if variable_eta:
        return P_total / eta_variable(P_total, eta)
    return P_total / eta


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
    cda_yaw_factor=None,
):
    """Residuals vector (P_model − P_measured) for scipy.optimize.least_squares."""
    CdA, Crr = params
    P_model = power_model(V_ground, V_air, gradient, acceleration, mass, CdA, Crr, rho, eta,
                          cda_yaw_factor=cda_yaw_factor)
    return P_model - np.asarray(P_measured, dtype=float)
