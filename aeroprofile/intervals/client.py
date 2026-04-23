"""Intervals.icu API client.

Wraps the Intervals.icu REST API for fetching athlete profile, listing
activities, and downloading .FIT files. Uses httpx for async HTTP.

Auth: Basic Auth with username='API_KEY', password=<user's API key>.
Athlete ID '0' means 'the authenticated user'.

Docs: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
"""

from __future__ import annotations

import asyncio
import gzip
from dataclasses import dataclass, field
from datetime import date, datetime
from io import BytesIO
from typing import Optional

import httpx

BASE_URL = "https://intervals.icu/api/v1"


@dataclass
class AthleteProfile:
    id: str
    name: str
    weight_kg: float
    ftp: int
    email: str = ""


@dataclass
class ActivitySummary:
    id: str
    name: str
    activity_type: str
    start_date: str  # ISO date
    distance_m: float
    moving_time_s: float
    elapsed_time_s: float
    total_elevation_gain_m: float
    average_watts: float
    has_power: bool
    indoor: bool
    # Power meter metadata as reported by Intervals.icu. Intervals stores the
    # ANT+ product string (e.g. "FAVERO_ELECTRONICS 22" for the Assioma family,
    # "_4IIIIS 25" for a 4iiii Precision). Used to warn the user when the
    # sensor is known to produce noisy / drifting estimates.
    power_meter: Optional[str] = None
    power_meter_battery: Optional[str] = None
    crank_length_mm: Optional[float] = None
    # Bike/gear identity as tracked by Intervals.icu. The id is stable across
    # rides with the same bike. The name is often None unless the user set it.
    gear_id: Optional[str] = None
    gear_name: Optional[str] = None


class IntervalsClient:
    """Async client for the Intervals.icu API."""

    def __init__(self, api_key: str, athlete_id: str = "0"):
        self.api_key = api_key
        self.athlete_id = athlete_id
        self._auth = httpx.BasicAuth(username="API_KEY", password=api_key)

    async def _get(self, path: str, **kwargs) -> httpx.Response:
        """GET request with retry on 429 and transport errors.

        Network failures (``ConnectError``, ``ReadTimeout``) are transient
        by default: we retry with the same exponential backoff as on
        429 (1 s → 2 s → 4 s). If all retries fail we re-raise the last
        exception so the caller sees an actionable httpx error instead
        of silently cascading through the whole batch.
        """
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=30.0, auth=self._auth) as client:
            for attempt in range(4):
                try:
                    r = await client.get(f"{BASE_URL}{path}", **kwargs)
                except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout,
                        httpx.RemoteProtocolError, httpx.PoolTimeout) as e:
                    last_exc = e
                    if attempt < 3:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    raise
                if r.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return r
            # All retries returned 429 — surface the last response so the
            # caller can read the status / headers and decide what to do.
            return r  # type: ignore[possibly-undefined]

    async def get_athlete(self) -> AthleteProfile:
        """Fetch athlete profile (name, weight, FTP).

        Weight is in ``icu_weight`` (not ``weight`` which is often None).
        FTP is nested inside ``sportSettings`` for the Ride sport type.
        """
        r = await self._get(f"/athlete/{self.athlete_id}")
        r.raise_for_status()
        d = r.json()

        # Weight: prefer icu_weight over weight
        weight = d.get("icu_weight") or d.get("weight") or 75
        weight = float(weight)

        # FTP: find the Ride sport settings
        ftp = 0
        for ss in d.get("sportSettings", []):
            types = ss.get("types", [])
            if "Ride" in types:
                ftp = int(ss.get("ftp", 0) or 0)
                break

        return AthleteProfile(
            id=str(d.get("id", self.athlete_id)),
            name=d.get("name", d.get("firstname", "Athlete")),
            weight_kg=weight,
            ftp=ftp,
            email=d.get("email", ""),
        )

    async def list_activities(
        self,
        oldest: date | str,
        newest: date | str,
    ) -> list[ActivitySummary]:
        """List activities in a date range. Returns all types (Ride, Run, etc.)."""
        if isinstance(oldest, date):
            oldest = oldest.isoformat()
        if isinstance(newest, date):
            newest = newest.isoformat()
        r = await self._get(
            f"/athlete/{self.athlete_id}/activities",
            params={"oldest": oldest, "newest": newest},
        )
        r.raise_for_status()
        activities = []
        for a in r.json():
            # Parse fields with safe defaults
            act_type = a.get("type", "Ride")
            distance = float(a.get("distance", 0) or 0)
            moving = float(a.get("moving_time", 0) or 0)
            elapsed = float(a.get("elapsed_time", 0) or 0)
            elev = float(a.get("total_elevation_gain", 0) or 0)
            watts = float(a.get("icu_weighted_avg_watts", 0) or a.get("average_watts", 0) or 0)
            has_power = watts > 0 or "watts" in (a.get("stream_types") or [])
            indoor = bool(a.get("icu_indoor", False) or a.get("trainer", False))
            start = a.get("start_date_local", a.get("start_date", ""))[:10]

            # Power meter metadata (strings from ANT+ / Garmin). May be None
            # on rides where no meter was connected (running, walks, etc.).
            pm_name = a.get("power_meter")
            pm_battery = a.get("power_meter_battery")
            crank_raw = a.get("crank_length")
            try:
                crank = float(crank_raw) if crank_raw is not None else None
            except (TypeError, ValueError):
                crank = None
            gear = a.get("gear") if isinstance(a.get("gear"), dict) else {}
            gear_id = gear.get("id") if gear else None
            gear_name = gear.get("name") if gear else None

            activities.append(ActivitySummary(
                id=str(a.get("id", "")),
                name=a.get("name", "Untitled"),
                activity_type=act_type,
                start_date=start,
                distance_m=distance,
                moving_time_s=moving,
                elapsed_time_s=elapsed,
                total_elevation_gain_m=elev,
                average_watts=watts,
                has_power=has_power,
                indoor=indoor,
                power_meter=pm_name if pm_name else None,
                power_meter_battery=pm_battery if pm_battery else None,
                crank_length_mm=crank,
                gear_id=gear_id,
                gear_name=gear_name,
            ))
        return activities

    def filter_activities(
        self,
        activities: list[ActivitySummary],
        min_distance_km: float = 30.0,
        max_distance_km: float = 300.0,
        max_elevation_m: float = 2000.0,
        min_duration_h: float = 1.0,
        require_power: bool = True,
        exclude_indoor: bool = True,
        activity_type: str = "Ride",
    ) -> list[ActivitySummary]:
        """Apply user-configurable filters to an activity list."""
        result = []
        for a in activities:
            if activity_type and a.activity_type != activity_type:
                continue
            dist_km = a.distance_m / 1000.0
            if dist_km < min_distance_km or dist_km > max_distance_km:
                continue
            if a.total_elevation_gain_m > max_elevation_m:
                continue
            dur_h = a.moving_time_s / 3600.0
            if dur_h < min_duration_h:
                continue
            if require_power and not a.has_power:
                continue
            if exclude_indoor and a.indoor:
                continue
            result.append(a)
        return result

    async def download_fit(self, activity_id: str) -> bytes:
        """Download the .FIT file for an activity.

        Uses the /fit-file endpoint which returns an Intervals.icu-generated
        FIT file (includes any edits made in the platform). The response
        may be gzip-compressed.
        """
        r = await self._get(f"/activity/{activity_id}/fit-file")
        r.raise_for_status()
        data = r.content
        # Decompress if gzipped
        if data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        return data

    async def get_activity_meta(self, activity_id: str) -> dict:
        """Fetch a single activity's JSON payload (power_meter, crank_length, …).

        Used when we have an activity_id but not the list summary — e.g. on
        /analyze-ride, to read the sensor info for the warning banner.
        """
        r = await self._get(f"/activity/{activity_id}")
        r.raise_for_status()
        return r.json()
