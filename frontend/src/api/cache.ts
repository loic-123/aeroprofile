/**
 * Local cache for analysis results. Stores in localStorage keyed by a
 * hash of (filename + size + lastModified) so the same file isn't
 * re-analyzed when dropped again.
 */

import type { AnalysisResult } from "../types";

const CACHE_PREFIX = "aeroprofile_cache_";
const CACHE_VERSION = "v7";

export interface CacheOpts {
  mass_kg: number;
  crr_fixed?: number | null;
  eta?: number;
  wind_height_factor?: number;
  bike_type?: string;
  cda_prior_mean?: number;
  cda_prior_sigma?: number;
  disable_prior?: boolean;
}

function fileKey(file: File, opts?: CacheOpts): string {
  const optsStr = opts
    ? `:m${opts.mass_kg}:crr${opts.crr_fixed ?? "auto"}:eta${opts.eta ?? "def"}:wf${opts.wind_height_factor ?? "def"}:bt${opts.bike_type ?? "road"}:pm${opts.cda_prior_mean ?? "def"}:ps${opts.cda_prior_sigma ?? "def"}:dp${opts.disable_prior ? 1 : 0}`
    : "";
  const raw = `${CACHE_VERSION}:${file.name}:${file.size}:${file.lastModified}${optsStr}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) & 0xffffffff;
  }
  return CACHE_PREFIX + h.toString(36);
}

export function getCached(file: File, opts?: CacheOpts): AnalysisResult | null {
  try {
    const key = fileKey(file, opts);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check
    if (typeof parsed.cda === "number" && typeof parsed.crr === "number") {
      return parsed as AnalysisResult;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCache(file: File, result: AnalysisResult, opts?: CacheOpts): void {
  try {
    const key = fileKey(file, opts);
    localStorage.setItem(key, JSON.stringify(result));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Cache for Intervals.icu rides, keyed by activity_id + mass + crr.
 */
function intervalsKey(activityId: string, opts?: CacheOpts): string {
  const optsStr = opts
    ? `:m${opts.mass_kg}:crr${opts.crr_fixed ?? "auto"}:eta${opts.eta ?? "def"}:bt${opts.bike_type ?? "road"}:pm${opts.cda_prior_mean ?? "def"}:ps${opts.cda_prior_sigma ?? "def"}:dp${opts.disable_prior ? 1 : 0}`
    : "";
  const raw = `${CACHE_VERSION}:intervals:${activityId}${optsStr}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) & 0xffffffff;
  }
  return CACHE_PREFIX + h.toString(36);
}

export function getCachedInterval(activityId: string, opts?: CacheOpts): AnalysisResult | null {
  try {
    const key = intervalsKey(activityId, opts);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.cda === "number" && typeof parsed.crr === "number") {
      return parsed as AnalysisResult;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCacheInterval(activityId: string, result: AnalysisResult, opts?: CacheOpts): void {
  try {
    const key = intervalsKey(activityId, opts);
    localStorage.setItem(key, JSON.stringify(result));
  } catch {
    // ignore
  }
}

export function clearCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function cacheStats(): { count: number; sizeKB: number } {
  let count = 0;
  let size = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        count++;
        size += (localStorage.getItem(k) || "").length * 2; // UTF-16
      }
    }
  } catch {
    // ignore
  }
  return { count, sizeKB: Math.round(size / 1024) };
}
