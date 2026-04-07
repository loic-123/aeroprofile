/**
 * Local cache for analysis results. Stores in localStorage keyed by a
 * hash of (filename + size + lastModified) so the same file isn't
 * re-analyzed when dropped again.
 */

import type { AnalysisResult } from "../types";

const CACHE_PREFIX = "aeroprofile_cache_";
const CACHE_VERSION = "v2";

function fileKey(file: File): string {
  // Deterministic key from file metadata (name + size + lastModified)
  const raw = `${CACHE_VERSION}:${file.name}:${file.size}:${file.lastModified}`;
  // Simple hash (djb2)
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) & 0xffffffff;
  }
  return CACHE_PREFIX + h.toString(36);
}

export function getCached(file: File): AnalysisResult | null {
  try {
    const key = fileKey(file);
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

export function setCache(file: File, result: AnalysisResult): void {
  try {
    const key = fileKey(file);
    localStorage.setItem(key, JSON.stringify(result));
  } catch {
    // localStorage full or unavailable — silently ignore
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
