"""FIT file parser (Garmin / fitparse)."""

from __future__ import annotations

from datetime import datetime, timezone
from math import cos, radians, sin, sqrt, atan2
from pathlib import Path

from fitparse import FitFile

from aeroprofile.parsers.models import RideData, RidePoint

SEMICIRCLE_TO_DEG = 180.0 / (2**31)


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
