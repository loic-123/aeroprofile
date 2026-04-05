"""GPX file parser (gpxpy) with power extraction from extensions."""

from __future__ import annotations

from datetime import timezone
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Optional

import gpxpy

from aeroprofile.parsers.models import RideData, RidePoint


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _strip_ns(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _find_in_extensions(extensions, names: tuple[str, ...]) -> Optional[float]:
    """Recursively search extension elements for any tag matching names (case-insensitive, substring)."""
    if not extensions:
        return None
    for ext in extensions:
        stack = [ext]
        while stack:
            node = stack.pop()
            tag = _strip_ns(node.tag).lower()
            for name in names:
                if name in tag:
                    text = (node.text or "").strip()
                    if text:
                        try:
                            return float(text)
                        except ValueError:
                            pass
            for child in list(node):
                stack.append(child)
    return None


def parse_gpx(filepath: str | Path) -> RideData:
    with open(filepath, "r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    points: list[RidePoint] = []
    for track in gpx.tracks:
        for seg in track.segments:
            for p in seg.points:
                ts = p.time
                if ts is None:
                    continue
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                ext = getattr(p, "extensions", None)
                power = _find_in_extensions(ext, ("power", "watts")) or 0.0
                temp = _find_in_extensions(ext, ("temp", "atemp"))
                hr = _find_in_extensions(ext, ("hr", "heartrate"))
                cad = _find_in_extensions(ext, ("cad",))

                points.append(
                    RidePoint(
                        timestamp=ts,
                        latitude=float(p.latitude),
                        longitude=float(p.longitude),
                        altitude=float(p.elevation) if p.elevation is not None else 0.0,
                        speed=0.0,  # computed below
                        power=float(power),
                        cadence=cad,
                        heart_rate=hr,
                        temperature=temp,
                        distance=0.0,
                    )
                )

    points.sort(key=lambda x: x.timestamp)

    # Compute distance and speed
    cum = 0.0
    for i in range(1, len(points)):
        d = _haversine(
            points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude
        )
        cum += d
        points[i].distance = cum
        dt = (points[i].timestamp - points[i - 1].timestamp).total_seconds()
        points[i].speed = d / dt if dt > 0 else 0.0

    return RideData(
        points=points,
        sport="cycling",
        start_time=points[0].timestamp if points else None,
        source_format="gpx",
    )
