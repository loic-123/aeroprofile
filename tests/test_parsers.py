"""Parser tests."""

from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

from aeroprofile.parsers.auto_parser import parse_file


def _write_gpx(path: Path):
    path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><name>t</name><trkseg>
    <trkpt lat="45.83" lon="5.45"><ele>200</ele><time>2026-04-05T07:00:00Z</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:power>150</gpxtpx:power>
        <gpxtpx:atemp>15</gpxtpx:atemp></gpxtpx:TrackPointExtension></extensions>
    </trkpt>
    <trkpt lat="45.8301" lon="5.4502"><ele>200.5</ele><time>2026-04-05T07:00:01Z</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:power>160</gpxtpx:power>
        </gpxtpx:TrackPointExtension></extensions>
    </trkpt>
  </trkseg></trk>
</gpx>""",
        encoding="utf-8",
    )


def _write_tcx(path: Path):
    path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ax="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities><Activity Sport="Biking"><Id>2026-04-05T07:00:00Z</Id>
    <Lap StartTime="2026-04-05T07:00:00Z"><Track>
      <Trackpoint><Time>2026-04-05T07:00:00Z</Time>
        <Position><LatitudeDegrees>45.83</LatitudeDegrees><LongitudeDegrees>5.45</LongitudeDegrees></Position>
        <AltitudeMeters>200</AltitudeMeters><DistanceMeters>0</DistanceMeters>
        <Cadence>80</Cadence>
        <Extensions><ax:TPX><ax:Speed>5.0</ax:Speed><ax:Watts>150</ax:Watts></ax:TPX></Extensions>
      </Trackpoint>
      <Trackpoint><Time>2026-04-05T07:00:01Z</Time>
        <Position><LatitudeDegrees>45.8301</LatitudeDegrees><LongitudeDegrees>5.4502</LongitudeDegrees></Position>
        <AltitudeMeters>200.5</AltitudeMeters><DistanceMeters>5</DistanceMeters>
        <Cadence>81</Cadence>
        <Extensions><ax:TPX><ax:Speed>5.2</ax:Speed><ax:Watts>160</ax:Watts></ax:TPX></Extensions>
      </Trackpoint>
    </Track></Lap>
  </Activity></Activities>
</TrainingCenterDatabase>""",
        encoding="utf-8",
    )


def test_gpx_parser(tmp_path):
    p = tmp_path / "ride.gpx"
    _write_gpx(p)
    ride = parse_file(p)
    assert ride.source_format == "gpx"
    assert len(ride.points) == 2
    assert ride.points[0].power == 150.0
    assert ride.points[1].power == 160.0
    assert ride.points[0].latitude == 45.83
    # speed computed on second point
    assert ride.points[1].speed > 0
    assert ride.points[1].distance > 0


def test_tcx_parser(tmp_path):
    p = tmp_path / "ride.tcx"
    _write_tcx(p)
    ride = parse_file(p)
    assert ride.source_format == "tcx"
    assert len(ride.points) == 2
    assert ride.points[0].power == 150.0
    assert ride.points[1].power == 160.0
    assert ride.points[0].speed == 5.0
    assert ride.points[0].cadence == 80.0


def test_auto_parser_unknown_ext(tmp_path):
    p = tmp_path / "ride.xyz"
    p.write_text("nope")
    with pytest.raises(ValueError):
        parse_file(p)
