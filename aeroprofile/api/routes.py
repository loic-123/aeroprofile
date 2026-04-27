"""FastAPI routes."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import List

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from aeroprofile.api.schemas import (
    AnalysisResultOut, AnomalyOut, LapOut, PerLapResultOut, ProfileData,
    HierarchicalAnalysisOut, HierarchicalRideSummary,
)
from aeroprofile.pipeline import analyze, preprocess
from aeroprofile.solver.hierarchical import solve_hierarchical
from aeroprofile.bike_types import get_bike_config

_log = logging.getLogger(__name__)

router = APIRouter()

MAX_PROFILE_POINTS = 5000


def _f(v, default=0.0):
    """NaN/Inf-safe float for JSON."""
    f = float(v) if v is not None else default
    if np.isnan(f) or np.isinf(f):
        return default
    return f


def _downsample(arr, idx):
    return [None if (isinstance(v, float) and np.isnan(v)) else v for v in arr[idx].tolist()]


def _df_to_profile(df) -> ProfileData:
    n = len(df)
    if n > MAX_PROFILE_POINTS:
        idx = np.linspace(0, n - 1, MAX_PROFILE_POINTS).astype(int)
    else:
        idx = np.arange(n)

    def _safe(v):
        """Convert to JSON-safe float: NaN and Inf become None."""
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return f

    def col(name):
        a = df[name].to_numpy()
        return [_safe(v) for v in a[idx]]

    def colb(name):
        a = df[name].to_numpy()
        return [bool(v) for v in a[idx]]

    ve_valid = colb("filter_ve_valid") if "filter_ve_valid" in df.columns else None

    return ProfileData(
        distance_km=[float(v / 1000.0) for v in df["distance"].to_numpy()[idx]],
        altitude_real=col("altitude_smooth"),
        altitude_virtual=col("altitude_virtual"),
        cda_rolling=col("cda_rolling"),
        power_measured=col("power"),
        power_modeled=col("power_modeled"),
        p_aero=col("p_aero"),
        p_gravity=col("p_gravity"),
        p_rolling=col("p_rolling"),
        p_accel=col("p_accel"),
        wind_speed_ms=col("wind_speed_ms"),
        wind_dir_deg=col("wind_dir_deg"),
        rho=col("rho"),
        filter_valid=colb("filter_valid"),
        filter_ve_valid=ve_valid,
        lat=col("lat"),
        lon=col("lon"),
    )


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/analyze", response_model=AnalysisResultOut)
async def analyze_endpoint(
    file: UploadFile = File(...),
    mass_kg: float = Form(...),
    crr_fixed: float | None = Form(None),
    eta: float = Form(0.976),
    wind_height_factor: float = Form(0.7),
    bike_type: str = Form("road"),
    cda_prior_mean: float | None = Form(None),
    cda_prior_sigma: float | None = Form(None),
    disable_prior: bool = Form(False),
    manual_wind_ms: float | None = Form(None),
    manual_wind_dir_deg: float | None = Form(None),
    excluded_lap_indices: str | None = Form(None),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".fit", ".gpx", ".tcx"):
        raise HTTPException(status_code=400, detail=f"Format non supporté : {ext}")

    _log.info(
        "REQUEST /analyze file=%s mass=%.1fkg bike=%s crr_fixed=%s eta=%.3f "
        "wind_height=%.2f prior(mean=%s sigma=%s disable=%s)",
        file.filename, mass_kg, bike_type,
        f"{crr_fixed:.5f}" if crr_fixed is not None else "auto",
        eta, wind_height_factor,
        f"{cda_prior_mean:.3f}" if cda_prior_mean is not None else "None",
        f"{cda_prior_sigma:.3f}" if cda_prior_sigma is not None else "None",
        disable_prior,
    )

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    parsed_lap_idx: list[int] | None = None
    if excluded_lap_indices:
        try:
            parsed_lap_idx = [int(x) for x in excluded_lap_indices.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="excluded_lap_indices must be a comma-separated list of integers.")

    try:
        result = await analyze(
            tmp_path,
            mass_kg=mass_kg,
            crr_fixed=crr_fixed,
            eta=eta,
            wind_height_factor=wind_height_factor,
            bike_type=bike_type,
            cda_prior_override=(cda_prior_mean, cda_prior_sigma) if cda_prior_mean is not None else None,
            disable_prior=disable_prior,
            manual_wind_ms=manual_wind_ms,
            manual_wind_dir_deg=manual_wind_dir_deg,
            excluded_lap_indices=parsed_lap_idx,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        import traceback as _tb
        tb = _tb.format_exc()
        # Log to stderr for the hosting platform
        import sys as _sys
        print(tb, file=_sys.stderr, flush=True)
        # Return the last frame so the user sees where it blew up
        last_line = tb.strip().splitlines()[-1] if tb else str(e)
        # Also include the frame closest to our code
        frames = [ln for ln in tb.splitlines() if "aeroprofile" in ln and "site-packages" not in ln]
        frame_hint = frames[-1].strip() if frames else ""
        raise HTTPException(
            status_code=500,
            detail=f"Erreur d'analyse : {last_line} | at: {frame_hint}",
        )
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass

    return AnalysisResultOut(
        cda=_f(result.cda),
        cda_ci_low=_f(result.cda_ci[0]),
        cda_ci_high=_f(result.cda_ci[1]),
        crr=_f(result.crr),
        crr_ci_low=_f(result.crr_ci[0]),
        crr_ci_high=_f(result.crr_ci[1]),
        r_squared=_f(result.r_squared),
        crr_was_fixed=result.crr_was_fixed,
        solver_method=result.solver_method,
        solver_note=result.solver_note,
        cda_climb=_f(result.cda_climb) if result.cda_climb is not None else None,
        cda_descent=_f(result.cda_descent) if result.cda_descent is not None else None,
        cda_flat=_f(result.cda_flat) if result.cda_flat is not None else None,
        heading_variance=_f(result.heading_variance),
        rmse_w=_f(result.rmse_w),
        mae_w=_f(result.mae_w),
        weather_ok=result.weather_ok,
        quality_status=result.quality_status,
        quality_reason=result.quality_reason,
        prior_adaptive_factor=_f(result.prior_adaptive_factor),
        cda_raw=_f(result.cda_raw) if result.cda_raw is not None else None,
        cda_raw_ci_low=_f(result.cda_raw_ci_low) if result.cda_raw_ci_low is not None else None,
        cda_raw_ci_high=_f(result.cda_raw_ci_high) if result.cda_raw_ci_high is not None else None,
        weather_source=result.weather_source,
        power_meter_raw=result.power_meter_raw,
        power_meter_display=result.power_meter_display,
        power_meter_quality=result.power_meter_quality,
        power_meter_warning=result.power_meter_warning,
        power_bias_ratio=_f(result.power_bias_ratio) if result.power_bias_ratio is not None else None,
        power_bias_n_points=result.power_bias_n_points,
        chung_cda=_f(result.chung_cda) if result.chung_cda is not None else None,
        chung_cda_raw=_f(result.chung_cda_raw) if result.chung_cda_raw is not None else None,
        solver_cross_check_delta=_f(result.solver_cross_check_delta) if result.solver_cross_check_delta is not None else None,
        solver_confidence=result.solver_confidence,
        cda_delta_wind_plus_5pct=_f(result.cda_delta_wind_plus_5pct) if result.cda_delta_wind_plus_5pct is not None else None,
        cda_delta_wind_plus_30pct=_f(result.cda_delta_wind_plus_30pct) if result.cda_delta_wind_plus_30pct is not None else None,
        cda_delta_wind_minus_30pct=_f(result.cda_delta_wind_minus_30pct) if result.cda_delta_wind_minus_30pct is not None else None,
        wind_fragility=result.wind_fragility,
        cda_ci_broad_low=_f(result.cda_ci_broad_low) if result.cda_ci_broad_low is not None else None,
        cda_ci_broad_high=_f(result.cda_ci_broad_high) if result.cda_ci_broad_high is not None else None,
        gear_id=result.gear_id,
        gear_name=result.gear_name,
        ride_date=result.ride_date,
        ride_distance_km=result.ride_distance_km,
        ride_duration_s=result.ride_duration_s,
        ride_elevation_gain_m=result.ride_elevation_gain_m,
        avg_speed_kmh=result.avg_speed_kmh,
        avg_power_w=result.avg_power_w,
        avg_rho=result.avg_rho,
        avg_wind_speed_ms=result.avg_wind_speed_ms,
        avg_wind_dir_deg=result.avg_wind_dir_deg,
        source_format=result.source_format,
        total_points=result.total_points,
        valid_points=result.valid_points,
        filter_summary=result.filter_summary,
        anomalies=[AnomalyOut(**a.to_dict()) for a in result.anomalies],
        profile=_df_to_profile(result.df),
        laps=[LapOut(**lap) for lap in result.laps],
        per_lap=[PerLapResultOut(**pl) for pl in result.per_lap],
    )


@router.post("/analyze-batch", response_model=HierarchicalAnalysisOut)
async def analyze_batch_endpoint(
    files: List[UploadFile] = File(...),
    mass_kg: float = Form(...),
    crr_fixed: float | None = Form(None),
    eta: float = Form(0.977),
    bike_type: str = Form("road"),
    max_nrmse: float = Form(0.45),
):
    """Hierarchical (random-effects) joint analysis of N rides.

    Pre-processes each file (parse, weather, filters), then runs a single
    joint optimisation over all rides simultaneously: shared Crr,
    individual CdA_i constrained to follow N(mu, tau²). Returns the
    "annual average" CdA (mu) with its CI and the per-ride CdA_i.

    This is mathematically more rigorous than per-ride MLE + post-hoc
    averaging (DerSimonian & Laird 1986, Gelman BDA3 ch.5).
    """
    _log.info(
        "REQUEST /analyze-batch n_files=%d mass=%.1fkg bike=%s crr_fixed=%s eta=%.3f max_nrmse=%.2f",
        len(files), mass_kg, bike_type,
        f"{crr_fixed:.5f}" if crr_fixed is not None else "auto",
        eta, max_nrmse,
    )
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 fichiers requis pour le mode hiérarchique.")

    bcfg = get_bike_config(bike_type)

    # Pre-process each file: parse, weather, filters (no solver)
    all_dfs = []
    summaries = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in (".fit", ".gpx", ".tcx"):
            continue
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            content = await f.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)
        try:
            df, ride, _wx_ok = await preprocess(tmp_path, mass_kg=mass_kg, eta=eta)
            all_dfs.append((f.filename, df, ride))
        except Exception as e:
            summaries.append(HierarchicalRideSummary(
                label=f.filename or "unknown", cda=0.0, cda_sigma=0.0,
                r_squared=0.0, nrmse=0.0, avg_power_w=0.0, avg_speed_kmh=0.0,
                valid_points=0, ride_date="", excluded=True,
                exclusion_reason=f"Preprocessing failed: {e}",
            ))
        finally:
            try:
                tmp_path.unlink()
            except OSError:
                pass

    if len(all_dfs) < 2:
        raise HTTPException(status_code=422, detail="Moins de 2 fichiers valides après preprocessing.")

    # Joint hierarchical solve
    try:
        h_result = solve_hierarchical(
            [df for (_, df, _) in all_dfs],
            mass=mass_kg, eta=eta,
            crr_fixed=crr_fixed,
            cda_lower=bcfg.cda_lower if not bcfg.cda_prior_sigma == 0 else 0.10,
            cda_upper=bcfg.cda_upper if not bcfg.cda_prior_sigma == 0 else 0.80,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur du solveur hiérarchique : {e}")

    # Build per-ride summaries
    for i, (fname, df, ride) in enumerate(all_dfs):
        cda_i = h_result.per_ride_cda[i]
        sigma_i = h_result.per_ride_sigma[i]
        r2_i = h_result.per_ride_r2[i]
        valid = df[df["filter_valid"]]
        avg_p = float(valid["power"].mean()) if len(valid) > 0 else 0.0
        avg_v = float(valid["v_ground"].mean() * 3.6) if len(valid) > 0 else 0.0
        # Quick nRMSE estimate from R² (rough)
        nrmse_approx = max(0.0, 1.0 - r2_i)
        ride_date = df["timestamp"].iloc[0].date().isoformat() if len(df) > 0 else ""
        summaries.append(HierarchicalRideSummary(
            label=fname or f"ride_{i}",
            cda=_f(cda_i),
            cda_sigma=_f(sigma_i),
            r_squared=_f(r2_i),
            nrmse=_f(nrmse_approx),
            avg_power_w=_f(avg_p),
            avg_speed_kmh=_f(avg_v),
            valid_points=int(df["filter_valid"].sum()),
            ride_date=ride_date,
            excluded=False,
        ))

    return HierarchicalAnalysisOut(
        mu_cda=_f(h_result.mu_cda),
        mu_cda_ci_low=_f(h_result.mu_cda_ci[0]),
        mu_cda_ci_high=_f(h_result.mu_cda_ci[1]),
        tau=_f(h_result.tau),
        crr=_f(h_result.crr),
        crr_ci_low=_f(h_result.crr_ci[0]),
        crr_ci_high=_f(h_result.crr_ci[1]),
        n_rides=h_result.n_rides,
        n_points_total=h_result.n_points_total,
        n_eff=_f(h_result.n_eff),
        hksj_applied=bool(h_result.hksj_applied),
        rides=summaries,
    )
