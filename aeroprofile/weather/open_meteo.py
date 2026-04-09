"""Open-Meteo historical weather client."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import httpx

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARS = (
    "temperature_2m",
    "relativehumidity_2m",
    "surface_pressure",
    "windspeed_10m",
    "winddirection_10m",
    "windgusts_10m",
)


async def fetch_weather(lat: float, lon: float, ride_date: date | str) -> dict:
    """Fetch hourly historical weather for one day at (lat, lon).

    Returns the `hourly` dict from Open-Meteo, with keys:
      time, temperature_2m, relativehumidity_2m, surface_pressure,
      windspeed_10m, winddirection_10m, windgusts_10m.

    windspeed_10m is in km/h and winddirection_10m in degrees (meteorological).
    """
    if isinstance(ride_date, str):
        day = ride_date
        day_dt = datetime.fromisoformat(ride_date).date()
    else:
        day = ride_date.isoformat()
        day_dt = ride_date

    # Decide endpoint: archive is authoritative but has a ~5-day lag.
    today = datetime.now(timezone.utc).date()
    use_forecast = (today - day_dt).days < 5

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARS),
        "timezone": "UTC",
        "windspeed_unit": "kmh",
    }

    async def _get_with_retry(client, url, p):
        # Open-Meteo free tier returns 429/502 when overloaded. Retry up to
        # 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s).
        last_exc = None
        for attempt in range(5):
            try:
                r = await client.get(url, params=p)
                if r.status_code in (429, 502, 503):
                    await asyncio.sleep(min(2 ** attempt, 10))
                    continue
                return r
            except httpx.HTTPError as e:
                last_exc = e
                await asyncio.sleep(min(2 ** attempt, 10))
        if last_exc is not None:
            raise last_exc
        return r

    async with httpx.AsyncClient(timeout=20.0) as client:
        if not use_forecast:
            params_archive = {**params, "start_date": day, "end_date": day}
            r = await _get_with_retry(client, ARCHIVE_URL, params_archive)
            if r.status_code == 200:
                data = r.json()
                if data.get("hourly", {}).get("time"):
                    return data["hourly"]
        # Fallback to forecast with past_days
        past_days = max(1, min(7, (today - day_dt).days + 1))
        params_fc = {**params, "past_days": past_days, "forecast_days": 1}
        r = await _get_with_retry(client, FORECAST_URL, params_fc)
        r.raise_for_status()
        data = r.json()
        return data["hourly"]
