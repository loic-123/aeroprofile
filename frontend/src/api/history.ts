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

  // Stats
  nRides: number;
  nExcluded: number;
  nTotalPoints: number;

  // Per-ride CdA values (for sparkline / evolution)
  rideCdas: { date: string; cda: number }[];
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
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
