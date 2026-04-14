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
    rides: list[HierarchicalRideSummary]
