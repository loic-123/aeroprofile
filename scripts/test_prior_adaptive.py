"""Test adaptive prior on Laurette rides.

Measures:
 - Number of rides hitting bounds (quality_status == "bound_hit")
 - Distribution of prior_adaptive_factor (how much the prior needed to be boosted)
 - Distribution of |cda - cda_raw| (how much the prior moved the MAP vs MLE)
 - Aggregated CdA across different priors → should stay stable

Run:
    python scripts/test_prior_adaptive.py
"""
import asyncio
import os
import sys
from collections import Counter

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

from aeroprofile.pipeline import analyze

RIDES_DIR = "tests/fixtures/laurette"
if not os.path.isdir(RIDES_DIR):
    print(f"ERROR: {RIDES_DIR} not found.")
    sys.exit(1)

files = sorted(
    [os.path.join(RIDES_DIR, f) for f in os.listdir(RIDES_DIR) if f.endswith(".fit")]
)[:30]
print(f"Testing adaptive prior on {len(files)} Laurette rides\n")


async def run_config(label, prior_mean, prior_sigma):
    print(f"\n[{label}] prior=({prior_mean}, {prior_sigma})")
    statuses = Counter()
    factors = []
    delta_prior_raw = []
    cdas_final = []
    sigmas_final = []

    for f in files:
        try:
            r = await analyze(
                f, mass_kg=70, bike_type="road",
                cda_prior_override=(prior_mean, prior_sigma),
                fetch_wx=True,
            )
            statuses[r.quality_status or "ok"] += 1
            factors.append(r.prior_adaptive_factor)
            if r.cda_raw is not None:
                delta_prior_raw.append(abs(r.cda - r.cda_raw))
            if r.quality_status == "ok":
                cdas_final.append(r.cda)
                sigma = (r.cda_ci[1] - r.cda_ci[0]) / 3.92
                if not np.isfinite(sigma) or sigma <= 0:
                    sigma = 0.05
                sigmas_final.append(sigma)
        except Exception as e:
            statuses["error"] += 1
            print(f"  ERROR on {os.path.basename(f)}: {e}")

    print(f"  quality: {dict(statuses)}")
    if factors:
        arr = np.array(factors)
        print(
            f"  adaptive_factor: mean={arr.mean():.2f} "
            f"median={np.median(arr):.2f} max={arr.max():.2f} "
            f"(#>1.05 = {int((arr > 1.05).sum())}/{len(arr)})"
        )
    if delta_prior_raw:
        d = np.array(delta_prior_raw)
        print(
            f"  |cda - cda_raw|: mean={d.mean():.3f} median={np.median(d):.3f} "
            f"max={d.max():.3f}"
        )
    if cdas_final:
        w = 1.0 / (np.array(sigmas_final) ** 2)
        agg = float(np.sum(np.array(cdas_final) * w) / np.sum(w))
        print(
            f"  agg CdA (inv-var, quality=ok only): {agg:.4f} "
            f"(n={len(cdas_final)})"
        )
        return agg
    return None


async def main():
    print("=" * 60)
    print("Adaptive prior: bound-hit rate + factor distribution + Δ agg")
    print("=" * 60)

    a1 = await run_config("Aéro drops", 0.30, 0.08)
    a2 = await run_config("Modérée cocottes", 0.34, 0.08)
    a3 = await run_config("Relâchée tops", 0.40, 0.10)

    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    vals = [x for x in (a1, a2, a3) if x is not None]
    if len(vals) >= 2:
        delta = max(vals) - min(vals)
        print(f"Δ agg CdA across priors: {delta:.4f}")
        print("Target: Δ < 0.010 (adaptive prior should not destabilise vs prior choice)")


asyncio.run(main())
