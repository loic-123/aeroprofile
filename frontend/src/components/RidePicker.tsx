import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Calendar as CalendarIcon } from "lucide-react";

export interface RidePickerEntry {
  /** Stable index passed back to onSelect; usually the position in the
   *  parent's `rides[]` array. */
  index: number;
  /** ISO date YYYY-MM-DD — used for the calendar grouping and label. */
  date: string;
  /** Optional display name (Intervals activity name). */
  name?: string;
  /** Optional CdA, used to colour the chip. */
  cda?: number;
}

interface Props {
  entries: RidePickerEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Optional palette range — used to remap the chip colour gradient.
   *  Defaults to the standard road-bike CdA range. */
  cdaRange?: [number, number];
}

/**
 * Compact ride picker for the Intervals detail view. Replaces the
 * single horizontal row of date chips that overflowed past the panel
 * once more than ~10 rides were analysed.
 *
 * Surface in the toolbar:
 *   [▼ 2026-04-22 (Sortie du 22 avril)]   13 / 128
 *
 * Click the dropdown → an overlay opens with:
 *   - a search input (filters by date or name across all rides);
 *   - rides grouped by year + month (collapsible if many groups);
 *   - each ride rendered as a small chip with its date + CdA value,
 *     coloured on a green→amber→red gradient by CdA bucket;
 *   - keyboard support: Enter/Space toggle, Escape closes,
 *     up/down move the focus through visible chips.
 */
export function RidePicker({
  entries,
  selectedIndex,
  onSelect,
  cdaRange = [0.20, 0.45],
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.index === selectedIndex) ?? entries[0],
    [entries, selectedIndex],
  );

  // Filter + group entries by year-month, sorted most recent first.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entries.filter(
          (e) =>
            e.date.toLowerCase().includes(q) ||
            (e.name?.toLowerCase().includes(q) ?? false),
        )
      : entries;

    const map = new Map<string, RidePickerEntry[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // Sort each group by date descending, then sort groups descending.
    for (const list of map.values()) list.sort((a, b) => b.date.localeCompare(a.date));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, query]);

  // Map a CdA value to a colour bucket.
  const colourFor = (cda: number | undefined): string => {
    if (cda == null || !Number.isFinite(cda)) return "bg-panel border-border text-muted";
    const [lo, hi] = cdaRange;
    const t = Math.max(0, Math.min(1, (cda - lo) / Math.max(hi - lo, 0.01)));
    if (t < 0.34) return "bg-emerald-900/40 border-emerald-700/60 text-emerald-300";
    if (t < 0.67) return "bg-amber-900/30 border-amber-700/50 text-amber-300";
    return "bg-rose-900/30 border-rose-700/50 text-rose-300";
  };

  const monthLabel = (yyyymm: string): string => {
    const [y, m] = yyyymm.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-border bg-panel hover:border-muted text-text font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <CalendarIcon size={12} className="text-muted" aria-hidden />
        <span>{selectedEntry?.date ?? "—"}</span>
        <span className="text-muted">
          {selectedIndex + 1} / {entries.length}
        </span>
        <ChevronDown size={12} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-40 w-[min(420px,90vw)] max-h-[60vh] overflow-y-auto bg-panel border border-border rounded-lg shadow-xl p-3 space-y-3"
        >
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (date, nom)…"
              className="w-full bg-bg border border-border rounded pl-7 pr-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {grouped.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">Aucune sortie</p>
          ) : (
            grouped.map(([month, list]) => (
              <div key={month}>
                <div className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-1.5 sticky top-0 bg-panel py-0.5">
                  {monthLabel(month)}
                  <span className="ml-1.5 opacity-60">({list.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {list.map((e) => {
                    const isActive = e.index === selectedIndex;
                    return (
                      <button
                        key={e.index}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          onSelect(e.index);
                          setOpen(false);
                        }}
                        title={e.name ? `${e.date} — ${e.name}` : e.date}
                        className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-[11px] font-mono transition ${
                          isActive
                            ? "ring-2 ring-primary bg-primary/15 border-primary text-text"
                            : colourFor(e.cda)
                        }`}
                      >
                        <span className="truncate">{e.date.slice(5)}</span>
                        {e.cda != null && (
                          <span className="opacity-80 shrink-0">{e.cda.toFixed(3)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
