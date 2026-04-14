/**
 * Local profiles — a "setup" that the user can save and reload.
 *
 * A profile bundles ALL the parameters the user would otherwise retype on
 * each analysis: mass, bike type, position, Crr setting, nRMSE threshold,
 * ride filters, and the Intervals.icu credentials. Selecting a profile
 * pre-fills the form(s); a "Save to profile" button captures the current
 * state back into the active profile.
 *
 * The profile's `key` is also used as the `athleteKey` in the history,
 * which keeps the rolling-std timeline and the conformal prediction
 * calibration set per-rider.
 */

const LS_KEY = "aeroprofile_profiles";
const LS_ACTIVE = "aeroprofile_active_profile";

// --- Profile payload ------------------------------------------------------

export interface IntervalsFilterPayload {
  minDistanceKm?: number;
  maxDistanceKm?: number;
  maxElevationM?: number;
  maxElevationPerKm?: number;
  minDurationH?: number;
  excludeGroup?: boolean;
}

export interface ProfileSettings {
  massKg?: number;
  bikeType?: "road" | "tt" | "mtb";
  positionIdx?: number;         // index in POSITION_PRESETS_BY_BIKE[bikeType]
  crrFixed?: number | null;     // null = auto
  maxNrmse?: number;            // percent (e.g. 45)
  // Intervals-specific
  intervalsApiKey?: string;
  intervalsAthleteId?: string;
  intervalsFilters?: IntervalsFilterPayload;
}

export interface LocalProfile {
  key: string;
  name: string;
  settings?: ProfileSettings;
}

// --- Defaults -------------------------------------------------------------

const DEFAULT_SETTINGS: ProfileSettings = {
  massKg: 75,
  bikeType: "road",
  positionIdx: 2, // "Aéro (drops)" on road
  crrFixed: null,
  maxNrmse: 45,
};

const DEFAULT_PROFILE: LocalProfile = {
  key: "local:moi",
  name: "Moi",
  settings: { ...DEFAULT_SETTINGS },
};

// --- Storage helpers ------------------------------------------------------

function _load(): LocalProfile[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [DEFAULT_PROFILE];
    const arr = JSON.parse(raw) as LocalProfile[];
    if (!Array.isArray(arr) || arr.length === 0) return [DEFAULT_PROFILE];
    // Ensure every profile has settings (migrate old 2-field profiles)
    return arr.map((p) => (p.settings ? p : { ...p, settings: { ...DEFAULT_SETTINGS } }));
  } catch {
    return [DEFAULT_PROFILE];
  }
}

function _save(list: LocalProfile[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// --- Public API -----------------------------------------------------------

export function getProfiles(): LocalProfile[] {
  return _load();
}

/** Get the currently active profile. Defaults to "Moi" when the user has
 *  never explicitly picked one. The returned object is always populated
 *  with `settings` (empty profiles fall back to the defaults). */
export function getActiveProfile(): LocalProfile {
  try {
    const key = localStorage.getItem(LS_ACTIVE);
    if (key) {
      const found = _load().find((p) => p.key === key);
      if (found) return found.settings ? found : { ...found, settings: { ...DEFAULT_SETTINGS } };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROFILE;
}

export function setActiveProfile(key: string): void {
  try {
    localStorage.setItem(LS_ACTIVE, key);
  } catch {
    // ignore
  }
}

/** Create a new profile from a display name and make it active.
 *  If ``settings`` is provided, the new profile is pre-populated with it
 *  (so the caller can clone the current form state). Otherwise it gets
 *  the default settings. */
export function addProfile(name: string, settings?: ProfileSettings): LocalProfile {
  const trimmed = name.trim();
  if (!trimmed) return getActiveProfile();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const key = `local:${slug || "profile"}`;
  const list = _load();
  const existing = list.find((p) => p.key === key);
  const finalSettings = settings || { ...DEFAULT_SETTINGS };
  if (existing) {
    existing.settings = finalSettings;
  } else {
    list.push({ key, name: trimmed, settings: finalSettings });
  }
  _save(list);
  setActiveProfile(key);
  return { key, name: trimmed, settings: finalSettings };
}

export function deleteProfile(key: string): void {
  const list = _load().filter((p) => p.key !== key);
  _save(list.length > 0 ? list : [DEFAULT_PROFILE]);
  if (getActiveProfile().key === key) {
    setActiveProfile(DEFAULT_PROFILE.key);
  }
}

/** Overwrite the settings of the active profile (or a specific key).
 *  Used by the "Save to profile" button in ProfilePicker and the forms. */
export function saveProfileSettings(settings: ProfileSettings, key?: string): void {
  const targetKey = key ?? getActiveProfile().key;
  const list = _load();
  const target = list.find((p) => p.key === targetKey);
  if (!target) return;
  target.settings = { ...(target.settings || {}), ...settings };
  _save(list);
}
