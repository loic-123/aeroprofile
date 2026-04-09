"""Bike type configuration: priors and solver bounds per bike type."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BikeTypeConfig:
    label: str
    cda_prior_mean: float
    cda_prior_sigma: float
    cda_lower: float  # solver lower bound
    cda_upper: float  # solver upper bound


BIKE_TYPES: dict[str, BikeTypeConfig] = {
    "road": BikeTypeConfig(
        label="Route",
        cda_prior_mean=0.32,
        cda_prior_sigma=0.10,
        cda_lower=0.22,
        cda_upper=0.50,
    ),
    "tt": BikeTypeConfig(
        label="CLM / Triathlon",
        cda_prior_mean=0.22,
        cda_prior_sigma=0.06,
        cda_lower=0.15,
        cda_upper=0.32,
    ),
    "mtb": BikeTypeConfig(
        label="VTT / Gravel",
        cda_prior_mean=0.45,
        cda_prior_sigma=0.10,
        cda_lower=0.30,
        cda_upper=0.65,
    ),
}

DEFAULT_BIKE_TYPE = "road"


def get_bike_config(bike_type: str | None = None) -> BikeTypeConfig:
    return BIKE_TYPES.get(bike_type or DEFAULT_BIKE_TYPE, BIKE_TYPES[DEFAULT_BIKE_TYPE])
