"""Air density computation."""

from __future__ import annotations

import numpy as np


def compute_rho(
    altitude_m,
    temperature_celsius,
    humidity_percent=50.0,
    surface_pressure_hpa=None,
):
    """Compute air density (kg/m³). Scalar or array-in, array-out.

    Uses moist-air equation of state corrected for humidity (Magnus formula).
    If surface_pressure_hpa is provided (from weather data), use it directly;
    else fall back to the ISA pressure-altitude relation.
    """
    altitude_m = np.asarray(altitude_m, dtype=float)
    temperature_celsius = np.asarray(temperature_celsius, dtype=float)
    humidity_percent = np.asarray(humidity_percent, dtype=float)

    T_k = temperature_celsius + 273.15

    if surface_pressure_hpa is not None:
        P_atm = np.asarray(surface_pressure_hpa, dtype=float) * 100.0
    else:
        P_atm = 101325.0 * (1.0 - 0.0065 * altitude_m / 288.15) ** 5.2561

    e_sat = 611.2 * np.exp(17.67 * temperature_celsius / (temperature_celsius + 243.5))
    e = (humidity_percent / 100.0) * e_sat

    rho = (P_atm - 0.3783 * e) / (287.05 * T_k)
    return rho
