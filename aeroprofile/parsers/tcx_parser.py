"""TCX file parser (Garmin Training Center XML)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from lxml import etree

from aeroprofile.parsers.models import RideData, RidePoint

TCX_NS = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
AX_NS = "http://www.garmin.com/xmlschemas/ActivityExtension/v2"


def _parse_time(s: str) -> datetime:
    # TCX times like "2026-04-05T07:00:50.000Z"
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _text(node, path: str, ns: dict) -> str | None:
    el = node.find(path, ns)
    return el.text if el is not None and el.text else None


def _float(node, path: str, ns: dict) -> float | None:
    t = _text(node, path, ns)
    if t is None:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def parse_tcx(filepath: str | Path) -> RideData:
    tree = etree.parse(str(filepath))
    root = tree.getroot()
    ns = {"t": TCX_NS, "x": AX_NS}

    # Strip default namespace detection fallback
    if not root.tag.startswith("{"):
        # try without NS
        ns = {"t": "", "x": ""}

    points: list[RidePoint] = []
    sport = "cycling"

    # Sport attribute on Activity
    for act in root.iter(f"{{{TCX_NS}}}Activity"):
        sp = act.get("Sport")
        if sp:
            sport = sp.lower()
        break

    trackpoints = list(root.iter(f"{{{TCX_NS}}}Trackpoint"))
    for tp in trackpoints:
        time_s = _text(tp, "t:Time", ns)
        if not time_s:
            continue
        try:
            ts = _parse_time(time_s)
        except Exception:
            continue
        lat = _float(tp, "t:Position/t:LatitudeDegrees", ns)
        lon = _float(tp, "t:Position/t:LongitudeDegrees", ns)
        if lat is None or lon is None:
            continue
        alt = _float(tp, "t:AltitudeMeters", ns) or 0.0
        dist = _float(tp, "t:DistanceMeters", ns) or 0.0
        hr = _float(tp, "t:HeartRateBpm/t:Value", ns)
        cad = _float(tp, "t:Cadence", ns)

        # Extensions: speed + watts
        speed = 0.0
        power = 0.0
        ext_el = tp.find("t:Extensions", ns)
        if ext_el is not None:
            for tpx in ext_el.iter(f"{{{AX_NS}}}TPX"):
                sp = tpx.find(f"{{{AX_NS}}}Speed")
                if sp is not None and sp.text:
                    try:
                        speed = float(sp.text)
                    except ValueError:
                        pass
                w = tpx.find(f"{{{AX_NS}}}Watts")
                if w is not None and w.text:
                    try:
                        power = float(w.text)
                    except ValueError:
                        pass

        points.append(
            RidePoint(
                timestamp=ts,
                latitude=lat,
                longitude=lon,
                altitude=alt,
                speed=speed,
                power=power,
                cadence=cad,
                heart_rate=hr,
                distance=dist,
            )
        )

    points.sort(key=lambda p: p.timestamp)

    return RideData(
        points=points,
        sport=sport,
        start_time=points[0].timestamp if points else None,
        source_format="tcx",
    )
