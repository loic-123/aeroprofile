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
  min_distance_km: 30,
  max_distance_km: 500,
  max_elevation_m: 2000,
  min_duration_h: 1.0,
  max_elevation_per_km: 25,  // 25 m/km = 2.5% average grade
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
  const res = await fetch(`${API}/analyze-ride`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
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
