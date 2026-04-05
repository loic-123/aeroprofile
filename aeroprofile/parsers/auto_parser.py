"""Auto-detect format from extension and dispatch."""

from __future__ import annotations

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
        f"Format non supporté : {ext}. Formats acceptés : .fit, .gpx, .tcx"
    )


def validate_ride(ride: RideData) -> None:
    """Raise ValueError if ride data insufficient for analysis."""
    if len(ride.points) < 60:
        raise ValueError("Trop peu de points (<60) dans le fichier.")
    with_power = sum(1 for p in ride.points if p.power > 0)
    if with_power < 60:
        raise ValueError(
            f"Seulement {with_power} points avec puissance > 0. "
            "Un capteur de puissance est requis."
        )
    with_gps = sum(1 for p in ride.points if p.latitude and p.longitude)
    if with_gps < 0.9 * len(ride.points):
        raise ValueError("GPS manquant sur plus de 10% des points.")
    total_dist = ride.points[-1].distance - ride.points[0].distance
    if total_dist < 1000:
        raise ValueError(f"Distance totale trop courte ({total_dist:.0f} m < 1 km).")
    # median resolution
    ts = [p.timestamp for p in ride.points]
    dts = [(ts[i] - ts[i - 1]).total_seconds() for i in range(1, len(ts))]
    dts.sort()
    median_dt = dts[len(dts) // 2]
    if median_dt > 2.0:
        raise ValueError(f"Résolution temporelle insuffisante (médiane {median_dt}s > 2s).")
