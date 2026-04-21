import type { ProfileData } from "../types";

export interface CdASegmentFeature {
  type: "Feature";
  properties: {
    cda: number | null;
    distance_km: number;
    valid: boolean;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

export interface CdASegmentCollection {
  type: "FeatureCollection";
  features: CdASegmentFeature[];
}

export interface CdASegmentStats {
  q10: number;
  median: number;
  q90: number;
  min: number;
  max: number;
  count: number;
}

/** Return the p-th percentile of the sorted array (linear interp). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Aggregate per-sample lat/lon/cda_rolling into ~500m segments, each with
 * a mean CdA. Segments where all samples have null CdA (filtered) are
 * emitted as `valid: false` so the renderer can grey them out.
 *
 * Also returns quantile stats (p10/median/p90) of the valid segments for
 * driving the MapLibre interpolate palette.
 */
export function buildCdASegments(
  profile: ProfileData,
  samplesPerSegment = 10,
): { collection: CdASegmentCollection; stats: CdASegmentStats } {
  const n = profile.lat.length;
  const features: CdASegmentFeature[] = [];
  const validCdas: number[] = [];

  for (let i = 0; i < n; i += samplesPerSegment) {
    const end = Math.min(i + samplesPerSegment, n - 1);
    if (end <= i) break;
    const coords: [number, number][] = [];
    const cdas: number[] = [];
    for (let j = i; j <= end; j++) {
      coords.push([profile.lon[j], profile.lat[j]]);
      const c = profile.cda_rolling[j];
      if (c != null && Number.isFinite(c)) cdas.push(c);
    }
    if (coords.length < 2) continue;
    const mean =
      cdas.length > 0 ? cdas.reduce((a, b) => a + b, 0) / cdas.length : null;
    if (mean != null) validCdas.push(mean);
    features.push({
      type: "Feature",
      properties: {
        cda: mean,
        distance_km: profile.distance_km[Math.floor((i + end) / 2)] ?? 0,
        valid: mean != null,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  const sorted = [...validCdas].sort((a, b) => a - b);
  const stats: CdASegmentStats = {
    q10: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    q90: percentile(sorted, 0.9),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    count: sorted.length,
  };

  // Guard against rides where q10 and q90 collapse (short ride, uniform
  // CdA). Widen to the absolute palette 0.22 / 0.32 / 0.42 so the map
  // still gets a legible gradient.
  if (stats.q90 - stats.q10 < 0.02) {
    stats.q10 = 0.22;
    stats.median = 0.32;
    stats.q90 = 0.42;
  }

  return { collection: { type: "FeatureCollection", features }, stats };
}
