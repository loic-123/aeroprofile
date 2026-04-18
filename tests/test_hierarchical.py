"""Tests for the DerSimonian–Laird hierarchical solver.

The end-to-end hierarchical path (per-ride Chung VE → DL aggregation) is
expensive to exercise with synthetic FIT data, so these tests focus on the
pure DL arithmetic. We monkey-patch the per-ride Chung solve to return
hand-crafted (CdA_i, σ_i) pairs and then assert the DL output matches the
closed-form formula.

References:
  DerSimonian & Laird (1986), Controlled Clinical Trials 7:177-188
  Higgins & Thompson (2002), Stat. Med. 21:1539-1558
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from aeroprofile.solver import hierarchical as hmod
from aeroprofile.solver import chung_ve as cvmod


def _fake_chung_result(cda: float, ci_low: float, ci_high: float, r2: float = 0.9):
    """Mimic the attributes of aeroprofile.solver.chung_ve.ChungResult.

    Only the fields read by solve_hierarchical's per-ride loop are needed:
    .cda, .cda_ci, .r_squared_elev.
    """
    class _R:
        pass
    r = _R()
    r.cda = cda
    r.cda_ci = (ci_low, ci_high)
    r.r_squared_elev = r2
    return r


def _dummy_ride_df(n: int = 120) -> pd.DataFrame:
    """Minimal DataFrame that passes solve_hierarchical's `len(valid) >= 60`
    gate. Values don't matter because we stub the chung_ve solve below."""
    return pd.DataFrame({
        "v_ground": np.full(n, 8.0),
        "v_air": np.full(n, 8.0),
        "rho": np.full(n, 1.2),
        "power": np.full(n, 200.0),
        "dt": np.full(n, 1.0),
        "altitude_smooth": np.cumsum(np.zeros(n)),
        "filter_valid": np.ones(n, dtype=bool),
    })


@pytest.fixture
def stub_chung(monkeypatch):
    """Patch solve_chung_ve so the per-ride results are hand-crafted.

    Call it with an iterable of (cda, ci_low, ci_high) — returns the
    results in order, one per ride.
    """
    def _install(samples):
        it = iter(samples)
        def fake(df, **kwargs):
            cda, lo, hi = next(it)
            return _fake_chung_result(cda, lo, hi)
        # solve_hierarchical does `from aeroprofile.solver.chung_ve import
        # solve_chung_ve` inside the function body, so we patch the source
        # module rather than the (non-existent) attribute on hmod.
        monkeypatch.setattr(cvmod, "solve_chung_ve", fake)
    return _install


def _ci_bounds(cda: float, sigma: float) -> tuple[float, float]:
    """95% CI under normal assumption: cda ± 1.96 σ.
    The solver later recovers σ = (hi − lo) / 3.92 (= 2 × 1.96)."""
    return (cda - 1.96 * sigma, cda + 1.96 * sigma)


def test_dl_recovers_mean_when_sigmas_equal(stub_chung):
    """Equal σ_i → μ = simple arithmetic mean. Q − (k−1) should be
    small-ish random noise around 0 so τ² ≈ 0 and μ_RE == μ_FE."""
    cdas = [0.29, 0.30, 0.31, 0.32, 0.30]
    sigmas = [0.015] * 5
    samples = [(c, *_ci_bounds(c, s)) for c, s in zip(cdas, sigmas)]
    stub_chung(samples)
    dfs = [_dummy_ride_df() for _ in samples]
    res = hmod.solve_hierarchical(dfs, mass=75.0)
    assert res.n_rides == 5
    # Mean of 0.29, 0.30, 0.31, 0.32, 0.30 = 0.304
    assert abs(res.mu_cda - 0.304) < 1e-3
    # Homogeneous sigmas → τ should be tiny
    assert res.tau < 0.03
    # IC95 should be reasonable (~ σ / √n ~ 0.007)
    width = res.mu_cda_ci[1] - res.mu_cda_ci[0]
    assert 0.005 < width < 0.05


def test_dl_detects_heterogeneity(stub_chung):
    """Spread out the CdAs well beyond σ_i → Cochran's Q should exceed
    (k−1) and τ² should be > 0."""
    # Two clusters: 3 rides near 0.28, 3 rides near 0.38 (same σ=0.005)
    samples = []
    for c in [0.27, 0.28, 0.29, 0.37, 0.38, 0.39]:
        samples.append((c, *_ci_bounds(c, 0.005)))
    stub_chung(samples)
    dfs = [_dummy_ride_df() for _ in samples]
    res = hmod.solve_hierarchical(dfs, mass=75.0)
    # Spread ≈ 0.10 between clusters, τ should clearly exceed the floor
    assert res.tau > 0.03
    # μ ≈ midpoint 0.33
    assert abs(res.mu_cda - 0.33) < 0.02


def test_dl_n_eff_reflects_weight_concentration(stub_chung):
    """One ride with tiny σ (large weight) dominates → n_eff << n_rides.
    With σ_i floor at 0.010 (commit b61c409), the max weight ratio is
    capped, so even one "lucky" ride can't fully collapse n_eff."""
    # 4 ordinary rides + 1 very tight one
    samples = [
        (0.30, *_ci_bounds(0.30, 0.03)),
        (0.31, *_ci_bounds(0.31, 0.03)),
        (0.29, *_ci_bounds(0.29, 0.03)),
        (0.30, *_ci_bounds(0.30, 0.03)),
        (0.30, *_ci_bounds(0.30, 0.001)),  # tight
    ]
    stub_chung(samples)
    dfs = [_dummy_ride_df() for _ in samples]
    res = hmod.solve_hierarchical(dfs, mass=75.0)
    assert res.n_rides == 5
    # σ_i floor at 0.010 clamps the tight ride to σ=0.010, so its weight
    # is (30/10)² = 9× a σ=0.030 ride. With 4 ordinary rides (each weight
    # 1) and 1 dominant ride (weight 9), n_eff = (4+9)² / (4+81) ≈ 1.99.
    # Without the floor, the tight ride's weight would be (30/1)² = 900×
    # → n_eff ≈ 1.02 (almost fully dominated). The floor keeps a useful
    # signal from the other 4 rides.
    assert 1.8 <= res.n_eff <= 3.0


def test_dl_small_k_no_crash(stub_chung):
    """Single ride: τ is undefined, but solve_hierarchical still returns
    a result with τ=0 and μ equal to the ride's CdA."""
    samples = [(0.32, *_ci_bounds(0.32, 0.012))]
    stub_chung(samples)
    res = hmod.solve_hierarchical([_dummy_ride_df()], mass=75.0)
    assert res.n_rides == 1
    assert res.tau == 0.0
    assert abs(res.mu_cda - 0.32) < 1e-3
