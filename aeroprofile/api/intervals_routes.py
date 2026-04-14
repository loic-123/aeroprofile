"""FastAPI routes for Intervals.icu integration."""

from __future__ import annotations

import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, Query
from pydantic import BaseModel

from aeroprofile.intervals.client import IntervalsClient, BASE_URL
from aeroprofile.pipeline import analyze, preprocess
from aeroprofile.api.routes import _f, _df_to_profile
from aeroprofile.api.schemas import (
    AnalysisResultOut, AnomalyOut, ProfileData,
    HierarchicalAnalysisOut, HierarchicalRideSummary,
)
from aeroprofile.solver.hierarchical import solve_hierarchical
from aeroprofile.bike_types import get_bike_config

router = APIRouter()


class ConnectRequest(BaseModel):
    api_key: str
    athlete_id: str = "0"


class AthleteOut(BaseModel):
    id: str
    name: str
    weight_kg: float
    ftp: int


class ActivityOut(BaseModel):
    id: str
    name: str
    activity_type: str
    start_date: str
    distance_km: float
    moving_time_s: float
    elevation_gain_m: float
    average_watts: float
    has_power: bool
    indoor: bool


class ListActivitiesResponse(BaseModel):
    total: int
    filtered: int
    activities: list[ActivityOut]


@router.post("/connect", response_model=AthleteOut)
async def connect(req: ConnectRequest):
    """Validate API key and return athlete profile."""
    client = IntervalsClient(req.api_key, req.athlete_id)
    try:
        profile = await client.get_athlete()
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Connexion échouée : {e}. Vérifiez votre clé API et athlete ID.",
        )
    return AthleteOut(
        id=profile.id,
        name=profile.name,
        weight_kg=profile.weight_kg,
        ftp=profile.ftp,
    )


@router.post("/debug-athlete")
async def debug_athlete(req: ConnectRequest):
    """Debug: return raw athlete JSON from Intervals.icu API."""
    import httpx
    async with httpx.AsyncClient(
        timeout=30, auth=httpx.BasicAuth("API_KEY", req.api_key)
    ) as c:
        r = await c.get(f"{BASE_URL}/athlete/{req.athlete_id}")
        r.raise_for_status()
        return r.json()


@router.post("/list", response_model=ListActivitiesResponse)
async def list_activities(
    api_key: str = Form(...),
    athlete_id: str = Form("0"),
    oldest: str = Form(...),
    newest: str = Form(...),
):
    """List activities. Returns total count and only outdoor Rides with power."""
    client = IntervalsClient(api_key, athlete_id)
    try:
        all_acts = await client.list_activities(oldest, newest)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur API Intervals : {e}")

    # Server-side: keep only outdoor rides with power (always excluded otherwise)
    rides = [
        a for a in all_acts
        if a.activity_type in ("Ride", "GravelRide")
        and a.has_power
        and not a.indoor
    ]

    return ListActivitiesResponse(
        total=len(all_acts),
        filtered=len(rides),
        activities=[
            ActivityOut(
                id=a.id,
                name=a.name,
                activity_type=a.activity_type,
                start_date=a.start_date,
                distance_km=round(a.distance_m / 1000, 1),
                moving_time_s=a.moving_time_s,
                elevation_gain_m=a.total_elevation_gain_m,
                average_watts=a.average_watts,
                has_power=a.has_power,
                indoor=a.indoor,
            )
            for a in rides
        ],
    )


@router.post("/analyze-ride", response_model=AnalysisResultOut)
async def analyze_ride(
    api_key: str = Form(...),
    athlete_id: str = Form("0"),
    activity_id: str = Form(...),
    mass_kg: float = Form(...),
    crr_fixed: Optional[float] = Form(None),
    eta: float = Form(0.977),
    bike_type: str = Form("road"),
    cda_prior_mean: Optional[float] = Form(None),
    cda_prior_sigma: Optional[float] = Form(None),
    disable_prior: bool = Form(False),
):
    """Download a single activity .FIT and run the analysis pipeline."""
    client = IntervalsClient(api_key, athlete_id)
    try:
        fit_bytes = await client.download_fit(activity_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Téléchargement échoué : {e}")

    # Write to temp file for the pipeline
    with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
        tmp.write(fit_bytes)
        tmp_path = Path(tmp.name)

    try:
        result = await analyze(
            tmp_path,
            mass_kg=mass_kg,
            crr_fixed=crr_fixed,
            eta=eta,
            bike_type=bike_type,
            cda_prior_override=(cda_prior_mean, cda_prior_sigma) if cda_prior_mean is not None else None,
            disable_prior=disable_prior,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        import traceback, sys
        tb = traceback.format_exc()
        print(tb, file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=f"Analyse échouée : {e}")
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass

    return _build_analysis_out(result)


def _build_analysis_out(result):
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


@router.post("/analyze-batch", response_model=HierarchicalAnalysisOut)
async def analyze_batch_intervals(
    api_key: str = Form(...),
    athlete_id: str = Form("0"),
    activity_ids: str = Form(...),  # comma-separated list
    mass_kg: float = Form(...),
    crr_fixed: Optional[float] = Form(None),
    eta: float = Form(0.977),
    bike_type: str = Form("road"),
):
    """Hierarchical (random-effects) joint analysis of N Intervals.icu rides.

    Downloads each .FIT, pre-processes (parse, weather, filters), then runs
    a single joint optimisation over all rides simultaneously: shared Crr,
    individual CdA_i ~ N(mu, tau²). Returns the rider's "annual average"
    CdA (mu) with its CI and the per-ride CdA_i.
    """
    ids = [s.strip() for s in activity_ids.split(",") if s.strip()]
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 activity_ids requis.")

    bcfg = get_bike_config(bike_type)
    client = IntervalsClient(api_key, athlete_id)

    all_dfs: list[tuple[str, object, object]] = []
    summaries: list[HierarchicalRideSummary] = []
    for aid in ids:
        try:
            fit_bytes = await client.download_fit(aid)
        except Exception as e:
            summaries.append(HierarchicalRideSummary(
                label=aid, cda=0.0, cda_sigma=0.0, r_squared=0.0, nrmse=0.0,
                avg_power_w=0.0, avg_speed_kmh=0.0, valid_points=0,
                ride_date="", excluded=True, exclusion_reason=f"Download failed: {e}",
            ))
            continue
        with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
            tmp.write(fit_bytes)
            tmp_path = Path(tmp.name)
        try:
            df, ride, _wx_ok = await preprocess(tmp_path, mass_kg=mass_kg, eta=eta)
            all_dfs.append((aid, df, ride))
        except Exception as e:
            summaries.append(HierarchicalRideSummary(
                label=aid, cda=0.0, cda_sigma=0.0, r_squared=0.0, nrmse=0.0,
                avg_power_w=0.0, avg_speed_kmh=0.0, valid_points=0,
                ride_date="", excluded=True, exclusion_reason=f"Preprocessing failed: {e}",
            ))
        finally:
            try:
                tmp_path.unlink()
            except OSError:
                pass

    if len(all_dfs) < 2:
        raise HTTPException(status_code=422, detail="Moins de 2 rides valides après preprocessing.")

    try:
        h_result = solve_hierarchical(
            [df for (_, df, _) in all_dfs],
            mass=mass_kg, eta=eta, crr_fixed=crr_fixed,
            cda_lower=bcfg.cda_lower if bcfg.cda_prior_sigma != 0 else 0.10,
            cda_upper=bcfg.cda_upper if bcfg.cda_prior_sigma != 0 else 0.80,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur du solveur hiérarchique : {e}")

    for i, (aid, df, _ride) in enumerate(all_dfs):
        cda_i = h_result.per_ride_cda[i]
        sigma_i = h_result.per_ride_sigma[i]
        r2_i = h_result.per_ride_r2[i]
        valid = df[df["filter_valid"]]
        avg_p = float(valid["power"].mean()) if len(valid) > 0 else 0.0
        avg_v = float(valid["v_ground"].mean() * 3.6) if len(valid) > 0 else 0.0
        nrmse_approx = max(0.0, 1.0 - r2_i)
        ride_date = df["timestamp"].iloc[0].date().isoformat() if len(df) > 0 else ""
        summaries.append(HierarchicalRideSummary(
            label=aid,
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
        rides=summaries,
    )
