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
 * Perpendicular distance from point p to the line (a, b), in degrees. We
 * treat lon/lat as 2D — fine at the sub-km scale Douglas-Peucker operates
 * on for simplifying a ride polyline.
 */
function _perpDist(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    const ddx = p[0] - a[0];
    const ddy = p[1] - a[1];
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const tc = Math.max(0, Math.min(1, t));
  const cx = a[0] + tc * dx;
  const cy = a[1] + tc * dy;
  const ddx = p[0] - cx;
  const ddy = p[1] - cy;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

/**
 * Douglas-Peucker polyline simplification, iterative implementation to
 * avoid recursion stack blowups on long rides. `epsilon` is in degrees;
 * 1e-5 ≈ 1.1 m at the equator, 0.7 m at 45°N — below rendering precision
 * on the typical ride scale.
 */
function simplifyDP(
  points: [number, number][],
  epsilon: number,
): [number, number][] {
  const n = points.length;
  if (n <= 2) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (hi <= lo + 1) continue;
    let maxD = 0;
    let maxIdx = -1;
    const a = points[lo];
    const b = points[hi];
    for (let i = lo + 1; i < hi; i++) {
      const d = _perpDist(points[i], a, b);
      if (d > maxD) {
        maxD = d;
        maxIdx = i;
      }
    }
    if (maxD > epsilon && maxIdx > 0) {
      keep[maxIdx] = 1;
      stack.push([lo, maxIdx]);
      stack.push([maxIdx, hi]);
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
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
  samplesPerSegment = 20,
  simplifyEpsilon = 1e-5,
): { collection: CdASegmentCollection; stats: CdASegmentStats } {
  const n = profile.lat.length;
  const features: CdASegmentFeature[] = [];
  const validCdas: number[] = [];

  // Adaptive epsilon for really long rides — 200 km would otherwise still
  // emit thousands of vertices after DP at 1e-5. Scale linearly with
  // distance above 100 km so the GPU load stays bounded.
  const totalKm = profile.distance_km?.[n - 1] ?? 0;
  const epsilon = totalKm > 100 ? simplifyEpsilon * (totalKm / 100) : simplifyEpsilon;

  for (let i = 0; i < n; i += samplesPerSegment) {
    const end = Math.min(i + samplesPerSegment, n - 1);
    if (end <= i) break;
    const rawCoords: [number, number][] = [];
    const cdas: number[] = [];
    for (let j = i; j <= end; j++) {
      rawCoords.push([profile.lon[j], profile.lat[j]]);
      const c = profile.cda_rolling[j];
      if (c != null && Number.isFinite(c)) cdas.push(c);
    }
    if (rawCoords.length < 2) continue;
    // Simplify each segment independently — keeps the property that
    // endpoints are preserved (so neighbouring segments stay contiguous).
    const coords = simplifyDP(rawCoords, epsilon);
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
