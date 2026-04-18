// Inverse-variance weighted aggregation across multiple rides.
//
// Historically this logic lived in 4 places (App.tsx display, App.tsx save,
// CompareMode.tsx, IntervalsPage.tsx save) with 3 subtly different formulas:
// save-to-history used w = valid_points × quality while display used
// w = (1/σ²) × quality — so the CdA shown on screen differed from the one
// written to history. See plan item #1 for the full audit.
//
// Single source of truth, used everywhere:
//   w_i = (1 / σ_i²) × quality_i
//   σ_i = (cda_ci_high − cda_ci_low) / 3.92       // CI95 → 1σ
//   quality_i ∈ [1, 3]                             // linear in nRMSE rank
//
// IC95 on the weighted mean uses the standard error from the weighted
// variance divided by the EFFECTIVE sample size n_eff = (Σw)² / Σw²
// (Kish 1965) — matches the weighting scheme and gives a sensible width
// when one ride dominates.
//
// References:
//   Kish L. (1965). Survey Sampling. Wiley. — effective sample size
//   DerSimonian & Laird (1986) — inverse-variance weighted mean (fixed
//   effects). The random-effects upgrade (with τ²) runs server-side in
//   aeroprofile/solver/hierarchical.py.

export interface AggregationInput {
  cda: number;
  crr: number;
  cdaCiLow?: number | null;
  cdaCiHigh?: number | null;
  avgPowerW: number;
  avgRho?: number;
  avgSpeedKmh?: number;
  rmseW: number;
  validPoints?: number;
}

export interface AggregationResult {
  cda: number;
  cdaLow: number;
  cdaHigh: number;
  crr: number;
  avgPowerW: number;
  avgRho: number;
  avgSpeedKmh: number;
  rmseW: number;
  nRides: number;
  nEff: number;
  weights: number[];
}

const DEFAULT_SIGMA = 0.05; // fallback when the per-ride CI is missing
const MIN_SIGMA = 0.001;

function qualityWeight(nrmse: number, bestN: number, span: number): number {
  // Maps the nRMSE of this ride to a [1, 3] multiplier. Best ride = 3,
  // worst retained ride = 1. If all rides have essentially the same nRMSE,
  // fall back to a neutral 2.0 so the weights stay well-defined.
  if (span <= 0.001) return 2.0;
  return 3.0 - (2.0 * (nrmse - bestN)) / span;
}

export function weightedAggregate(rides: AggregationInput[]): AggregationResult | null {
  if (rides.length === 0) return null;

  // Per-ride nRMSE, floor at 1% so a perfect-fit ride doesn't divide by zero
  // and doesn't dominate the quality factor.
  const nrmses = rides.map((r) => Math.max((r.rmseW || 0) / Math.max(r.avgPowerW, 1), 0.01));
  const bestN = Math.min(...nrmses);
  const worstN = Math.max(...nrmses);
  const span = worstN - bestN;

  const weights: number[] = [];
  let totalW = 0;
  let sCda = 0, sCrr = 0, sPower = 0, sRho = 0, sSpeed = 0, sRmse = 0;

  for (let i = 0; i < rides.length; i++) {
    const r = rides[i];
    const ciLow = r.cdaCiLow ?? 0;
    const ciHigh = r.cdaCiHigh ?? 0;
    const ciWidth = ciHigh - ciLow;
    const sigma = ciWidth > 0 ? Math.max(ciWidth / 3.92, MIN_SIGMA) : DEFAULT_SIGMA;
    const invVar = 1 / (sigma * sigma);
    const qw = qualityWeight(nrmses[i], bestN, span);
    const w = invVar * qw;
    weights.push(w);
    totalW += w;
    sCda += r.cda * w;
    sCrr += r.crr * w;
    sPower += r.avgPowerW * w;
    sRho += (r.avgRho ?? 0) * w;
    sSpeed += (r.avgSpeedKmh ?? 0) * w;
    sRmse += (r.rmseW || 0) * w;
  }

  const cda = sCda / totalW;

  // IC95 from the weighted variance, divided by the effective sample size.
  // Single-ride case: use the ride's own CI95 if available, else fall back
  // to point-estimate width 0 (caller should handle).
  let cdaLow = cda;
  let cdaHigh = cda;
  let nEff = 1;

  if (rides.length >= 2) {
    let wVar = 0;
    for (let i = 0; i < rides.length; i++) {
      wVar += weights[i] * (rides[i].cda - cda) ** 2;
    }
    wVar /= totalW;
    const sumW2 = weights.reduce((a, w) => a + w * w, 0);
    nEff = (totalW * totalW) / sumW2;
    const se = Math.sqrt(wVar / nEff);
    cdaLow = cda - 1.96 * se;
    cdaHigh = cda + 1.96 * se;
  } else if (rides.length === 1) {
    const r = rides[0];
    if (r.cdaCiLow != null && r.cdaCiHigh != null && r.cdaCiLow > 0) {
      cdaLow = r.cdaCiLow;
      cdaHigh = r.cdaCiHigh;
    }
  }

  return {
    cda,
    cdaLow,
    cdaHigh,
    crr: sCrr / totalW,
    avgPowerW: sPower / totalW,
    avgRho: sRho / totalW,
    avgSpeedKmh: sSpeed / totalW,
    rmseW: sRmse / totalW,
    nRides: rides.length,
    nEff,
    weights,
  };
}
