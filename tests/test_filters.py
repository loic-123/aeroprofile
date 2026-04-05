"""Filter tests."""

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from aeroprofile.filters.segment_filter import apply_filters


def _df_base(n=100):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return pd.DataFrame(
        {
            "timestamp": [t0 + timedelta(seconds=i) for i in range(n)],
            "v_ground": np.full(n, 8.0),
            "v_air": np.full(n, 8.0),
            "power": np.full(n, 200.0),
            "gradient": np.zeros(n),
            "acceleration": np.zeros(n),
            "bearing": np.zeros(n),
            "distance": np.arange(n) * 8.0,
            "dt": np.ones(n),
        }
    )


def test_stopped_filtered():
    df = _df_base()
    df.loc[10:19, "v_ground"] = 0.5
    df = apply_filters(df, min_block_seconds=5)
    assert df.loc[10:19, "filter_stopped"].all()
    assert not df.loc[10:19, "filter_valid"].any()


def test_steep_climb_filtered():
    df = _df_base()
    df.loc[30:40, "gradient"] = 0.12
    df = apply_filters(df, min_block_seconds=5)
    assert df.loc[30:40, "filter_steep_climb"].all()


def test_hard_accel_filtered():
    df = _df_base()
    df.loc[50:55, "acceleration"] = 2.5
    df = apply_filters(df, min_block_seconds=5)
    assert df.loc[50:55, "filter_hard_accel"].all()


def test_negative_v_air_filtered():
    df = _df_base()
    df.loc[70:75, "v_air"] = -1.0
    df = apply_filters(df, min_block_seconds=5)
    assert df.loc[70:75, "filter_negative_v_air"].all()


def test_valid_block_kept():
    df = _df_base(n=200)
    df = apply_filters(df, min_block_seconds=10)
    # All clean → almost all valid (except maybe low-speed check fails? v=8 >4 ok)
    assert df["filter_valid"].sum() > 150
