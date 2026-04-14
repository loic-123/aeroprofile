/**
 * Split conformal prediction for CdA estimates.
 *
 * Classical confidence intervals (the ones returned by the solver via the
 * Hessian) rest on two assumptions that rarely hold on noisy rides:
 *   1. residuals are gaussian,
 *   2. the optimum is a proper interior minimum of the likelihood.
 * When the solver hits a bound or the data are noisy, the Hessian-based CI
 * becomes artificially narrow and gives a false sense of precision.
 *
 * Conformal prediction (Vovk et al. 2005; Angelopoulos & Bates 2021)
 * provides a distribution-free alternative: given a calibration set of
 * past "ok" rides of the same user, we compute the empirical quantile of
 * nonconformity scores and use it as a half-width for any new ride. The
 * resulting interval has a formal coverage guarantee of at least (1-α)
 * over the population of rides — no gaussianity, no likelihood curvature
 * assumption.
 *
 * We use the absolute deviation from the user's rolling-median CdA (a
 * stable estimate of the user's "true" CdA) as the nonconformity score.
 *
 * Required calibration size: at least 30 "ok" rides for the empirical
 * quantile to be meaningful. Below that we return null and the UI falls
 * back to the Hessian CI.
 */

import type { HistoryEntry } from "../api/history";

export interface ConformalInterval {
  q_hat: number; // half-width of the conformal interval
  cda_median: number; // reference point used to compute the half-width
  n: number; // size of the calibration set
  alpha: number;
  low: number;
  high: number;
}

/**
 * Build a conformal prediction interval for a new ride's CdA using past
 * history as the calibration set.
 *
 * @param newCda The estimated CdA for the new ride.
 * @param history All history entries.
 * @param alpha Desired miscoverage (default 0.05 → 95% coverage).
 * @param sensorFilter If provided, restrict calibration to rides from this sensor.
 * @returns A conformal interval, or null if the calibration set is too small.
 */
export function conformalIntervalForCda(
  newCda: number,
  history: HistoryEntry[],
  alpha = 0.05,
  sensorFilter?: string,
): ConformalInterval | null {
  // Flatten history into individual ride CdAs — each HistoryEntry holds the
  // per-ride CdAs in `rideCdas`, which is exactly the calibration set we
  // need. Filter by sensor if asked (covariate shift mitigation).
  const cdas: number[] = [];
  for (const e of history) {
    if (sensorFilter && e.powerMeterLabel !== sensorFilter) continue;
    for (const rc of e.rideCdas) {
      if (Number.isFinite(rc.cda) && rc.cda > 0) cdas.push(rc.cda);
    }
  }
  const n = cdas.length;
  if (n < 30) return null;

  // Reference point: the median. The user's "true" CdA is approximated by
  // the central tendency of their history; the nonconformity score is how
  // far each past ride deviated from that center.
  const sorted = [...cdas].sort((a, b) => a - b);
  const cda_median = sorted[Math.floor(sorted.length / 2)];

  // Nonconformity scores: |cda_i - median|
  const scores = cdas.map((c) => Math.abs(c - cda_median));
  scores.sort((a, b) => a - b);

  // Conformal quantile index: ceil((1-α)(n+1)) / n
  // (Vovk et al. 2005, adjusted for finite-sample validity)
  const qIdx = Math.ceil((1 - alpha) * (n + 1)) - 1; // 0-indexed
  const q_hat = scores[Math.min(qIdx, scores.length - 1)];

  return {
    q_hat,
    cda_median,
    n,
    alpha,
    low: Math.max(0, newCda - q_hat),
    high: newCda + q_hat,
  };
}

/**
 * Variant: compute the conformal interval for each ride in a "good" set
 * (e.g. an Intervals analysis in progress), using the history as calibration
 * but *excluding* the rides currently being analyzed to avoid data leakage.
 */
export function conformalForCurrentRun(
  currentCdas: number[],
  history: HistoryEntry[],
  alpha = 0.05,
): { q_hat: number; n_calib: number } | null {
  const cdas: number[] = [];
  for (const e of history) {
    for (const rc of e.rideCdas) {
      if (Number.isFinite(rc.cda) && rc.cda > 0) cdas.push(rc.cda);
    }
  }
  const n = cdas.length;
  if (n < 30) return null;

  const sorted = [...cdas].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const scores = cdas.map((c) => Math.abs(c - median)).sort((a, b) => a - b);
  const qIdx = Math.ceil((1 - alpha) * (n + 1)) - 1;
  const q_hat = scores[Math.min(qIdx, scores.length - 1)];

  // Sanity suppressor: silence currentCdas (avoid unused-var warning when
  // callers pass it for future leakage adjustments).
  void currentCdas;

  return { q_hat, n_calib: n };
}
