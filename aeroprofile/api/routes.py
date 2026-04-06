"""FastAPI routes."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from aeroprofile.api.schemas import AnalysisResultOut, AnomalyOut, ProfileData
from aeroprofile.pipeline import analyze

router = APIRouter()

MAX_PROFILE_POINTS = 5000


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
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".fit", ".gpx", ".tcx"):
        raise HTTPException(status_code=400, detail=f"Format non supporté : {ext}")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        result = await analyze(
            tmp_path,
            mass_kg=mass_kg,
            crr_fixed=crr_fixed,
            eta=eta,
            wind_height_factor=wind_height_factor,
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

    def _f(v, default=0.0):
        """NaN/Inf-safe float for JSON."""
        f = float(v) if v is not None else default
        if np.isnan(f) or np.isinf(f):
            return default
        return f

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
    )
