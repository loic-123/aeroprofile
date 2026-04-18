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
  // Solver agreement filter (P3): "off" (default) keeps all rides,
  // "medium" excludes low-confidence rides, "high" keeps only rides
  // where wind and Chung agree to < 2% AND neither hit a physical bound.
  minConfidence?: "off" | "medium" | "high";
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
    // Solver cross-check (B13): Chung's CdA on the same ride, the delta
    // between Chung and the main solver, and the confidence bucket derived
    // from it. Persisted so HistoryPage can filter and display these without
    // re-running the analysis. Undefined on legacy entries.
    chungCda?: number;
    solverCrossCheckDelta?: number;
    solverConfidence?: "high" | "medium" | "low" | "unknown";
    // Quality gate verdict from the backend (ok, bound_hit, sensor_miscalib,
    // sensor_miscalib_warn, prior_dominated, insufficient_data, ...).
    qualityStatus?: string;
    // CdA estimated without the position prior (pass 0 MLE). Persisted so
    // the user can retro-actively run the prior-invariance test from any
    // history entry (see scripts/compare_runs.py). Should be equal across
    // two runs that differ only in the position prior.
    cdaRaw?: number;
    // Human-readable explanation of the quality gate verdict. Lets
    // HistoryPage reconstruct the colour-coded exclusion reason without
    // re-running the analysis.
    qualityReason?: string;
    // Which backend solver produced the per-ride CdA (wind_inverse,
    // chung_ve, martin_ls). Useful to investigate why a small subset of
    // rides behaves differently from the majority.
    solverMethod?: string;
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

// --- Per-entry "ignore on charts" toggle ---
// A separate localStorage key tracks which history entries the user has
// muted for the stability chart and bias histogram. Default = none ignored.
// The entries themselves are NOT deleted; the user can re-include them with
// one click. Persisted across reloads.
const LS_IGNORED_KEY = "aeroprofile_history_ignored";

export function getIgnoredEntryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_IGNORED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function setIgnoredEntryIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_IGNORED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}
