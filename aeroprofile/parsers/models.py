"""Common data model for parsed rides."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class RidePoint:
    timestamp: datetime
    latitude: float
    longitude: float
    altitude: float
    speed: float  # m/s
    power: float  # W
    cadence: Optional[float] = None
    heart_rate: Optional[float] = None
    temperature: Optional[float] = None
    distance: float = 0.0  # cumulative meters


@dataclass
class Lap:
    index: int
    start_time: datetime
    end_time: datetime
    distance_m: float = 0.0


@dataclass
class RideData:
    points: list[RidePoint] = field(default_factory=list)
    sport: str = "cycling"
    start_time: Optional[datetime] = None
    source_format: str = ""
    device: Optional[str] = None
    laps: list[Lap] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.points)
