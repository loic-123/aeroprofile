"""Auto-detect format from extension and dispatch."""

from __future__ import annotations

from math import cos, radians, sin, sqrt, atan2
from pathlib import Path

from aeroprofile.parsers.models import RideData


def parse_file(filepath: str | Path) -> RideData:
    ext = Path(filepath).suffix.lower()
    if ext == ".fit":
        from aeroprofile.parsers.fit_parser import parse_fit

        return parse_fit(filepath)
    if ext == ".gpx":
        from aeroprofile.parsers.gpx_parser import parse_gpx

        return parse_gpx(filepath)
    if ext == ".tcx":
        from aeroprofile.parsers.tcx_parser import parse_tcx

        return parse_tcx(filepath)
    raise ValueError(
        f"Unsupported format: {ext}. Accepted formats: .fit, .gpx, .tcx"
    )


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(p1) * cos(p2) * sin(dlon / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def validate_ride(ride: RideData) -> None:
    """Raise ValueError if ride data insufficient for analysis."""
    if len(ride.points) < 60:
        raise ValueError("Too few points (<60) in the file.")
    with_power = sum(1 for p in ride.points if p.power > 0)
    if with_power < 60:
        raise ValueError(
            f"Only {with_power} points with power > 0. "
            "A power meter is required."
        )
    with_gps = sum(1 for p in ride.points if p.latitude and p.longitude)
    if with_gps < 0.9 * len(ride.points):
        raise ValueError("GPS missing on more than 10% of points.")

    # Indoor / virtual ride guard. Some platforms (Zwift, MyWhoosh, indoor
    # trainers without the icu_indoor flag) emit GPS coordinates that are
    # constant or wander within a few metres — passing the with_gps check
    # but yielding zero real displacement. Without this gate the analyser
    # would proceed with a degenerate trajectory and produce a meaningless
    # CdA. We sample the GPS-valid points (every 100th to bound cost on
    # 5h+ rides) and sum great-circle hops; <100 m total → reject.
    gps_points = [p for p in ride.points if p.latitude and p.longitude]
    if len(gps_points) >= 2:
        step = max(1, len(gps_points) // 200)  # at most ~200 hops
        total_disp = 0.0
        for i in range(step, len(gps_points), step):
            total_disp += _haversine(
                gps_points[i - step].latitude,
                gps_points[i - step].longitude,
                gps_points[i].latitude,
                gps_points[i].longitude,
            )
        if total_disp < 100.0:
            raise ValueError(
                "Indoor / virtual ride detected (total GPS displacement "
                f"{total_disp:.0f} m < 100 m). The aerodynamic model only "
                "applies to outdoor rides — indoor sessions on Zwift, "
                "MyWhoosh or a smart trainer can't yield a meaningful CdA."
            )

    total_dist = ride.points[-1].distance - ride.points[0].distance
    if total_dist < 1000:
        raise ValueError(f"Total distance too short ({total_dist:.0f} m < 1 km).")
    # median resolution
    ts = [p.timestamp for p in ride.points]
    dts = [(ts[i] - ts[i - 1]).total_seconds() for i in range(1, len(ts))]
    dts.sort()
    median_dt = dts[len(dts) // 2]
    if median_dt > 2.0:
        raise ValueError(f"Insufficient time resolution (median {median_dt}s > 2s).")
