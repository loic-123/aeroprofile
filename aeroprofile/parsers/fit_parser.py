"""FIT file parser (Garmin / fitparse)."""

from __future__ import annotations

from datetime import datetime, timezone
from math import cos, radians, sin, sqrt, atan2
from pathlib import Path

from fitparse import FitFile

from aeroprofile.parsers.models import RideData, RidePoint

SEMICIRCLE_TO_DEG = 180.0 / (2**31)

# Manufacturer allowlist for power meters. Rationale: Garmin bike computers
# (Edge series) often report themselves with device_type=4 ("bike_power")
# because they relay ANT+ power, which makes device_type alone unreliable.
# A manufacturer allowlist is more robust — companies in this list either
# *only* make power meters or their product IDs for power meters are well
# known. The actual Garmin power meters (Vector, Rally) are handled by the
# "GARMIN RALLY"/"GARMIN VECTOR" product_name pattern in classify_power_meter.
_POWER_METER_MANUFACTURERS = {
    "favero_electronics",
    "stages_cycling",
    "quarq",
    "srm",
    "power2max",
    "pioneer",
    "rotor",
    "verve",
    "look",
    "4iiii_innovations",
    "4iiii",
    "_4iiiis",
    "campagnolo",
    "watteam",
    "magene",
    "sigeyi",
    "wahoo_fitness",  # for Powrlink
}


def extract_power_meter(filepath: str | Path) -> str | None:
    """Return ``"MANUFACTURER product_id"`` for the first power-meter device
    found in a FIT file, or ``None`` if none can be identified.

    This mirrors the format Intervals.icu stores in its ``power_meter`` JSON
    field (e.g. ``"FAVERO_ELECTRONICS 22"``, ``"_4IIIIS 25"``), so the same
    ``classify_power_meter`` logic works for both sources.

    We explicitly ignore the FIT ``device_type == 4`` flag because Garmin
    Edge bike computers (the relay, not the sensor) often report themselves
    with that type when they retransmit ANT+ power. Instead we match on a
    manufacturer allowlist that is known to only contain power-meter makers.

    Errors are swallowed — a missing or corrupt device_info message should
    never block the analysis.
    """
    try:
        fit = FitFile(str(filepath))
        for msg in fit.get_messages("device_info"):
            d = {f.name: f.value for f in msg}
            mfr_raw = d.get("manufacturer")
            if mfr_raw is None:
                continue
            mfr = str(mfr_raw).lower()
            if mfr not in _POWER_METER_MANUFACTURERS:
                continue
            prod = d.get("garmin_product")
            if prod is None:
                prod = d.get("product")
            if prod is None:
                continue
            return f"{mfr.upper()} {prod}"
    except Exception:
        return None
    return None


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def parse_fit(filepath: str | Path) -> RideData:
    fit = FitFile(str(filepath))
    points: list[RidePoint] = []
    device: str | None = None
    sport = "cycling"

    for msg in fit.get_messages("file_id"):
        for f in msg:
            if f.name == "manufacturer" and f.value:
                device = str(f.value)

    for msg in fit.get_messages("sport"):
        for f in msg:
            if f.name == "sport" and f.value:
                sport = str(f.value)

    seen_timestamps: set[datetime] = set()
    for msg in fit.get_messages("record"):
        values = {f.name: f.value for f in msg}
        ts = values.get("timestamp")
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        lat_sc = values.get("position_lat")
        lon_sc = values.get("position_long")
        if lat_sc is None or lon_sc is None:
            continue
        lat = lat_sc * SEMICIRCLE_TO_DEG
        lon = lon_sc * SEMICIRCLE_TO_DEG

        altitude = values.get("enhanced_altitude")
        if altitude is None:
            altitude = values.get("altitude", 0.0) or 0.0
        speed = values.get("enhanced_speed")
        if speed is None:
            speed = values.get("speed", 0.0) or 0.0
        power = values.get("power") or 0.0
        cadence = values.get("cadence")
        hr = values.get("heart_rate")
        temp = values.get("temperature")
        distance = values.get("distance") or 0.0

        # Dedup: keep last per timestamp
        if ts in seen_timestamps:
            if points:
                points[-1] = RidePoint(
                    timestamp=ts,
                    latitude=float(lat),
                    longitude=float(lon),
                    altitude=float(altitude),
                    speed=float(speed),
                    power=float(power),
                    cadence=float(cadence) if cadence is not None else None,
                    heart_rate=float(hr) if hr is not None else None,
                    temperature=float(temp) if temp is not None else None,
                    distance=float(distance),
                )
            continue
        seen_timestamps.add(ts)

        points.append(
            RidePoint(
                timestamp=ts,
                latitude=float(lat),
                longitude=float(lon),
                altitude=float(altitude),
                speed=float(speed),
                power=float(power),
                cadence=float(cadence) if cadence is not None else None,
                heart_rate=float(hr) if hr is not None else None,
                temperature=float(temp) if temp is not None else None,
                distance=float(distance),
            )
        )

    points.sort(key=lambda p: p.timestamp)

    # Fill distance if missing (all zeros)
    if points and all(p.distance == 0.0 for p in points[1:]):
        cum = 0.0
        for i in range(1, len(points)):
            d = _haversine(
                points[i - 1].latitude,
                points[i - 1].longitude,
                points[i].latitude,
                points[i].longitude,
            )
            cum += d
            points[i].distance = cum

    return RideData(
        points=points,
        sport=sport,
        start_time=points[0].timestamp if points else None,
        source_format="fit",
        device=device,
    )
