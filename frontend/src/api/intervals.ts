import type { AnalysisResult, HierarchicalAnalysisResult } from "../types";

const API = "/api/intervals";

export interface AthleteProfile {
  id: string;
  name: string;
  weight_kg: number;
  ftp: number;
}

export interface ActivitySummary {
  id: string;
  name: string;
  activity_type: string;
  start_date: string;
  distance_km: number;
  moving_time_s: number;
  elevation_gain_m: number;
  average_watts: number;
  has_power: boolean;
  indoor: boolean;
  power_meter?: string | null;
  gear_id?: string | null;
  gear_name?: string | null;
}

export interface RideFilters {
  min_distance_km: number;
  max_distance_km: number;
  max_elevation_m: number;
  min_duration_h: number;
  // Client-side only: max ratio D+/distance (m per km).
  // A ride with more than this is probably a climb, where the aero signal is
  // too weak to separate CdA from Crr reliably. Not sent to the backend.
  max_elevation_per_km?: number;
}

export const DEFAULT_FILTERS: RideFilters = {
  min_distance_km: 20,
  max_distance_km: 500,
  // Absolute D+ cap kept at a practically unreachable value — the UI no
  // longer exposes it as a control because ``max_elevation_per_km`` is a
  // better physical proxy (a 400 km loop with 5000 m D+ = 12 m/km is a
  // perfectly flat CdA ride, while 60 km with 2000 m D+ = 33 m/km is a
  // climb). The field stays in the schema for backward compatibility.
  max_elevation_m: 99999,
  min_duration_h: 0.5,  // 30 min
  max_elevation_per_km: 10,  // 10 m/km = 1% average grade
};

export async function connect(apiKey: string, athleteId: string): Promise<AthleteProfile> {
  const res = await fetch(`${API}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, athlete_id: athleteId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listActivities(
  apiKey: string,
  athleteId: string,
  oldest: string,
  newest: string,
  filters: RideFilters,
): Promise<{ total: number; filtered: number; activities: ActivitySummary[] }> {
  const fd = new FormData();
  fd.append("api_key", apiKey);
  fd.append("athlete_id", athleteId);
  fd.append("oldest", oldest);
  fd.append("newest", newest);
  fd.append("min_distance_km", String(filters.min_distance_km));
  fd.append("max_distance_km", String(filters.max_distance_km));
  fd.append("max_elevation_m", String(filters.max_elevation_m));
  fd.append("min_duration_h", String(filters.min_duration_h));
  const res = await fetch(`${API}/list`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Dump the session metadata (profile + filters + sensor selection) to
 *  the server log as a single SESSION_START line. Called once at the
 *  beginning of each analysis run so the backend log has the full
 *  context in one place, alongside the per-ride ANALYZE lines. */
export async function logAnalysisSession(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API}/log-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently ignore — logging failures should never block an analysis
  }
}

// HTTP statuses that indicate a transient server / proxy issue where
// the ride itself is fine — worth retrying a couple of times with
// backoff rather than reporting `err` to the user. Covers the 404 that
// Traefik returns when the backend is briefly evicted (unhealthy), the
// 503 we emit ourselves on analysis timeout, and the 502/504 that
// appear when the reverse proxy times out on a slow upstream.
const RETRY_STATUSES = new Set([404, 500, 502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeRide(
  apiKey: string,
  athleteId: string,
  activityId: string,
  massKg: number,
  crrFixed?: number | null,
  bikeType?: string,
  cdaPriorMean?: number,
  cdaPriorSigma?: number,
  disablePrior?: boolean,
): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("api_key", apiKey);
  fd.append("athlete_id", athleteId);
  fd.append("activity_id", activityId);
  fd.append("mass_kg", String(massKg));
  if (crrFixed != null) fd.append("crr_fixed", String(crrFixed));
  if (bikeType) fd.append("bike_type", bikeType);
  if (disablePrior) fd.append("disable_prior", "true");
  if (cdaPriorMean && cdaPriorMean > 0 && !disablePrior) fd.append("cda_prior_mean", String(cdaPriorMean));
  if (cdaPriorSigma && cdaPriorSigma > 0 && !disablePrior) fd.append("cda_prior_sigma", String(cdaPriorSigma));

  // Up to 3 attempts: if the backend is momentarily overloaded or Traefik
  // has just evicted an unhealthy container, a 2-4 s pause is enough for
  // the healthcheck to go green again. A true 404 (activity purged by
  // Intervals) will persist through all 3 attempts and still surface.
  const MAX_ATTEMPTS = 3;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${API}/analyze-ride`, { method: "POST", body: fd });
      if (res.ok) return res.json();
      // 422 = client error (bad file, bad params): never worth retrying.
      if (res.status === 422 || !RETRY_STATUSES.has(res.status)) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      // Transient server/proxy error — read the detail for the final
      // error message but keep retrying.
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      lastErr = new Error(err.detail || `HTTP ${res.status}`);
    } catch (e) {
      // Network error (TypeError from fetch) — also transient, retry.
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      // Backoff: 1.5 s, then 3 s. Enough for a container restart cycle
      // without keeping the user staring at a spinner forever.
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error("Analyse échouée après plusieurs tentatives");
}

export async function analyzeBatchIntervals(
  apiKey: string,
  athleteId: string,
  activityIds: string[],
  massKg: number,
  crrFixed?: number | null,
  bikeType?: string,
  cdaPriorMean?: number,
  cdaPriorSigma?: number,
): Promise<HierarchicalAnalysisResult> {
  const fd = new FormData();
  fd.append("api_key", apiKey);
  fd.append("athlete_id", athleteId);
  fd.append("activity_ids", activityIds.join(","));
  fd.append("mass_kg", String(massKg));
  if (crrFixed != null) fd.append("crr_fixed", String(crrFixed));
  if (bikeType) fd.append("bike_type", bikeType);
  if (cdaPriorMean && cdaPriorMean > 0) fd.append("cda_prior_mean", String(cdaPriorMean));
  if (cdaPriorSigma && cdaPriorSigma > 0) fd.append("cda_prior_sigma", String(cdaPriorSigma));
  const res = await fetch(`${API}/analyze-batch`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
