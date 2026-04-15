"""FastAPI routes for Intervals.icu integration."""

from __future__ import annotations

import logging
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
from aeroprofile.api import preprocess_cache as _pp_cache

_log = logging.getLogger(__name__)

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
    # Sensor metadata — lets the frontend filter the candidate list by
    # power meter before spending time analysing each ride.
    power_meter: Optional[str] = None
    gear_id: Optional[str] = None
    gear_name: Optional[str] = None


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
                power_meter=a.power_meter,
                gear_id=a.gear_id,
                gear_name=a.gear_name,
            )
            for a in rides
        ],
    )


class SessionLogPayload(BaseModel):
    """Arbitrary session-start metadata dump — used by the frontend to
    record every user-facing parameter at the start of an analysis run
    so the session log carries full context without threading each
    parameter through the per-ride endpoint.

    The frontend POSTs this once before calling /analyze-ride in a loop.
    """
    profile_key: Optional[str] = None
    profile_name: Optional[str] = None
    mode: str = "intervals"
    mass_kg: Optional[float] = None
    bike_type: Optional[str] = None
    position_label: Optional[str] = None
    crr_fixed: Optional[float] = None
    cda_prior_mean: Optional[float] = None
    cda_prior_sigma: Optional[float] = None
    max_nrmse: Optional[float] = None
    # Ride filters (Intervals)
    oldest: Optional[str] = None
    newest: Optional[str] = None
    min_distance_km: Optional[float] = None
    max_distance_km: Optional[float] = None
    max_elevation_m: Optional[float] = None
    max_elevation_per_km: Optional[float] = None
    min_duration_h: Optional[float] = None
    exclude_group: Optional[bool] = None
    # Post-filter results
    n_candidates: Optional[int] = None  # rides matching filters
    n_selected: Optional[int] = None    # after sensor filter etc
    sensor_filter: Optional[list[str]] = None  # e.g. ['FAVERO_ELECTRONICS 22']
    # Post-analysis UI filters that shape which rides contribute to the
    # aggregate. Logged here so the session log carries the full context
    # the user was looking at, even for soft filters that don't affect
    # individual ride analysis.
    min_confidence: Optional[str] = None  # "off" | "medium" | "high"
    use_cache: Optional[bool] = None
    ignored_entries_count: Optional[int] = None  # history entries hidden from charts


@router.post("/log-session")
async def log_session(payload: SessionLogPayload):
    """Dump a session-start metadata block to the log. Called once by the
    frontend before launching an analysis loop so the log contains the
    full context (profile, filters, sensor selection, ...) alongside
    the per-ride ANALYZE lines.

    Side effect: rotates the backend log file so each user analysis run
    lands in its own session_<timestamp>_<tag>.log — no more interleaved
    runs in a single file. The tag uses the profile name (sanitised) so
    the filename is human-searchable."""
    try:
        from aeroprofile.api.app import rotate_session_log
        tag = (payload.profile_name or payload.profile_key or "").replace(" ", "_")
        rotate_session_log(tag=tag)
    except Exception as _e:
        _log.warning("Session log rotation failed: %s", _e)

    _log.info(
        "SESSION_START profile='%s'(%s) mode=%s mass=%s bike=%s pos='%s' "
        "crr=%s prior=(%s,%s) maxNrmse=%s "
        "dates=[%s..%s] dist=[%s..%s]km D+<%sm D+/km<%s dur>%sh excl_group=%s "
        "n_cand=%s n_sel=%s sensors=%s "
        "| ui_filters: min_confidence=%s use_cache=%s ignored_entries=%s",
        payload.profile_name, payload.profile_key, payload.mode,
        payload.mass_kg, payload.bike_type, payload.position_label,
        payload.crr_fixed, payload.cda_prior_mean, payload.cda_prior_sigma,
        payload.max_nrmse,
        payload.oldest, payload.newest,
        payload.min_distance_km, payload.max_distance_km,
        payload.max_elevation_m, payload.max_elevation_per_km, payload.min_duration_h,
        payload.exclude_group,
        payload.n_candidates, payload.n_selected,
        ",".join(payload.sensor_filter) if payload.sensor_filter else "all",
        payload.min_confidence or "off",
        payload.use_cache if payload.use_cache is not None else "unset",
        payload.ignored_entries_count if payload.ignored_entries_count is not None else "unset",
    )
    return {"status": "ok"}


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
    _log.info(
        "REQUEST /intervals/analyze-ride activity_id=%s mass=%.1fkg bike=%s "
        "crr_fixed=%s eta=%.3f prior(mean=%s sigma=%s disable=%s)",
        activity_id, mass_kg, bike_type,
        f"{crr_fixed:.5f}" if crr_fixed is not None else "auto",
        eta,
        f"{cda_prior_mean:.3f}" if cda_prior_mean is not None else "None",
        f"{cda_prior_sigma:.3f}" if cda_prior_sigma is not None else "None",
        disable_prior,
    )
    client = IntervalsClient(api_key, athlete_id)

    # Fetch the activity metadata first — gives us power_meter, crank_length,
    # etc. so the pipeline can classify the sensor quality. Failure is
    # non-fatal: we still run the analysis, just without the warning banner.
    pm_name: Optional[str] = None
    gear_id: Optional[str] = None
    gear_name: Optional[str] = None
    try:
        meta = await client.get_activity_meta(activity_id)
        pm_name = meta.get("power_meter") or None
        gear = meta.get("gear") if isinstance(meta.get("gear"), dict) else {}
        if gear:
            gear_id = gear.get("id") or None
            gear_name = gear.get("name") or None
    except Exception as _e:
        _log.warning("Could not fetch activity metadata for %s: %s", activity_id, _e)

    # Reuse cached bytes if a previous call (ride or batch) already fetched
    # this activity. Saves a 5-15 s Intervals.icu round-trip per repeated hit.
    fit_bytes = _pp_cache.get_fit(athlete_id, activity_id)
    if fit_bytes is None:
        try:
            fit_bytes = await client.download_fit(activity_id)
            _pp_cache.put_fit(athlete_id, activity_id, fit_bytes)
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
            power_meter_name=pm_name,
            gear_id=gear_id,
            gear_name=gear_name,
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
    cda_prior_mean: Optional[float] = Form(None),
    cda_prior_sigma: Optional[float] = Form(None),
):
    """Hierarchical (random-effects) joint analysis of N Intervals.icu rides.

    Downloads each .FIT, pre-processes (parse, weather, filters), then runs
    a single joint optimisation over all rides simultaneously: shared Crr,
    individual CdA_i ~ N(mu, tau²). Returns the rider's "annual average"
    CdA (mu) with its CI and the per-ride CdA_i.
    """
    ids = [s.strip() for s in activity_ids.split(",") if s.strip()]
    _log.info(
        "REQUEST /intervals/analyze-batch n_rides=%d mass=%.1fkg bike=%s "
        "crr_fixed=%s eta=%.3f prior(mean=%s sigma=%s)",
        len(ids), mass_kg, bike_type,
        f"{crr_fixed:.5f}" if crr_fixed is not None else "auto",
        eta,
        f"{cda_prior_mean:.3f}" if cda_prior_mean is not None else "None",
        f"{cda_prior_sigma:.3f}" if cda_prior_sigma is not None else "None",
    )
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 activity_ids requis.")

    bcfg = get_bike_config(bike_type)
    client = IntervalsClient(api_key, athlete_id)

    # Parallel preprocess with a bounded concurrency to avoid hammering
    # Intervals.icu (downloads) and Open-Meteo (weather). 4 rides in flight
    # is a good balance: on a warm cache, the preprocess is CPU-bound and
    # scales with cores; on a cold cache, the bottleneck is Open-Meteo's
    # rate limit (10 req/s), well above 4 concurrent rides × ~20 tiles.
    import asyncio
    sem = asyncio.Semaphore(4)

    async def _prep(aid: str):
        async with sem:
            # Fast path: preprocessed tuple is cached from a recent analyze-ride
            cached = _pp_cache.get_prep(athlete_id, aid, mass_kg, eta)
            if cached is not None:
                df, ride, _wx_ok = cached
                return ("ok", aid, df, ride)
            # Next-fastest path: raw FIT bytes are cached → skip the download
            fit_bytes = _pp_cache.get_fit(athlete_id, aid)
            if fit_bytes is None:
                try:
                    fit_bytes = await client.download_fit(aid)
                    _pp_cache.put_fit(athlete_id, aid, fit_bytes)
                except Exception as e:
                    return ("err", aid, f"Download failed: {e}")
            with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
                tmp.write(fit_bytes)
                tmp_path = Path(tmp.name)
            try:
                df, ride, wx_ok = await preprocess(tmp_path, mass_kg=mass_kg, eta=eta)
                _pp_cache.put_prep(athlete_id, aid, mass_kg, eta, (df, ride, wx_ok))
                return ("ok", aid, df, ride)
            except Exception as e:
                return ("err", aid, f"Preprocessing failed: {e}")
            finally:
                try:
                    tmp_path.unlink()
                except OSError:
                    pass

    results = await asyncio.gather(*(_prep(aid) for aid in ids))

    all_dfs: list[tuple[str, object, object]] = []
    summaries: list[HierarchicalRideSummary] = []
    for res in results:
        if res[0] == "ok":
            _, aid, df, ride = res
            all_dfs.append((aid, df, ride))
        else:
            _, aid, reason = res
            summaries.append(HierarchicalRideSummary(
                label=aid, cda=0.0, cda_sigma=0.0, r_squared=0.0, nrmse=0.0,
                avg_power_w=0.0, avg_speed_kmh=0.0, valid_points=0,
                ride_date="", excluded=True, exclusion_reason=reason,
            ))

    if len(all_dfs) < 5:
        # Method B estimates τ (inter-ride standard deviation) as a free
        # parameter. Below n=5, τ is essentially arbitrary (it collapses to
        # the floor or the ceiling depending on the optimiser's initial
        # guess). The inverse-variance aggregation (Method A) already
        # handles small n correctly — we just refuse to mislead the user
        # with a "hierarchical" estimate that isn't really hierarchical.
        _log.info(
            "METHOD_B skipped: only %d valid rides, minimum required is 5 "
            "(τ is ill-defined below that threshold)",
            len(all_dfs),
        )
        raise HTTPException(
            status_code=422,
            detail=f"Méthode B nécessite au moins 5 sorties valides "
                   f"(seulement {len(all_dfs)} disponibles après le preprocessing). "
                   "En dessous de 5 rides, τ (la variance inter-rides) ne peut pas "
                   "être estimée de façon fiable — la moyenne pondérée (méthode A) "
                   "est plus honnête pour ce volume de données."
        )

    # Fallback on bike-type default prior if the user didn't override.
    eff_prior_mean = cda_prior_mean if cda_prior_mean and cda_prior_mean > 0 else bcfg.cda_prior_mean
    eff_prior_sigma = cda_prior_sigma if cda_prior_sigma and cda_prior_sigma > 0 else bcfg.cda_prior_sigma
    try:
        h_result = solve_hierarchical(
            [df for (_, df, _) in all_dfs],
            mass=mass_kg, eta=eta, crr_fixed=crr_fixed,
            cda_lower=bcfg.cda_lower,
            cda_upper=bcfg.cda_upper,
            cda_prior_mean=eff_prior_mean,
            cda_prior_sigma=eff_prior_sigma,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur du solveur hiérarchique : {e}")

    # Log the Method B summary so it shows up in the session log alongside
    # the per-ride ANALYZE lines. Useful to compare Method A (inverse-var)
    # vs Method B (hierarchical joint fit) after the fact.
    _log.info(
        "METHOD_B result: mu_cda=%.3f IC95=[%.3f,%.3f] tau=%.3f crr=%.5f "
        "IC95=[%.5f,%.5f] n_rides=%d",
        h_result.mu_cda, h_result.mu_cda_ci[0], h_result.mu_cda_ci[1],
        h_result.tau, h_result.crr, h_result.crr_ci[0], h_result.crr_ci[1],
        len(all_dfs),
    )
    # Also log each ride's contribution for detailed post-hoc analysis
    for i, (aid, _, _) in enumerate(all_dfs):
        _log.info(
            "METHOD_B ride %s: cda_i=%.3f sigma_i=%.3f r2=%.3f",
            aid, h_result.per_ride_cda[i], h_result.per_ride_sigma[i],
            h_result.per_ride_r2[i],
        )

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
