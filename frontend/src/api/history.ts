/**
 * Analysis history: persists aggregate results in localStorage
 * so the user can review past analyses across sessions.
 */

const LS_KEY = "aeroprofile_history";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  id: string;
  timestamp: string;           // ISO date of when analysis was run
  mode: "single" | "intervals" | "compare";
  label: string;               // user-friendly label (e.g. "5 sorties via Intervals" or "loic_ride.fit")

  // Aggregate results
  cda: number;
  cdaLow: number | null;
  cdaHigh: number | null;
  crr: number;
  rmseW: number;
  avgPowerW: number;
  avgRho: number;

  // Config used
  bikeType: string;
  positionLabel: string;
  massKg: number;
  crrFixed: number | null;
  cdaPriorMean: number | null;
  cdaPriorSigma: number | null;
  // Quality threshold
  maxNrmse: number | null;
  // Cache setting
  useCache: boolean | null;
  // Multi-ride: whether the prior was disabled (always true for n>=2 since the fix)
  disablePrior?: boolean;
  // Aggregation method used to compute the headline CdA on multi-ride entries.
  //   "inverse_var" : Method A (per-ride MLE + inverse-variance mean)
  //   "hierarchical": Method B (joint random-effects, mu/tau/Crr)
  //   "single"      : single-file analysis, no aggregation
  aggregationMethod?: "inverse_var" | "hierarchical" | "single";
  // Method B output (when available)
  hierarchicalMu?: number;
  hierarchicalTau?: number;
  // Intervals-specific: date range + ride filters
  dateFrom?: string;
  dateTo?: string;
  minDistanceKm?: number;
  maxDistanceKm?: number;
  maxElevationM?: number;
  maxElevationPerKm?: number;
  minDurationH?: number;
  excludeGroup?: boolean;
  // Sensor — stores the most-frequent power meter seen in the analysed rides
  powerMeterLabel?: string;     // e.g. "Favero Assioma (Duo / Pro)" or "Mixed (2 meters)"
  powerMeterQuality?: "high" | "medium" | "low" | "unknown";
  // Median measured-vs-theoretical power bias ratio across the ok rides
  powerBiasRatio?: number;
  // Athlete/profile identity — critical for keeping multi-rider histories
  // separable in the rolling-std chart and conformal prediction.
  //   athleteKey  : stable technical id (e.g. "intervals:i267366" or "local:moi")
  //   athleteName : user-facing label
  // Both are optional for backward-compat; migration on load best-efforts
  // extracts them from the legacy `label` field.
  athleteKey?: string;
  athleteName?: string;
  // Bike profile — from Intervals.icu's `gear.id` (stable per bike on a
  // given athlete). The `bikeLabel` is a display-friendly form: the gear
  // name if the user set one, otherwise "Vélo <gear_id>".
  bikeKey?: string;
  bikeLabel?: string;

  // Stats
  nRides: number;
  nExcluded: number;
  nTotalPoints: number;

  // Per-ride CdA values (for sparkline / evolution). The optional fields
  // are populated on newer entries and enable richer history views:
  //   biasRatio: power-meter calibration ratio (for the bias histogram)
  //   powerMeter: per-ride sensor label (when rides in one aggregate mix
  //     different sensors; mostly useful in Intervals batches)
  rideCdas: {
    date: string;
    cda: number;
    nrmse: number;
    biasRatio?: number;
    powerMeter?: string;
  }[];
}

/** Extract an athlete name from a legacy entry label. The label format for
 *  intervals entries is:
 *      "{N} sorties via Intervals.icu ({athlete name})"
 *  Returns null if no pattern matches. */
function _parseAthleteFromLabel(label: string): string | null {
  const m = label.match(/Intervals\.icu\s*\(([^)]+)\)/);
  if (m) return m[1].trim();
  return null;
}

function _migrateEntry(e: HistoryEntry): HistoryEntry {
  // If athleteKey is already set, nothing to do.
  if (e.athleteKey) return e;
  // Best-effort: extract athlete name from the label (intervals mode only)
  const parsed = e.mode === "intervals" ? _parseAthleteFromLabel(e.label) : null;
  if (parsed) {
    // Use the parsed name as a stable-ish key (lower, no spaces). Not
    // technically unique across users with the same name, but it's good
    // enough for separating "Loïc" and "Laurette" in a local history.
    const key = `legacy:${parsed.toLowerCase().replace(/\s+/g, "_")}`;
    return { ...e, athleteKey: key, athleteName: parsed };
  }
  return e;
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as HistoryEntry[];
    // Apply best-effort migration for legacy entries that don't yet have an
    // athleteKey. This runs on every read but is idempotent and cheap.
    return entries.map(_migrateEntry);
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): void {
  try {
    const existing = getHistory();
    existing.unshift(entry); // newest first
    // Cap at MAX_ENTRIES
    if (existing.length > MAX_ENTRIES) existing.length = MAX_ENTRIES;
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
  } catch {
    // localStorage full — silently ignore
  }
}

export function deleteFromHistory(id: string): void {
  try {
    const existing = getHistory().filter((e) => e.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
  } catch {}
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
