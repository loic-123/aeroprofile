/**
 * Local profiles for upload-mode analyses.
 *
 * The upload path has no external identity (unlike Intervals.icu which
 * gives us an athlete id), so we let the user curate a small list of
 * profiles in localStorage: "Moi", "Laurette", "Test prior", etc.
 *
 * Each profile has a stable key (derived from the name) and a display
 * name. The key is stored on HistoryEntry.athleteKey so the history page
 * can separate analyses from different riders correctly.
 *
 * We pre-seed a "Moi" profile on first use so the user has a sensible
 * default without configuration.
 */

const LS_KEY = "aeroprofile_profiles";
const LS_ACTIVE = "aeroprofile_active_profile";

export interface LocalProfile {
  key: string;   // e.g. "local:moi"
  name: string;  // e.g. "Moi"
}

const DEFAULT_PROFILE: LocalProfile = { key: "local:moi", name: "Moi" };

function _load(): LocalProfile[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [DEFAULT_PROFILE];
    const arr = JSON.parse(raw) as LocalProfile[];
    if (!Array.isArray(arr) || arr.length === 0) return [DEFAULT_PROFILE];
    return arr;
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

export function getProfiles(): LocalProfile[] {
  return _load();
}

/** Get the currently active profile (for upload mode). Defaults to "Moi". */
export function getActiveProfile(): LocalProfile {
  try {
    const key = localStorage.getItem(LS_ACTIVE);
    if (key) {
      const found = _load().find((p) => p.key === key);
      if (found) return found;
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

/** Create a new profile from a display name and make it active. */
export function addProfile(name: string): LocalProfile {
  const trimmed = name.trim();
  if (!trimmed) return getActiveProfile();
  // Key is deterministic: lowercase, non-alnum → underscore.
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const key = `local:${slug || "profile"}`;
  const list = _load();
  if (!list.find((p) => p.key === key)) {
    list.push({ key, name: trimmed });
    _save(list);
  }
  setActiveProfile(key);
  return { key, name: trimmed };
}

export function deleteProfile(key: string): void {
  const list = _load().filter((p) => p.key !== key);
  // Always keep at least the default profile
  _save(list.length > 0 ? list : [DEFAULT_PROFILE]);
  if (getActiveProfile().key === key) {
    setActiveProfile(DEFAULT_PROFILE.key);
  }
}
