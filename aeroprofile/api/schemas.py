"""Pydantic schemas for the AeroProfile API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AnomalyOut(BaseModel):
    severity: str
    code: str
    title: str
    message: str
    value: Optional[float] = None


class LapOut(BaseModel):
    index: int
    start_time: str
    end_time: str
    distance_m: float
    duration_s: float
    excluded: bool = False


class ProfileData(BaseModel):
    distance_km: list[float]
    altitude_real: list[float]
    altitude_virtual: list[float]
    cda_rolling: list[Optional[float]]
    power_measured: list[float]
    power_modeled: list[float]
    p_aero: list[float]
    p_gravity: list[float]
    p_rolling: list[float]
    p_accel: list[float]
    wind_speed_ms: list[float]
    wind_dir_deg: list[float]
    rho: list[float]
    filter_valid: list[bool]
    filter_ve_valid: Optional[list[bool]] = None
    lat: list[float]
    lon: list[float]


class AnalysisResultOut(BaseModel):
    cda: float
    cda_ci_low: float
    cda_ci_high: float
    crr: float
    crr_ci_low: float
    crr_ci_high: float
    r_squared: float
    crr_was_fixed: bool = False
    solver_method: str = "martin_ls"
    solver_note: str = ""
    cda_climb: Optional[float] = None
    cda_descent: Optional[float] = None
    cda_flat: Optional[float] = None
    heading_variance: float = 0.0
    rmse_w: float = 0.0
    mae_w: float = 0.0
    weather_ok: bool = True
    quality_status: str = "ok"
    quality_reason: str = ""
    prior_adaptive_factor: float = 1.0
    cda_raw: Optional[float] = None
    cda_raw_ci_low: Optional[float] = None
    cda_raw_ci_high: Optional[float] = None
    weather_source: str = "unknown"
    power_meter_raw: Optional[str] = None
    power_meter_display: Optional[str] = None
    power_meter_quality: str = "unknown"
    power_meter_warning: str = ""
    power_bias_ratio: Optional[float] = None
    power_bias_n_points: int = 0
    chung_cda: Optional[float] = None
    chung_cda_raw: Optional[float] = None
    solver_cross_check_delta: Optional[float] = None
    solver_confidence: str = "unknown"
    # How much the CdA moves when the Open-Meteo wind speed is inflated
    # by +5% (documented ERA5 bias on high winds). Null if the post-hoc
    # Chung VE pass failed. Signed value: + means stronger wind → higher
    # CdA, − means stronger wind → lower CdA.
    cda_delta_wind_plus_5pct: Optional[float] = None
    cda_delta_wind_plus_30pct: Optional[float] = None
    cda_delta_wind_minus_30pct: Optional[float] = None
    wind_fragility: str = "unknown"
    cda_ci_broad_low: Optional[float] = None
    cda_ci_broad_high: Optional[float] = None
    gear_id: Optional[str] = None
    gear_name: Optional[str] = None

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
    filter_summary: dict[str, int]

    anomalies: list[AnomalyOut]
    profile: ProfileData
    laps: list[LapOut] = []


class HierarchicalRideSummary(BaseModel):
    """Per-ride results in a hierarchical batch analysis."""
    label: str                       # filename or activity label
    cda: float
    cda_sigma: float
    r_squared: float
    nrmse: float
    avg_power_w: float
    avg_speed_kmh: float
    valid_points: int
    ride_date: str
    excluded: bool = False
    exclusion_reason: Optional[str] = None


class HierarchicalAnalysisOut(BaseModel):
    """Result of a hierarchical multi-ride analysis."""
    mu_cda: float                    # main parameter: mean CdA across rides
    mu_cda_ci_low: float
    mu_cda_ci_high: float
    tau: float                        # inter-ride standard deviation
    crr: float
    crr_ci_low: float
    crr_ci_high: float
    n_rides: int
    n_points_total: int
    # Effective sample size from random-effects weights = (Σ w_i)² / Σ w_i².
    # Equals n_rides when all per-ride σ_i are identical, drops below when
    # one or two rides dominate. Lets the UI flag a "Méthode hiérarchique"
    # estimate that's actually being driven by a small subset.
    n_eff: float = 0.0
    # True when the Hartung–Knapp–Sidik–Jonkman small-k IC95 correction
    # was applied (always for n_rides < 10, standard Gaussian otherwise).
    hksj_applied: bool = False
    rides: list[HierarchicalRideSummary]
