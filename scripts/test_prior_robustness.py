"""Test robustness of CdA estimation to prior choice on rider-C's rides.

Compares two methods:
 1. Old (with prior, original formula): expect large Δ between priors
 2. New (with prior, fixed formula): expect smaller Δ
 3. New (disabled prior): expect Δ ≈ 0

Inverse-variance aggregation is used in all cases (matches frontend).
"""
import asyncio
import os
import sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

from aeroprofile.pipeline import analyze

RIDES_DIR = "tests/fixtures/laurette"

if not os.path.isdir(RIDES_DIR):
    print(f"ERROR: {RIDES_DIR} not found. The rider-C dataset is gitignored.")
    sys.exit(1)

files = sorted(
    [os.path.join(RIDES_DIR, f) for f in os.listdir(RIDES_DIR) if f.endswith(".fit")]
)[:30]
print(f"Testing on {len(files)} rider-C rides\n")


def inverse_variance_mean(cdas, sigmas):
    """Inverse-variance weighted mean (matches frontend aggregation)."""
    cdas = np.array(cdas, dtype=float)
    sigmas = np.array(sigmas, dtype=float)
    # Replace NaN/Inf sigmas with a fallback value (CI degenerate)
    sigmas = np.where(np.isfinite(sigmas), sigmas, 0.05)
    sigmas = np.maximum(sigmas, 0.001)
    valid = np.isfinite(cdas)
    cdas = cdas[valid]
    sigmas = sigmas[valid]
    if len(cdas) == 0:
        return float("nan")
    w = 1.0 / (sigmas * sigmas)
    return float(np.sum(cdas * w) / np.sum(w))


async def run(label, prior_mean=None, prior_sigma=None, disable_prior=False):
    cdas = []
    sigmas = []
    nrmses = []
    for f in files:
        try:
            r = await analyze(
                f,
                mass_kg=70,
                bike_type="road",
                cda_prior_override=(prior_mean, prior_sigma) if prior_mean else None,
                disable_prior=disable_prior,
                fetch_wx=True,
            )
            nrmse = (r.rmse_w or 0) / max(r.avg_power_w, 1)
            # Loose quality gate for the test (we want to compare same set of rides)
            if nrmse > 0.99 or r.cda < 0.10 or r.cda > 0.80:
                continue
            sigma = (r.cda_ci[1] - r.cda_ci[0]) / 3.92
            if not np.isfinite(sigma) or sigma <= 0:
                sigma = 0.05  # fallback
            cdas.append(r.cda)
            sigmas.append(sigma)
            nrmses.append(nrmse)
        except Exception:
            continue
    if len(cdas) == 0:
        print(f"  {label}: no rides retained")
        return None
    agg = inverse_variance_mean(cdas, sigmas)
    print(f"  {label}: agg CdA={agg:.4f}  (n={len(cdas)} rides, mean nRMSE={np.mean(nrmses)*100:.0f}%)")
    return agg


async def main():
    print("=" * 60)
    print("Test: prior CdA influence on aggregated CdA")
    print("=" * 60)

    print("\n[A] Avec prior 'Aéro drops' (0.30, 0.08):")
    a1 = await run("  agg", prior_mean=0.30, prior_sigma=0.08)

    print("\n[B] Avec prior 'Modérée cocottes' (0.34, 0.08):")
    a2 = await run("  agg", prior_mean=0.34, prior_sigma=0.08)

    print("\n[C] Avec prior 'Relâchée tops' (0.40, 0.10):")
    a3 = await run("  agg", prior_mean=0.40, prior_sigma=0.10)

    print("\n[D] SANS prior (disable_prior=True):")
    a4 = await run("  agg", disable_prior=True)

    print("\n" + "=" * 60)
    print("RÉSULTATS")
    print("=" * 60)
    if all(x is not None for x in [a1, a2, a3]):
        delta_with_prior = max(a1, a2, a3) - min(a1, a2, a3)
        print(f"Δ avec prior actif (drops/cocottes/tops):  {delta_with_prior:.4f}")
    if a4 is not None:
        print(f"CdA sans prior:  {a4:.4f}")
        if a1 is not None and a3 is not None:
            print(f"Écart drops vs no-prior:  {abs(a1 - a4):.4f}")
            print(f"Écart tops vs no-prior:   {abs(a3 - a4):.4f}")

    print("\nObjectif: Δ avec prior doit être < 0.010 (était 0.044 avant le fix)")
    print("Objectif: les écarts no-prior devraient être < 0.005")


asyncio.run(main())
