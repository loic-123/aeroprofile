"""Orchestrator: file → CdA/Crr analysis result."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

from aeroprofile.parsers.auto_parser import parse_file, validate_ride
from aeroprofile.parsers.models import RideData
from aeroprofile.physics.air_density import compute_rho
from aeroprofile.physics.constants import ETA_DEFAULT
from aeroprofile.physics.wind import compute_bearing_series, compute_v_air
from aeroprofile.weather.open_meteo import fetch_weather
from aeroprofile.weather.interpolation import interpolate_weather
from aeroprofile.weather.tiled import fetch_weather_tiled, interpolate_tiled_weather
from aeroprofile.filters.segment_filter import apply_filters, FILTER_NAMES
from aeroprofile.solver.optimizer import (
    solve_cda_crr,
    check_speed_variety,
    SolverResult,
)
from aeroprofile.solver.chung_ve import solve_chung_ve, ChungResult
from aeroprofile.solver.virtual_elevation import virtual_elevation
from aeroprofile.anomaly.calibration_check import detect_anomalies, Anomaly
from aeroprofile.physics.power_model import power_model


@dataclass
class AnalysisResult:
    cda: float
    crr: float
    cda_ci: tuple[float, float]
    crr_ci: tuple[float, float]
    r_squared: float

    ride_date: str
    ride_distance_km: float
    ride_duration_s: float
    ride_elevation_gain_m: float
    avg_speed_kmh: float
    avg_power_w: float
    avg_rho: float
    avg_wind_speed_ms: float
    avg_wind_dir_deg: float
    source_format: str

    total_points: int
    valid_points: int
    filter_summary: dict

    anomalies: list[Anomaly] = field(default_factory=list)
    df: Optional[pd.DataFrame] = None  # full processed dataframe
    crr_was_fixed: bool = False
    solver_method: str = "martin_ls"  # "martin_ls" | "chung_ve"
    solver_note: str = ""
    cda_climb: Optional[float] = None
    cda_descent: Optional[float] = None
    cda_flat: Optional[float] = None
    heading_variance: float = 0.0  # circular variance of bearing (0-1)


def _ride_to_df(ride: RideData) -> pd.DataFrame:
    rows = []
    for p in ride.points:
        rows.append(
            {
                "timestamp": p.timestamp,
                "lat": p.latitude,
                "lon": p.longitude,
                "altitude": p.altitude,
                "v_ground": p.speed,
                "power": p.power,
                "distance": p.distance,
                "temperature_pt": p.temperature,
            }
        )
    df = pd.DataFrame(rows)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def _compute_derivatives(df: pd.DataFrame) -> pd.DataFrame:
    n = len(df)
    # dt
    dt = np.array(
        df["timestamp"].diff().dt.total_seconds().fillna(1.0).clip(lower=0.0).to_numpy(),
        dtype=float,
        copy=True,
    )
    if n > 1:
        dt[0] = dt[1]
    df["dt"] = dt

    # Smooth altitude (Savitzky-Golay)
    win = min(31, n if n % 2 == 1 else n - 1)
    if win >= 5:
        poly = min(3, win - 1)
        alt_smooth = savgol_filter(df["altitude"].to_numpy(), window_length=win, polyorder=poly)
    else:
        alt_smooth = df["altitude"].to_numpy()
    df["altitude_smooth"] = alt_smooth

    # Gradient = dalt / ddist
    ddist = df["distance"].diff().replace(0, np.nan).to_numpy()
    dalt = pd.Series(alt_smooth).diff().to_numpy()
    grad = dalt / ddist
    grad = np.clip(grad, -0.25, 0.25)
    grad = np.nan_to_num(grad, nan=0.0)
    df["gradient"] = grad

    # Smooth speed + acceleration
    win_v = min(7, n if n % 2 == 1 else n - 1)
    if win_v >= 3:
        poly_v = min(2, win_v - 1)
        v_smooth = savgol_filter(df["v_ground"].to_numpy(), window_length=win_v, polyorder=poly_v)
    else:
        v_smooth = df["v_ground"].to_numpy()
    dv = pd.Series(v_smooth).diff().to_numpy()
    dt_safe = np.where(dt > 0, dt, np.nan)
    accel = dv / dt_safe
    accel = np.clip(accel, -3.0, 3.0)
    accel = np.nan_to_num(accel, nan=0.0)
    df["acceleration"] = accel

    # Bearing
    df["bearing"] = compute_bearing_series(df["lat"].to_numpy(), df["lon"].to_numpy())
    return df


async def analyze(
    filepath: str | Path,
    mass_kg: float,
    crr_fixed: float | None = None,
    eta: float = ETA_DEFAULT,
    wind_height_factor: float = 0.7,
    fetch_wx: bool = True,
    tiled_weather: bool = True,
    drop_descents: bool = True,
    min_block_seconds: int = 30,
) -> AnalysisResult:
    ride = parse_file(filepath)
    validate_ride(ride)

    df = _ride_to_df(ride)
    df = _compute_derivatives(df)

    # Weather
    lat_c = float(df["lat"].mean())
    lon_c = float(df["lon"].mean())
    ride_date = df["timestamp"].iloc[0].date()
    total_km = float(df["distance"].iloc[-1]) / 1000.0 if len(df) > 1 else 0.0

    if fetch_wx:
        # Use tiled weather for rides > 15 km (otherwise one tile is enough)
        if tiled_weather and total_km > 15.0:
            try:
                tiles = await fetch_weather_tiled(
                    df["lat"].to_numpy(), df["lon"].to_numpy(), ride_date,
                    tile_km=5.0, max_tiles=6,
                )
                if tiles:
                    wx = interpolate_tiled_weather(tiles, df["timestamp"].tolist())
                else:
                    hourly = await fetch_weather(lat_c, lon_c, ride_date)
                    wx = interpolate_weather(hourly, df["timestamp"].tolist())
            except Exception:
                hourly = await fetch_weather(lat_c, lon_c, ride_date)
                wx = interpolate_weather(hourly, df["timestamp"].tolist())
        else:
            hourly = await fetch_weather(lat_c, lon_c, ride_date)
            wx = interpolate_weather(hourly, df["timestamp"].tolist())
    else:
        wx = pd.DataFrame(
            {
                "wind_speed_ms": np.zeros(len(df)),
                "wind_dir_deg": np.zeros(len(df)),
                "temperature_c": df["temperature_pt"].fillna(15.0).to_numpy(),
                "humidity_pct": np.full(len(df), 50.0),
                "surface_pressure_hpa": np.full(len(df), 1013.25),
            }
        )

    df = pd.concat([df, wx], axis=1)

    # Air speed and density
    df["v_air"] = compute_v_air(
        df["v_ground"].to_numpy(),
        df["bearing"].to_numpy(),
        df["wind_speed_ms"].to_numpy(),
        df["wind_dir_deg"].to_numpy(),
        wind_height_factor=wind_height_factor,
    )
    df["rho"] = compute_rho(
        df["altitude_smooth"].to_numpy(),
        df["temperature_c"].to_numpy(),
        df["humidity_pct"].to_numpy(),
        df["surface_pressure_hpa"].to_numpy(),
    )

    # Filters
    df = apply_filters(
        df,
        min_block_seconds=min_block_seconds,
        drop_descents=drop_descents,
    )

    # Check variety → maybe fix Crr
    insufficient, _msg = check_speed_variety(df[df["filter_valid"]]["v_ground"].to_numpy())
    effective_crr_fixed = crr_fixed
    if insufficient and crr_fixed is None:
        effective_crr_fixed = 0.005

    # Primary solver: Martin least-squares with weak Crr prior
    sol: SolverResult = solve_cda_crr(df, mass_kg, eta=eta, crr_fixed=effective_crr_fixed)
    solver_method = "martin_ls"
    solver_note = (
        "Moindres carrés de Martin et al. (1998) avec prior faible sur Crr."
    )

    # If the Martin fit is poor (noisy ride, descents, wind), try Chung's
    # Virtual-Elevation method, which integrates the energy balance and is
    # dramatically more robust on mountain rides. But ONLY swap if Chung's
    # own R² is better than Martin's.
    martin_r2 = sol.r_squared
    if sol.r_squared < 0.3:
        try:
            chung = solve_chung_ve(
                df,
                mass=mass_kg,
                eta=eta,
                crr_fixed=effective_crr_fixed,
            )
            if 0.15 <= chung.cda <= 0.55 and chung.r_squared_elev > max(martin_r2, 0.0):
                sol = SolverResult(
                    cda=chung.cda,
                    crr=chung.crr,
                    cda_ci=chung.cda_ci,
                    crr_ci=chung.crr_ci,
                    r_squared=chung.r_squared_elev,
                    residuals=chung.residuals,
                    n_points=chung.n_points,
                    crr_was_fixed=(effective_crr_fixed is not None),
                )
                solver_method = "chung_ve"
                solver_note = (
                    "Méthode Chung (Virtual Elevation) utilisée : Martin LS "
                    f"avait R²={martin_r2:.2f}. R² reporté ici = qualité "
                    "de la reconstruction d'altitude."
                )
        except Exception:
            pass

    # Modelled power on full df for decomposition
    df["power_modeled"] = power_model(
        df["v_ground"].to_numpy(),
        df["v_air"].to_numpy(),
        df["gradient"].to_numpy(),
        df["acceleration"].to_numpy(),
        mass_kg,
        sol.cda,
        sol.crr,
        df["rho"].to_numpy(),
        eta,
    )
    from aeroprofile.physics.constants import G as G_

    theta = np.arctan(df["gradient"].to_numpy())
    V = df["v_ground"].to_numpy()
    Va = df["v_air"].to_numpy()
    df["p_aero"] = 0.5 * sol.cda * df["rho"].to_numpy() * np.sign(Va) * Va * Va * V
    df["p_rolling"] = sol.crr * mass_kg * G_ * np.cos(theta) * V
    df["p_gravity"] = mass_kg * G_ * np.sin(theta) * V
    df["p_accel"] = mass_kg * df["acceleration"].to_numpy() * V

    # Virtual elevation
    df["altitude_virtual"] = virtual_elevation(df, sol.cda, sol.crr, mass_kg, eta)

    # CdA climb / descent / flat (diagnostic: big asymmetry hints at wind error)
    cda_climb = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: g > 0.02)
    cda_descent = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: g < -0.02)
    cda_flat = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: abs(g) <= 0.02)

    # Heading variance (circular) — tells whether wind could be inverted
    valid = df[df["filter_valid"]]
    if len(valid) > 20:
        br = np.radians(valid["bearing"].to_numpy())
        R = np.sqrt(np.cos(br).mean() ** 2 + np.sin(br).mean() ** 2)
        heading_variance = float(1.0 - R)  # 0 = one direction, 1 = uniform
    else:
        heading_variance = 0.0

    # Rolling CdA (10 min window)
    window_s = 600
    df["cda_rolling"] = _rolling_cda(df, mass_kg, eta, window_s)

    # Anomalies
    anomalies = detect_anomalies(
        sol.cda, sol.crr, sol.cda_ci, sol.residuals, df, mass_kg, eta
    )

    # Summary stats
    filter_summary = {name: int(df[name].sum()) for name in FILTER_NAMES}
    alt = df["altitude_smooth"].to_numpy()
    dalt = np.diff(alt, prepend=alt[0])
    elev_gain = float(np.sum(dalt[dalt > 0]))
    duration = float((df["timestamp"].iloc[-1] - df["timestamp"].iloc[0]).total_seconds())

    return AnalysisResult(
        solver_method=solver_method,
        solver_note=solver_note,
        cda_climb=cda_climb,
        cda_descent=cda_descent,
        cda_flat=cda_flat,
        heading_variance=heading_variance,
        cda=sol.cda,
        crr=sol.crr,
        cda_ci=sol.cda_ci,
        crr_ci=sol.crr_ci,
        r_squared=sol.r_squared,
        ride_date=ride_date.isoformat(),
        ride_distance_km=float(df["distance"].iloc[-1] / 1000.0),
        ride_duration_s=duration,
        ride_elevation_gain_m=elev_gain,
        avg_speed_kmh=float(df["v_ground"].mean() * 3.6),
        avg_power_w=float(df["power"].mean()),
        avg_rho=float(df["rho"].mean()),
        avg_wind_speed_ms=float(df["wind_speed_ms"].mean()),
        avg_wind_dir_deg=float(df["wind_dir_deg"].mean()),
        source_format=ride.source_format,
        total_points=len(df),
        valid_points=int(df["filter_valid"].sum()),
        filter_summary=filter_summary,
        anomalies=anomalies,
        df=df,
        crr_was_fixed=sol.crr_was_fixed,
    )


def _subset_cda(df: pd.DataFrame, mass: float, eta: float, crr: float, predicate) -> Optional[float]:
    """Re-solve CdA on a gradient-defined subset with Crr fixed.

    Returns None when the subset is too small or the solver fails. Used as a
    diagnostic: a 20%+ gap between climb and descent CdA points at an
    unmodelled bias (wind asymmetry, power-meter cadence/torque drift, or
    drivetrain η dependence on gradient).
    """
    from scipy.optimize import least_squares
    from aeroprofile.physics.power_model import residual_power

    sub = df[df["filter_valid"] & df["gradient"].apply(predicate)]
    if len(sub) < 40:
        return None
    V = sub["v_ground"].to_numpy()
    Va = sub["v_air"].to_numpy()
    grad = sub["gradient"].to_numpy()
    acc = sub["acceleration"].to_numpy()
    rho = sub["rho"].to_numpy()
    P = sub["power"].to_numpy()

    def res(x):
        return residual_power((x[0], crr), V, Va, grad, acc, mass, rho, P, eta)

    try:
        r = least_squares(res, x0=(0.30,), bounds=([0.10], [0.70]), method="trf")
        return float(r.x[0])
    except Exception:
        return None


def _rolling_cda(df: pd.DataFrame, mass: float, eta: float, window_s: int) -> np.ndarray:
    """Compute rolling CdA estimate over a time window (fast, Crr fixed at global estimate)."""
    from aeroprofile.physics.power_model import power_model as _pm
    from aeroprofile.physics.constants import G as _G

    n = len(df)
    out = np.full(n, np.nan)
    valid_mask = df["filter_valid"].to_numpy()
    ts = df["timestamp"].astype("int64").to_numpy() // 1_000_000_000
    V = df["v_ground"].to_numpy()
    Va = df["v_air"].to_numpy()
    grad = df["gradient"].to_numpy()
    acc = df["acceleration"].to_numpy()
    rho = df["rho"].to_numpy()
    P = df["power"].to_numpy()

    # Precompute denominator and numerator for instantaneous CdA solved as
    # CdA = 2 * (eta*P - Cr*mass*g*cos(theta)*V - mass*g*sin(theta)*V - mass*a*V) / (rho*V_air²*V)
    # then rolling mean over window_s seconds.
    theta = np.arctan(grad)
    Crr_typ = 0.005
    num = eta * P - Crr_typ * mass * _G * np.cos(theta) * V - mass * _G * np.sin(theta) * V - mass * acc * V
    den = 0.5 * rho * np.sign(Va) * Va * Va * V
    with np.errstate(divide="ignore", invalid="ignore"):
        inst = np.where((np.abs(den) > 1e-3) & valid_mask, num / den, np.nan)

    # Rolling mean window_s seconds
    series = pd.Series(inst)
    # Use forward-fill for time-based: simple 600-sample window as proxy
    out = series.rolling(window=window_s, min_periods=max(30, window_s // 4)).mean().to_numpy()
    return out
