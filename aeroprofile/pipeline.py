"""Orchestrator: file → CdA/Crr analysis result."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

from aeroprofile.parsers.auto_parser import parse_file, validate_ride
from aeroprofile.parsers.models import RideData
from aeroprofile.physics.air_density import compute_rho
from aeroprofile.physics.constants import ETA_DEFAULT
from aeroprofile.physics.wind import compute_bearing_series, compute_v_air, compute_yaw_angle, cda_yaw_correction
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
from aeroprofile.solver.wind_inverse import solve_with_wind
from aeroprofile.anomaly.calibration_check import detect_anomalies, Anomaly
from aeroprofile.physics.power_model import power_model
from aeroprofile.bike_types import get_bike_config


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
    rmse_w: float = 0.0  # RMSE of power residuals in watts
    mae_w: float = 0.0   # mean absolute error in watts
    weather_ok: bool = True  # False if weather API failed → fallback no-wind
    # Quality gate (set at the very end of analyze()):
    #   "ok"               : the estimate is usable
    #   "bound_hit"        : solver hit a CdA or Crr bound → degenerate solution
    #   "non_identifiable" : Hessian sigma on CdA > 0.05 → model can't separate params
    #   "high_nrmse"       : nRMSE > 60% → model fails to fit power
    # These rides should be excluded from any aggregation. The reason is exposed
    # to the UI so the user knows WHY a ride was dropped.
    quality_status: str = "ok"
    quality_reason: str = ""
    # Adaptive prior & raw MLE display
    prior_adaptive_factor: float = 1.0  # >1 si prior renforcé (données bruitées)
    cda_raw: Optional[float] = None     # MLE pur sans prior (for dual display)
    cda_raw_ci_low: Optional[float] = None
    cda_raw_ci_high: Optional[float] = None
    weather_source: str = "unknown"     # open_meteo_tiled | open_meteo_centroid | fallback_no_wind | device_only
    # Power meter (if known — filled by callers that have access to it)
    power_meter_raw: Optional[str] = None       # as reported by Intervals / FIT
    power_meter_display: Optional[str] = None   # user-friendly label
    power_meter_quality: str = "unknown"        # high | medium | low | unknown
    power_meter_warning: str = ""               # localized warning text, empty if none
    gear_id: Optional[str] = None               # Intervals.icu bike id (stable across rides)
    gear_name: Optional[str] = None             # User-set name if any
    # Power meter bias ratio: mean(measured) / mean(theoretical) on flat-pedaling
    # portions, using the bike-type prior (CdA, Crr) as reference. >1.35 strongly
    # suggests a mis-calibrated sensor. None = not enough flat-pedaling points.
    power_bias_ratio: Optional[float] = None
    power_bias_n_points: int = 0


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

    # 5-second centred rolling mean on power (Martin et al. 1998 recommend
    # smoothing on the order of pedal-stroke duration to damp per-stroke
    # torque oscillation; 5 s also matches the quasi-steady-state assumption
    # of the forward model). Keeps the raw column for reference.
    p_raw = df["power"].to_numpy()
    p_smooth = (
        pd.Series(p_raw)
        .rolling(window=5, center=True, min_periods=1)
        .mean()
        .to_numpy()
    )
    df["power_raw"] = p_raw
    df["power"] = p_smooth

    # Smooth altitude (Savitzky-Golay)
    win = min(31, n if n % 2 == 1 else n - 1)
    if win >= 5:
        poly = min(3, win - 1)
        alt_smooth = savgol_filter(df["altitude"].to_numpy(), window_length=win, polyorder=poly)
    else:
        alt_smooth = df["altitude"].to_numpy().copy()

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


async def preprocess(
    filepath: str | Path,
    mass_kg: float,
    eta: float = ETA_DEFAULT,
    wind_height_factor: float = 0.7,
    fetch_wx: bool = True,
    tiled_weather: bool = True,
    drop_descents: bool = True,
    min_block_seconds: int = 60,
) -> tuple[pd.DataFrame, RideData, bool]:
    """Run only the preprocessing steps of the pipeline (no solver).

    Returns (df, ride, weather_ok). The df contains all the columns needed
    by the solvers (v_ground, v_air, rho, power, dt, altitude_smooth,
    filter_valid, etc.) but no CdA/Crr estimates.

    Used by the hierarchical batch endpoint to avoid duplicating the
    parsing/weather/filters logic.
    """
    ride = parse_file(filepath)
    validate_ride(ride)

    df = _ride_to_df(ride)
    df = _compute_derivatives(df)

    # Weather
    lat_c = float(df["lat"].mean())
    lon_c = float(df["lon"].mean())
    # Use local date (approximated from longitude) rather than UTC date —
    # rides that start near midnight local time get the wrong Open-Meteo day
    # otherwise. 15° of longitude ≈ 1h offset.
    _tz_offset_h = int(round(lon_c / 15.0))
    ride_date = (df["timestamp"].iloc[0] + pd.Timedelta(hours=_tz_offset_h)).date()
    total_km = float(df["distance"].iloc[-1]) / 1000.0 if len(df) > 1 else 0.0

    def _no_wind_fallback():
        return pd.DataFrame({
            "wind_speed_ms": np.zeros(len(df)),
            "wind_dir_deg": np.zeros(len(df)),
            "temperature_c": df["temperature_pt"].fillna(15.0).to_numpy(),
            "humidity_pct": np.full(len(df), 50.0),
            "surface_pressure_hpa": np.full(len(df), 1013.25),
        })

    weather_ok = True
    weather_source = "fallback_no_wind"
    if fetch_wx:
        wx = None
        import os
        _max_tiles = int(os.environ.get("AEROPROFILE_MAX_TILES", "20"))
        _tile_km = float(os.environ.get("AEROPROFILE_TILE_KM", "5.0"))
        if tiled_weather and total_km > 15.0:
            try:
                tiles = await fetch_weather_tiled(
                    df["lat"].to_numpy(), df["lon"].to_numpy(), ride_date,
                    tile_km=_tile_km, max_tiles=_max_tiles,
                )
                if tiles:
                    wx = interpolate_tiled_weather(tiles, df["timestamp"].tolist())
                    weather_source = "open_meteo_tiled"
            except Exception as _e:
                import logging as _lg
                _lg.getLogger(__name__).warning("Tiled weather failed (lat=%.3f lon=%.3f date=%s): %s", lat_c, lon_c, ride_date, _e)
        if wx is None:
            try:
                hourly = await fetch_weather(lat_c, lon_c, ride_date)
                wx = interpolate_weather(hourly, df["timestamp"].tolist())
                weather_source = "open_meteo_centroid"
            except Exception as _e:
                import logging as _lg
                _lg.getLogger(__name__).warning("Centroid weather failed (lat=%.3f lon=%.3f date=%s): %s", lat_c, lon_c, ride_date, _e)
                wx = _no_wind_fallback()
                weather_ok = False
                weather_source = "fallback_no_wind"
    else:
        wx = _no_wind_fallback()
        weather_ok = False
        weather_source = "fallback_no_wind"

    df = pd.concat([df, wx], axis=1)

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
    df["yaw_deg"] = compute_yaw_angle(
        df["v_ground"].to_numpy(),
        df["bearing"].to_numpy(),
        df["wind_speed_ms"].to_numpy(),
        df["wind_dir_deg"].to_numpy(),
    )
    df["cda_yaw_factor"] = cda_yaw_correction(df["yaw_deg"].to_numpy())

    df = apply_filters(
        df,
        mass=mass_kg,
        min_block_seconds=min_block_seconds,
        drop_descents=drop_descents,
    )
    return df, ride, weather_ok


async def analyze(
    filepath: str | Path,
    mass_kg: float,
    crr_fixed: float | None = None,
    eta: float = ETA_DEFAULT,
    wind_height_factor: float = 0.7,
    fetch_wx: bool = True,
    tiled_weather: bool = True,
    drop_descents: bool = True,
    min_block_seconds: int = 60,
    bike_type: str | None = None,
    cda_prior_override: tuple[float, float] | None = None,
    disable_prior: bool = False,
    power_meter_name: str | None = None,
    gear_id: str | None = None,
    gear_name: str | None = None,
    benchmark_chung_ve: bool = False,
) -> AnalysisResult:
    bcfg = get_bike_config(bike_type)
    # Disable the CdA prior entirely (used in multi-ride mode where the
    # aggregation handles the regularization via inverse-variance weighting).
    # Without this, every ride would be shrunk toward the prior centre, and
    # the bias would persist through the aggregate average (Gelman BDA3 ch.5).
    if disable_prior:
        from aeroprofile.bike_types import BikeTypeConfig
        # Disable the soft Gaussian prior but KEEP the bike-type physical bounds.
        # Bounds are physical realism (no road cyclist has CdA<0.20 or >0.55),
        # not a consequence of the prior. Removing the bounds caused the solver
        # to diverge to the upper bound on noisy rides where CdA/Crr separation
        # is ambiguous.
        bcfg = BikeTypeConfig(
            label=bcfg.label,
            cda_prior_mean=0.0,
            cda_prior_sigma=0.0,
            cda_lower=bcfg.cda_lower,
            cda_upper=bcfg.cda_upper,
        )
    # Allow frontend position slider to override the CdA prior
    elif cda_prior_override is not None:
        mean, sigma = cda_prior_override
        if mean > 0 and sigma > 0:
            from aeroprofile.bike_types import BikeTypeConfig
            bcfg = BikeTypeConfig(
                label=bcfg.label,
                cda_prior_mean=mean,
                cda_prior_sigma=sigma,
                cda_lower=bcfg.cda_lower,
                cda_upper=bcfg.cda_upper,
            )

    ride = parse_file(filepath)
    validate_ride(ride)

    # If no explicit power_meter_name was passed (typical of the file-upload
    # path), try to extract it from the FIT device_info message. Silent fallback
    # to None if the file is not FIT or the metadata is missing (e.g. because
    # Intervals.icu re-encoded the file and stripped device_info).
    if power_meter_name is None and filepath is not None:
        try:
            _p = Path(filepath)
            if _p.suffix.lower() == ".fit":
                from aeroprofile.parsers.fit_parser import extract_power_meter
                power_meter_name = extract_power_meter(_p)
                if power_meter_name:
                    logger.info("POWER_METER_FIT extracted '%s' from %s", power_meter_name, _p.name)
        except Exception as _e:
            logger.debug("extract_power_meter failed: %s", _e)

    df = _ride_to_df(ride)
    df = _compute_derivatives(df)

    # Weather
    lat_c = float(df["lat"].mean())
    lon_c = float(df["lon"].mean())
    # Use local date (approximated from longitude) rather than UTC date —
    # rides that start near midnight local time get the wrong Open-Meteo day
    # otherwise. 15° of longitude ≈ 1h offset.
    _tz_offset_h = int(round(lon_c / 15.0))
    ride_date = (df["timestamp"].iloc[0] + pd.Timedelta(hours=_tz_offset_h)).date()
    total_km = float(df["distance"].iloc[-1]) / 1000.0 if len(df) > 1 else 0.0

    def _no_wind_fallback():
        return pd.DataFrame(
            {
                "wind_speed_ms": np.zeros(len(df)),
                "wind_dir_deg": np.zeros(len(df)),
                "temperature_c": df["temperature_pt"].fillna(15.0).to_numpy(),
                "humidity_pct": np.full(len(df), 50.0),
                "surface_pressure_hpa": np.full(len(df), 1013.25),
            }
        )

    weather_ok = True
    weather_source = "fallback_no_wind"
    if fetch_wx:
        wx = None
        import os
        _max_tiles = int(os.environ.get("AEROPROFILE_MAX_TILES", "20"))
        _tile_km = float(os.environ.get("AEROPROFILE_TILE_KM", "5.0"))
        if tiled_weather and total_km > 15.0:
            try:
                tiles = await fetch_weather_tiled(
                    df["lat"].to_numpy(), df["lon"].to_numpy(), ride_date,
                    tile_km=_tile_km, max_tiles=_max_tiles,
                )
                if tiles:
                    wx = interpolate_tiled_weather(tiles, df["timestamp"].tolist())
                    weather_source = "open_meteo_tiled"
            except Exception as _e:
                import logging as _lg
                _lg.getLogger(__name__).warning("Tiled weather failed (lat=%.3f lon=%.3f date=%s): %s", lat_c, lon_c, ride_date, _e)
        if wx is None:
            try:
                hourly = await fetch_weather(lat_c, lon_c, ride_date)
                wx = interpolate_weather(hourly, df["timestamp"].tolist())
                weather_source = "open_meteo_centroid"
            except Exception as _e:
                import logging as _lg
                _lg.getLogger(__name__).warning("Centroid weather failed (lat=%.3f lon=%.3f date=%s): %s", lat_c, lon_c, ride_date, _e)
                wx = _no_wind_fallback()
                weather_ok = False
                weather_source = "fallback_no_wind"
    else:
        wx = _no_wind_fallback()
        weather_ok = False
        weather_source = "fallback_no_wind"

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

    # Yaw angle and CdA yaw correction factor (Crouch et al. 2014)
    df["yaw_deg"] = compute_yaw_angle(
        df["v_ground"].to_numpy(),
        df["bearing"].to_numpy(),
        df["wind_speed_ms"].to_numpy(),
        df["wind_dir_deg"].to_numpy(),
    )
    df["cda_yaw_factor"] = cda_yaw_correction(df["yaw_deg"].to_numpy())

    # Filters
    df = apply_filters(
        df,
        mass=mass_kg,
        min_block_seconds=min_block_seconds,
        drop_descents=drop_descents,
    )

    # Check variety → maybe fix Crr
    insufficient, _msg = check_speed_variety(df[df["filter_valid"]]["v_ground"].to_numpy())
    effective_crr_fixed = crr_fixed
    if insufficient and crr_fixed is None:
        effective_crr_fixed = 0.005

    # --- Input stats log (before solver cascade) ---
    _valid_df = df[df["filter_valid"]]
    _n_valid = len(_valid_df)
    _n_total = len(df)
    if _n_valid > 20:
        _br = np.radians(_valid_df["bearing"].to_numpy())
        _hv_input = float(1.0 - np.sqrt(np.cos(_br).mean() ** 2 + np.sin(_br).mean() ** 2))
    else:
        _hv_input = float("nan")
    _speed_std = float(_valid_df["v_ground"].std()) if _n_valid > 1 else 0.0
    _avg_power_in = float(_valid_df["power"].mean()) if _n_valid > 0 else 0.0
    _avg_v_in = float(_valid_df["v_ground"].mean()) if _n_valid > 0 else 0.0
    _alt_in = _valid_df["altitude_smooth"].to_numpy() if _n_valid > 0 else np.array([0.0])
    _delev = np.diff(_alt_in, prepend=_alt_in[0])
    _elev_gain_in = float(np.sum(_delev[_delev > 0]))
    logger.info(
        "STATS %s: valid=%d/%d heading_var=%.2f v_std=%.2f m/s avg_v=%.1f m/s "
        "avg_P=%.0f W D+=%.0f m bike=%s eff_crr_fixed=%s weather=%s",
        Path(filepath).name if filepath else "<df>",
        _n_valid, _n_total, _hv_input, _speed_std, _avg_v_in, _avg_power_in,
        _elev_gain_in, bike_type,
        f"{effective_crr_fixed:.5f}" if effective_crr_fixed is not None else "None",
        weather_source,
    )

    # --- Solver cascade (option B) ---
    # We *only* run Martin LS when heading variance is too low for wind_inverse
    # to be meaningful (<0.25 = the ride is nearly a straight line, wind can't
    # be identified separately from CdA). On every other ride, wind_inverse is
    # the primary solver: it's more robust than Martin LS because it fits the
    # wind to the data instead of trusting the 10 km Open-Meteo grid. Chung VE
    # remains the last-resort fallback when neither of the above fits well.
    #
    # Before this gate, Martin LS was always tried first and almost always
    # discarded — on a real dataset, 134 Martin LS runs out of 306 returned
    # R² < 0, wasting ~200 ms per ride before wind_inverse took over.
    MARTIN_LS_MAX_HV = 0.25
    sol: SolverResult | None = None
    solver_method = ""
    solver_note = ""
    best_r2 = -float("inf")

    if _hv_input < MARTIN_LS_MAX_HV:
        logger.info("CASCADE try martin_ls (heading_var=%.2f < %.2f) ===", _hv_input, MARTIN_LS_MAX_HV)
        sol = solve_cda_crr(
            df, mass_kg, eta=eta, crr_fixed=effective_crr_fixed,
            cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
            cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper,
        )
        solver_method = "martin_ls"
        solver_note = (
            "Moindres carrés de Martin et al. (1998) avec prior faible sur Crr."
        )
        best_r2 = sol.r_squared
        logger.info("CASCADE martin_ls done: R²=%.3f", best_r2)
    else:
        logger.info(
            "CASCADE skipping martin_ls (heading_var=%.2f ≥ %.2f, wind_inverse first)",
            _hv_input, MARTIN_LS_MAX_HV,
        )

    # --- Wind-inverse solver: primary when heading varies enough ---
    # This jointly estimates (CdA, Crr, wind_per_segment) and typically
    # halves the RMSE because the wind is fitted to the data, not taken
    # from a 10 km weather grid. Requires heading_variance > 0.25.
    logger.info("CASCADE try wind_inverse ===")
    try:
        wi = solve_with_wind(
            df, mass=mass_kg, eta=eta, crr_fixed=effective_crr_fixed,
            cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
            cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper,
        )
        _wi_improves = (
            wi is not None
            and (sol is None or wi["r_squared"] > best_r2)
            and bcfg.cda_lower <= wi["cda"] <= bcfg.cda_upper
        )
        if _wi_improves:
            # Overwrite df's v_air with the wind-solved values for
            # downstream decomposition / virtual elevation.
            valid_mask = df["filter_valid"].to_numpy()
            v_air_full = df["v_air"].to_numpy().copy()
            v_air_full[valid_mask] = wi["v_air_solved"]
            df["v_air"] = v_air_full

            sol = SolverResult(
                cda=wi["cda"],
                crr=wi["crr"],
                cda_ci=wi.get("cda_ci", (float("nan"), float("nan"))),
                crr_ci=wi.get("crr_ci", (float("nan"), float("nan"))),
                r_squared=wi["r_squared"],
                residuals=wi["residuals"],
                n_points=wi["n_points"],
                crr_was_fixed=(effective_crr_fixed is not None),
                prior_adaptive_factor=float(wi.get("prior_adaptive_factor", 1.0)),
                cda_raw=wi.get("cda_raw"),
                cda_raw_ci=(
                    (wi.get("cda_raw_ci_low"), wi.get("cda_raw_ci_high"))
                    if wi.get("cda_raw") is not None else None
                ),
            )
            n_seg = wi["n_segments"]
            solver_method = "wind_inverse"
            solver_note = (
                f"Vent estimé conjointement avec CdA/Crr ({n_seg} segments "
                f"de vent). Le vent Open-Meteo servait de prior ; le solveur "
                f"l'a ajusté aux données (heading variance={wi['heading_variance']:.2f})."
            )
            best_r2 = wi["r_squared"]
            logger.info(
                "CASCADE wind_inverse WINS: CdA=%.3f Crr=%.5f R²=%.3f",
                wi["cda"], wi["crr"], best_r2,
            )
        elif wi is not None:
            logger.info(
                "CASCADE wind_inverse CdA=%.3f Crr=%.5f R²=%.3f — not selected",
                wi["cda"], wi["crr"], wi["r_squared"],
            )
        else:
            logger.info("CASCADE wind_inverse returned None (heading variance too low)")
    except Exception as _e:
        logger.warning("CASCADE wind_inverse raised: %s", _e)

    # --- Chung VE fallback: run when we have no solver result yet OR the
    # current one is poor (R² < 0.3). Runs unconditionally if sol is still
    # None (e.g. Martin LS was skipped AND wind_inverse returned None).
    # The benchmark_chung_ve flag (per-request from the UI, or via the
    # AEROPROFILE_BENCHMARK_SOLVERS=1 env var as a global default) also
    # runs Chung VE on every ride so the log can compare the two solvers
    # side-by-side. The result never replaces a winning wind_inverse —
    # it's diagnostic-only.
    import os as _os_bench
    _benchmark = (
        benchmark_chung_ve
        or _os_bench.environ.get("AEROPROFILE_BENCHMARK_SOLVERS") == "1"
    )
    if sol is None or best_r2 < 0.3 or _benchmark:
        logger.info(
            "CASCADE %s → try chung_ve ===",
            "no solver result yet" if sol is None else f"R²={best_r2:.3f} < 0.3",
        )
        try:
            chung = solve_chung_ve(
                df,
                mass=mass_kg,
                eta=eta,
                crr_fixed=effective_crr_fixed,
                cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
                cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper,
            )
            # In benchmark mode the Chung VE run is diagnostic-only: we log
            # its CdA/Crr/R² but never overwrite a winning wind_inverse.
            _chung_improves = (
                not _benchmark
                and bcfg.cda_lower <= chung.cda <= bcfg.cda_upper
                and (sol is None or chung.r_squared_elev > max(best_r2, 0.0))
            )
            if _chung_improves:
                sol = SolverResult(
                    cda=chung.cda,
                    crr=chung.crr,
                    cda_ci=chung.cda_ci,
                    crr_ci=chung.crr_ci,
                    r_squared=chung.r_squared_elev,
                    residuals=chung.residuals,
                    n_points=chung.n_points,
                    crr_was_fixed=(effective_crr_fixed is not None),
                    prior_adaptive_factor=float(getattr(chung, "prior_adaptive_factor", 1.0)),
                    cda_raw=getattr(chung, "cda_raw", None),
                    cda_raw_ci=getattr(chung, "cda_raw_ci", None),
                )
                solver_method = "chung_ve"
                solver_note = (
                    "Méthode Chung (Virtual Elevation) utilisée : les autres "
                    f"solveurs avaient R² < 0.3. R² reporté ici = qualité "
                    "de la reconstruction d'altitude."
                )
                logger.info(
                    "CASCADE chung_ve WINS: CdA=%.3f Crr=%.5f R²=%.3f",
                    chung.cda, chung.crr, chung.r_squared_elev,
                )
            elif _benchmark:
                # Benchmark comparison: both solvers ran, show both.
                logger.info(
                    "BENCHMARK chung_ve: CdA=%.3f Crr=%.5f R²=%.3f "
                    "(wind_inverse kept: CdA=%.3f R²=%.3f)",
                    chung.cda, chung.crr, chung.r_squared_elev,
                    sol.cda if sol else float("nan"),
                    best_r2,
                )
            else:
                logger.info(
                    "CASCADE chung_ve CdA=%.3f Crr=%.5f R²=%.3f — not selected",
                    chung.cda, chung.crr, chung.r_squared_elev,
                )
        except Exception as _e:
            logger.warning("CASCADE chung_ve raised: %s", _e)

    if sol is None:
        logger.error("CASCADE no solver succeeded")
        raise ValueError(
            "Aucun solveur n'a réussi à estimer le CdA sur cette sortie "
            "(toutes les méthodes ont échoué ou donné un résultat hors bornes). "
            "Vérifiez que la sortie contient assez de points valides, "
            "une puissance mesurée et une altitude cohérente."
        )

    logger.info("CASCADE final method=%s", solver_method)

    # Virtual elevation (pass 1)
    df["altitude_virtual"] = virtual_elevation(df, sol.cda, sol.crr, mass_kg, eta)

    ve_excluded_count = 0
    # --- Iterative refinement (hybrid): exclude points where VE diverges ---
    # Two complementary criteria:
    #   1. Drift RATE: d(drift)/dt is high → model is actively diverging
    #      (catches sudden local problems: drafting, wind shift, braking)
    #   2. Drift ABSOLUTE: |alt_virtual - alt_real| is very large → accumulated
    #      bias too big even if stable (catches systematic model failure)
    # A point is excluded if EITHER criterion fires.
    try:
        alt_real = df["altitude_smooth"].to_numpy()
        alt_virt = df["altitude_virtual"].to_numpy()
        alt_virt_aligned = alt_virt + (alt_real[0] - alt_virt[0])

        # --- Criterion 1: drift rate ---
        drift = alt_virt_aligned - alt_real
        drift_smooth = pd.Series(drift).rolling(window=30, center=True, min_periods=5).mean().to_numpy()
        drift_smooth = np.nan_to_num(drift_smooth, nan=0.0)
        dt_arr = df["dt"].to_numpy()
        d_drift = np.diff(drift_smooth, prepend=drift_smooth[0])
        dt_safe = np.where(dt_arr > 0, dt_arr, 1.0)
        drift_rate = np.abs(d_drift / dt_safe)
        drift_rate_smooth = pd.Series(drift_rate).rolling(window=60, center=True, min_periods=10).mean().to_numpy()
        drift_rate_smooth = np.nan_to_num(drift_rate_smooth, nan=0.0)

        _alt = df["altitude_smooth"].to_numpy()
        _dalt = np.diff(_alt, prepend=_alt[0])
        _dplus = float(np.sum(_dalt[_dalt > 0]))
        _duration = float((df["timestamp"].iloc[-1] - df["timestamp"].iloc[0]).total_seconds())
        _base_rate = _dplus / max(_duration, 1.0)
        drift_rate_threshold = max(0.10, _base_rate * 4.0)
        rate_ok = drift_rate_smooth <= drift_rate_threshold

        # --- Criterion 2: detrended drift (safety net) ---
        # A constant drift offset (e.g. from a past drafting episode that's
        # now over) is NOT a problem — the solver can absorb a global bias.
        # What IS a problem is when the drift deviates from its own trend,
        # meaning the model is locally wrong at that specific segment.
        # We fit a linear trend to the drift and flag points where the
        # residual exceeds a threshold.
        n_pts = len(drift_smooth)
        t_axis = np.arange(n_pts, dtype=float)
        # Robust linear fit (least-squares on the smoothed drift)
        valid_mask_for_fit = np.isfinite(drift_smooth)
        if valid_mask_for_fit.sum() > 10:
            coeffs = np.polyfit(t_axis[valid_mask_for_fit], drift_smooth[valid_mask_for_fit], 1)
            drift_trend = np.polyval(coeffs, t_axis)
        else:
            drift_trend = np.zeros(n_pts)
        drift_detrended = np.abs(drift_smooth - drift_trend)
        drift_detrended_smooth = pd.Series(drift_detrended).rolling(window=60, center=True, min_periods=10).mean().to_numpy()
        drift_detrended_smooth = np.nan_to_num(drift_detrended_smooth, nan=0.0)
        # Threshold: proportional to D+, with a minimum floor
        drift_detrend_threshold = max(40.0, _dplus * 0.08)
        abs_ok = drift_detrended_smooth <= drift_detrend_threshold

        # Exclude if EITHER criterion fires
        filter_ve_ok = rate_ok & abs_ok

        # Combine with existing filter_valid
        valid_pass1 = df["filter_valid"].to_numpy()
        valid_pass2 = valid_pass1 & filter_ve_ok
        # Only re-solve if we excluded a meaningful but not excessive fraction.
        # If >30% of valid points fail VE, the model is globally bad and
        # trimming won't help — it'd just remove most data.
        n_excluded_by_ve = int(valid_pass1.sum() - valid_pass2.sum())
        n_valid_pass1 = int(valid_pass1.sum())
        pct_excluded = n_excluded_by_ve / max(n_valid_pass1, 1)
        if pct_excluded > 0.30:
            # Too many points fail → skip refinement, keep pass-1 result
            n_excluded_by_ve = 0
        ve_excluded_count = n_excluded_by_ve
        n_valid_pass2 = int(valid_pass2.sum())
        if n_excluded_by_ve > 20 and n_valid_pass2 >= 100:
            # Temporarily swap filter_valid for the re-solve
            df["filter_valid_original"] = df["filter_valid"].copy()
            df["filter_valid"] = valid_pass2
            try:
                # Re-run the best solver from pass 1
                if solver_method == "wind_inverse":
                    wi2 = solve_with_wind(df, mass=mass_kg, eta=eta, crr_fixed=effective_crr_fixed,
                                          cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
                                          cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper)
                    if wi2 is not None and bcfg.cda_lower <= wi2["cda"] <= bcfg.cda_upper:
                        sol = SolverResult(
                            cda=wi2["cda"], crr=wi2["crr"],
                            cda_ci=wi2.get("cda_ci", (float("nan"), float("nan"))),
                            crr_ci=wi2.get("crr_ci", (float("nan"), float("nan"))),
                            r_squared=wi2["r_squared"],
                            residuals=wi2["residuals"],
                            n_points=wi2["n_points"],
                            crr_was_fixed=(effective_crr_fixed is not None),
                            prior_adaptive_factor=float(wi2.get("prior_adaptive_factor", 1.0)),
                            cda_raw=wi2.get("cda_raw"),
                            cda_raw_ci=(
                                (wi2.get("cda_raw_ci_low"), wi2.get("cda_raw_ci_high"))
                                if wi2.get("cda_raw") is not None else None
                            ),
                        )
                        solver_note += f" Passe 2 itérative : {n_excluded_by_ve} points exclus (dérive VE hybride : taux > {drift_rate_threshold:.2f} m/s ou écart detrended > {drift_detrend_threshold:.0f} m)."
                elif solver_method == "chung_ve":
                    chung2 = solve_chung_ve(df, mass=mass_kg, eta=eta, crr_fixed=effective_crr_fixed,
                                            cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
                                            cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper)
                    if bcfg.cda_lower <= chung2.cda <= bcfg.cda_upper:
                        sol = SolverResult(
                            cda=chung2.cda, crr=chung2.crr,
                            cda_ci=chung2.cda_ci, crr_ci=chung2.crr_ci,
                            r_squared=chung2.r_squared_elev,
                            residuals=chung2.residuals,
                            n_points=chung2.n_points,
                            crr_was_fixed=(effective_crr_fixed is not None),
                            prior_adaptive_factor=float(getattr(chung2, "prior_adaptive_factor", 1.0)),
                            cda_raw=getattr(chung2, "cda_raw", None),
                            cda_raw_ci=getattr(chung2, "cda_raw_ci", None),
                        )
                        solver_note += f" Passe 2 : {n_excluded_by_ve} pts exclus (dérive hybride)."
                else:
                    sol2 = solve_cda_crr(df, mass_kg, eta=eta, crr_fixed=effective_crr_fixed,
                                         cda_prior_mean=bcfg.cda_prior_mean, cda_prior_sigma=bcfg.cda_prior_sigma,
                                         cda_lower=bcfg.cda_lower, cda_upper=bcfg.cda_upper)
                    if bcfg.cda_lower <= sol2.cda <= bcfg.cda_upper:
                        sol = sol2
                        solver_note += f" Passe 2 : {n_excluded_by_ve} pts exclus (dérive hybride)."
            except Exception:
                pass
            # Store VE mask for altitude chart (grey zones)
            df["filter_ve_valid"] = valid_pass2
            # Restore original filter_valid (keep pass-2 sol but show all points in charts)
            df["filter_valid"] = df["filter_valid_original"]
            del df["filter_valid_original"]
            # Recompute virtual elevation with refined CdA/Crr
            df["altitude_virtual"] = virtual_elevation(df, sol.cda, sol.crr, mass_kg, eta)
    except Exception:
        pass

    # Recompute modelled power with final CdA/Crr (may have changed in pass 2)
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

    # CdA climb / descent / flat (diagnostic: big asymmetry hints at wind error)
    cda_climb = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: g > 0.02)
    cda_descent = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: g < -0.02)
    cda_flat = _subset_cda(df, mass_kg, eta, sol.crr, lambda g: abs(g) <= 0.02)

    # Heading variance (circular) — tells whether wind could be inverted
    valid = df[df["filter_valid"]]
    if len(valid) > 20:
        br = np.radians(valid["bearing"].to_numpy())
        R_ = np.sqrt(np.cos(br).mean() ** 2 + np.sin(br).mean() ** 2)
        heading_variance = float(1.0 - R_)  # 0 = one direction, 1 = uniform
    else:
        heading_variance = 0.0

    # Power-residual stats (independent of R² scaling; direct "typical error" in W)
    if len(valid) > 0:
        p_meas = valid["power"].to_numpy()
        p_model = valid["power_modeled"].to_numpy()
        res_w = p_model - p_meas
        rmse_w = float(np.sqrt(np.mean(res_w ** 2)))
        mae_w = float(np.mean(np.abs(res_w)))
    else:
        rmse_w = 0.0
        mae_w = 0.0

    # Rolling CdA (10 min window)
    window_s = 600
    df["cda_rolling"] = _rolling_cda(df, mass_kg, eta, window_s)

    # Anomalies
    anomalies = detect_anomalies(
        sol.cda, sol.crr, sol.cda_ci, sol.residuals, df, mass_kg, eta
    )

    # --- Quality gate ---
    # Mark the ride as unusable for aggregation if any of the following holds:
    #   1. CdA or Crr hit a bound (within 1% tolerance) → degenerate solution,
    #      the true minimum is outside the feasible box, the returned value is
    #      meaningless ("planched against the wall").
    #   2. Hessian sigma on CdA > 0.05 → likelihood is too flat, CdA and Crr
    #      cannot be separated on this ride. Any returned value is essentially
    #      one point on a degenerate manifold of equally-valid solutions.
    #   3. nRMSE on power > 60% → the model fails to reproduce the measured
    #      power; whatever CdA came out of the solver is fitted to noise.
    quality_status = "ok"
    quality_reason = ""

    cda_bound_tol = 0.005  # ~1% of the typical bike-type range
    if sol.cda <= bcfg.cda_lower + cda_bound_tol:
        quality_status = "bound_hit"
        quality_reason = f"Solveur bloqué à la borne inférieure CdA ({sol.cda:.3f} ≈ {bcfg.cda_lower:.2f}). Modèle non applicable sur cette sortie."
    elif sol.cda >= bcfg.cda_upper - cda_bound_tol:
        quality_status = "bound_hit"
        quality_reason = f"Solveur bloqué à la borne supérieure CdA ({sol.cda:.3f} ≈ {bcfg.cda_upper:.2f}). Modèle non applicable sur cette sortie."
    elif not sol.crr_was_fixed:
        # Crr bounds in the solvers are typically ~[0.0015, 0.012]
        if sol.crr <= 0.0016:
            quality_status = "bound_hit"
            # When a low-quality sensor (single-side crank) hits the Crr
            # lower bound, the solver is almost always compensating for a
            # measured power that reads too high — i.e. a missing
            # zero-offset. Give the user an actionable message in that case.
            from aeroprofile.power_meter_quality import classify_power_meter as _cpm
            _pmq = _cpm(power_meter_name).quality if power_meter_name else "unknown"
            if _pmq == "low":
                quality_reason = (
                    f"Solveur bloqué à la borne inférieure Crr ({sol.crr:.5f}). "
                    "**Cause probable sur ce capteur mono-jambe** : la puissance "
                    "mesurée est trop élevée par rapport à la physique — le "
                    "solveur tente de compenser en réduisant le roulement. "
                    "C'est généralement le symptôme d'un **zero-offset manquant "
                    "avant la sortie**. Pensez à lancer la calibration à chaque "
                    "départ sur ce type de capteur."
                )
            else:
                quality_reason = (
                    f"Solveur bloqué à la borne inférieure Crr ({sol.crr:.5f}). "
                    "Le solveur veut Crr<0.0015, physiquement impossible. "
                    "Cause probable : la puissance mesurée est sur-estimée "
                    "(biais capteur, drafting non détecté, ou vent arrière fort)."
                )
        elif sol.crr >= 0.0119:
            quality_status = "bound_hit"
            quality_reason = f"Solveur bloqué à la borne supérieure Crr ({sol.crr:.5f}). Le solveur veut Crr>0.012, physiquement impossible."

    if quality_status == "ok":
        cda_sigma_hess = (
            (sol.cda_ci[1] - sol.cda_ci[0]) / 3.92
            if (sol.cda_ci[0] is not None and sol.cda_ci[1] is not None
                and not (np.isnan(sol.cda_ci[0]) or np.isnan(sol.cda_ci[1])))
            else float("nan")
        )
        if not np.isnan(cda_sigma_hess) and cda_sigma_hess > 0.05:
            quality_status = "non_identifiable"
            quality_reason = (
                f"Modèle non-identifiable sur cette sortie (σ_CdA = {cda_sigma_hess:.3f} m², "
                f"IC95 trop large). Probablement vent mal estimé, drafting non détecté, "
                f"ou capteur de puissance déréglé."
            )

    # "Prior dominated" — the MLE pass (no prior) and the MAP pass (with prior)
    # disagree significantly. The data alone weren't informative enough to pin
    # down the CdA and the prior did most of the work. This is a softer warning
    # than non_identifiable: the solver converged, the Hessian is not
    # degenerate, but the point estimate is essentially the prior centre
    # dragged a bit toward the data. The frontend should keep the ride in
    # aggregates by default but display a ⓘ flag so the user knows.
    if quality_status == "ok" and sol.cda_raw is not None:
        _delta = abs(sol.cda_raw - sol.cda)
        # Threshold lowered from 0.10 to 0.05 after real-world observation:
        # at 0.10, non_identifiable always caught the ride first because a
        # prior that pulls the CdA by 0.10+ typically also widens σ_Hess
        # above 0.05. Capturing the 0.05-0.10 middle band identifies rides
        # where the prior moderately moved the estimate without the Hessian
        # going degenerate — these are still informative but the user
        # should know their CdA is partly the prior talking.
        if _delta > 0.05:
            quality_status = "prior_dominated"
            quality_reason = (
                f"Le prior a tiré le CdA de {sol.cda_raw:.3f} (MLE brut) à "
                f"{sol.cda:.3f} (avec prior). Écart Δ={_delta:.3f} — les données "
                "seules ne suffisaient pas à contraindre CdA/Crr, le résultat "
                "reflète en partie la position choisie dans le sélecteur. "
                "La ride reste comptée dans l'agrégat, mais son estimation "
                "individuelle est moins fiable."
            )

    # NOTE: No backend nRMSE gate. The frontend slider is the only nRMSE filter —
    # the user must stay in control of which rides to keep by quality percentile.
    # Backend gates only catch solver pathologies (bound_hit, non_identifiable).

    # --- Debug log per ride (solver diagnostics) ---
    _sigma_hess = (
        (sol.cda_ci[1] - sol.cda_ci[0]) / 3.92
        if (sol.cda_ci[0] is not None and sol.cda_ci[1] is not None
            and not (np.isnan(sol.cda_ci[0]) or np.isnan(sol.cda_ci[1])))
        else float("nan")
    )
    _ride_name = Path(filepath).name if filepath else "<from_df>"
    _nrmse_pct = (rmse_w / max(float(df["power"].mean()), 1.0)) * 100.0
    logger.info(
        "ANALYZE %s | %s | CdA=%.3f (raw=%s) σ_H=%.3f pf×%.2f | Crr=%.5f | "
        "bounds=[%.2f–%.2f] × [%.4f–%.4f] | nRMSE=%.0f%% | %s%s",
        _ride_name,
        solver_method,
        sol.cda,
        f"{sol.cda_raw:.3f}" if getattr(sol, "cda_raw", None) is not None else "—",
        _sigma_hess if not np.isnan(_sigma_hess) else -1.0,
        float(getattr(sol, "prior_adaptive_factor", 1.0)),
        sol.crr,
        bcfg.cda_lower, bcfg.cda_upper,
        0.0015, 0.012,
        _nrmse_pct,
        quality_status,
        f" — {quality_reason}" if quality_reason else "",
    )

    # Summary stats
    filter_summary = {name: int(df[name].sum()) for name in FILTER_NAMES}
    if ve_excluded_count > 0:
        filter_summary["filter_ve_drift"] = ve_excluded_count
    alt = df["altitude_smooth"].to_numpy()
    dalt = np.diff(alt, prepend=alt[0])
    elev_gain = float(np.sum(dalt[dalt > 0]))
    duration = float((df["timestamp"].iloc[-1] - df["timestamp"].iloc[0]).total_seconds())

    # Power meter classification — logged for diagnostics
    from aeroprofile.power_meter_quality import classify_power_meter
    _pmi = classify_power_meter(power_meter_name)
    if power_meter_name:
        logger.info(
            "POWER_METER %s -> quality=%s category=%s",
            power_meter_name, _pmi.quality, _pmi.category,
        )

    # --- Power meter bias ratio (independent of the solver) ---
    # On the flat portions of the ride where the rider is actually pedaling,
    # compute the power predicted by the bike-type PRIOR (CdA_prior, Crr_default)
    # and compare it to the measured power. If the measured power is 35%+
    # higher than the theoretical one, the meter is almost certainly biased
    # high (stuck offset, bad zero-offset, temperature drift on 4iiii, …).
    #
    # This is a diagnostic signal independent of the solver's final CdA/Crr —
    # useful to flag a mis-calibrated sensor BEFORE the user trusts the result.
    power_bias_ratio: Optional[float] = None
    power_bias_n_points = 0
    try:
        _v = df[df["filter_valid"]]
        if len(_v) > 60:
            _flat_mask = np.abs(_v["gradient"].to_numpy()) < 0.02
            _pedal_mask = _v["power"].to_numpy() > 50.0
            _m = _flat_mask & _pedal_mask
            if _m.sum() >= 60:
                _cda_prior = (
                    bcfg.cda_prior_mean
                    if (bcfg.cda_prior_mean is not None and bcfg.cda_prior_mean > 0)
                    else 0.30
                )
                _crr_default = 0.005  # road tire reference
                _p_theo = power_model(
                    _v["v_ground"].to_numpy()[_m],
                    _v["v_air"].to_numpy()[_m],
                    _v["gradient"].to_numpy()[_m],
                    _v["acceleration"].to_numpy()[_m],
                    mass_kg, _cda_prior, _crr_default,
                    _v["rho"].to_numpy()[_m], eta,
                )
                _p_meas = _v["power"].to_numpy()[_m]
                # Robust mean: trim the 5% tails to ignore outliers
                _theo_mean = float(np.mean(_p_theo[(_p_theo > 20) & (_p_theo < 600)]))
                _meas_mean = float(np.mean(_p_meas[(_p_meas > 20) & (_p_meas < 600)]))
                if _theo_mean > 10:
                    power_bias_ratio = _meas_mean / _theo_mean
                    power_bias_n_points = int(_m.sum())
                    logger.info(
                        "POWER_BIAS ratio=%.2f (measured=%.0f W vs theoretical=%.0f W "
                        "on %d flat-pedaling points, CdA_prior=%.2f Crr=%.4f)",
                        power_bias_ratio, _meas_mean, _theo_mean, power_bias_n_points,
                        _cda_prior, _crr_default,
                    )
    except Exception as _e:
        logger.warning("Power bias ratio computation failed: %s", _e)

    return AnalysisResult(
        solver_method=solver_method,
        solver_note=solver_note,
        cda_climb=cda_climb,
        cda_descent=cda_descent,
        cda_flat=cda_flat,
        heading_variance=heading_variance,
        rmse_w=rmse_w,
        mae_w=mae_w,
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
        weather_ok=weather_ok,
        quality_status=quality_status,
        quality_reason=quality_reason,
        prior_adaptive_factor=float(getattr(sol, "prior_adaptive_factor", 1.0)),
        cda_raw=getattr(sol, "cda_raw", None),
        cda_raw_ci_low=(
            float(sol.cda_raw_ci[0]) if getattr(sol, "cda_raw_ci", None) is not None and sol.cda_raw_ci[0] is not None else None
        ),
        cda_raw_ci_high=(
            float(sol.cda_raw_ci[1]) if getattr(sol, "cda_raw_ci", None) is not None and sol.cda_raw_ci[1] is not None else None
        ),
        weather_source=weather_source,
        power_meter_raw=_pmi.raw_name,
        power_meter_display=_pmi.display,
        power_meter_quality=_pmi.quality,
        power_meter_warning=_pmi.warning,
        power_bias_ratio=power_bias_ratio,
        power_bias_n_points=power_bias_n_points,
        gear_id=gear_id,
        gear_name=gear_name,
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
        inst = np.where(np.abs(den) > 1e-3, num / den, np.nan)
    # Clip to physical range: CdA outside [0, 0.8] is noise, not signal.
    inst = np.where((inst >= 0) & (inst <= 0.8), inst, np.nan)

    # Rolling mean window_s seconds
    series = pd.Series(inst)
    # Use forward-fill for time-based: simple 600-sample window as proxy
    out = series.rolling(window=window_s, min_periods=max(30, window_s // 4)).mean().to_numpy()
    return out
