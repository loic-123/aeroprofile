import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Lap, PerLapResult } from "../../types";
import { Button, Card } from "../ui";

interface Props {
  laps: Lap[];
  perLap?: PerLapResult[];
  excludedLapIndices: number[];
  onChange: (excluded: number[]) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  dirty: boolean;
}

const MIN_LAP_DURATION_S = 30;

export function LapSelector({
  laps,
  perLap,
  excludedLapIndices,
  onChange,
  onReanalyze,
  reanalyzing,
  dirty,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!laps || laps.length < 2) return null;

  const perLapByIndex = useMemo(() => {
    const map = new Map<number, PerLapResult>();
    if (perLap) for (const r of perLap) map.set(r.lap_index, r);
    return map;
  }, [perLap]);

  const okPerLap = useMemo(
    () => (perLap ?? []).filter((r) => r.status === "ok" && r.cda != null),
    [perLap],
  );

  // Headline Δ when exactly 2 laps were successfully solved.
  // σ_Δ ≈ √(σ_A² + σ_B²) — assumes per-lap CdA estimates are
  // approximately independent given the shared wind. Conservative
  // (slightly too wide), but auditable.
  const delta = useMemo(() => {
    if (okPerLap.length !== 2) return null;
    const [a, b] = okPerLap;
    const cdaA = a.cda!;
    const cdaB = b.cda!;
    const sigmaA = a.cda_ci_high != null && a.cda_ci_low != null
      ? (a.cda_ci_high - a.cda_ci_low) / 3.92
      : null;
    const sigmaB = b.cda_ci_high != null && b.cda_ci_low != null
      ? (b.cda_ci_high - b.cda_ci_low) / 3.92
      : null;
    const dCda = cdaA - cdaB;
    let ciHalf: number | null = null;
    if (sigmaA != null && sigmaB != null) {
      ciHalf = 1.96 * Math.sqrt(sigmaA * sigmaA + sigmaB * sigmaB);
    }
    return { aIdx: a.lap_index, bIdx: b.lap_index, dCda, ciHalf };
  }, [okPerLap]);

  const totalDuration = useMemo(
    () => laps.reduce((sum, l) => sum + l.duration_s, 0),
    [laps],
  );
  const excludedSet = useMemo(() => new Set(excludedLapIndices), [excludedLapIndices]);
  const excludedCount = excludedSet.size;

  const toggleLap = (idx: number) => {
    const next = new Set(excludedSet);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const resetAll = () => onChange([]);

  const summary =
    excludedCount === 0
      ? t("lapSelector.summaryAllIncluded", { count: laps.length })
      : t("lapSelector.summaryExcluded", {
          excluded: excludedCount,
          total: laps.length,
        });

  return (
    <Card elevation={1} className="p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-medium text-text">
            {t("lapSelector.title")}
          </span>
          <span className="text-xs text-muted truncate">{summary}</span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-base ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-border space-y-3">
              <div
                className="flex h-2 w-full rounded-sm overflow-hidden bg-panel-2"
                role="presentation"
              >
                {laps.map((lap) => {
                  const isExcluded = excludedSet.has(lap.index);
                  const widthPct = (lap.duration_s / totalDuration) * 100;
                  return (
                    <span
                      key={lap.index}
                      style={{ width: `${widthPct}%` }}
                      className={
                        isExcluded
                          ? "bg-muted/30"
                          : "bg-primary/70"
                      }
                      aria-hidden
                    />
                  );
                })}
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {laps.map((lap) => {
                  const tooShort = lap.duration_s < MIN_LAP_DURATION_S;
                  const isExcluded = excludedSet.has(lap.index);
                  const mins = Math.floor(lap.duration_s / 60);
                  const secs = Math.round(lap.duration_s % 60);
                  const km = (lap.distance_m / 1000).toFixed(2);
                  return (
                    <li key={lap.index}>
                      <label
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer ${
                          tooShort
                            ? "border-border/50 text-muted/70 cursor-not-allowed"
                            : isExcluded
                              ? "border-border bg-panel-2 text-muted line-through decoration-muted/60"
                              : "border-border hover:border-border-strong text-text"
                        }`}
                        title={tooShort ? t("lapSelector.tooShortHint") : undefined}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={!isExcluded}
                          disabled={tooShort}
                          onChange={() => toggleLap(lap.index)}
                        />
                        <span className="font-mono shrink-0">
                          #{lap.index + 1}
                        </span>
                        <span className="font-mono text-muted">
                          {mins}:{secs.toString().padStart(2, "0")}
                        </span>
                        <span className="font-mono text-muted">{km} km</span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {perLap && perLap.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">
                      {t("lapSelector.perLapHeading")}
                    </span>
                    <span className="text-[10px] text-muted">
                      {t("lapSelector.perLapHint")}
                    </span>
                  </div>
                  {delta && (
                    <div className="rounded-md bg-primary-subtle border border-primary-border px-3 py-2 text-xs">
                      <div className="text-text">
                        {t("lapSelector.deltaHeadline", {
                          a: delta.aIdx + 1,
                          b: delta.bIdx + 1,
                          dCda: delta.dCda.toFixed(3),
                        })}
                      </div>
                      {delta.ciHalf != null && (
                        <div className="text-muted font-mono mt-0.5">
                          95% CI: [
                          {(delta.dCda - delta.ciHalf).toFixed(3)} ;
                          {(delta.dCda + delta.ciHalf).toFixed(3)}] m²
                        </div>
                      )}
                    </div>
                  )}
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-mono">
                    {laps
                      .filter((l) => !excludedSet.has(l.index))
                      .map((l) => {
                        const pl = perLapByIndex.get(l.index);
                        if (!pl) return null;
                        if (pl.status !== "ok" || pl.cda == null) {
                          return (
                            <li
                              key={l.index}
                              className="px-2 py-1 rounded border border-border/50 text-muted/70 flex items-center gap-2"
                            >
                              <span>#{l.index + 1}</span>
                              <span className="italic">
                                {t(`lapSelector.gate.${pl.status}`)}
                              </span>
                            </li>
                          );
                        }
                        const ciStr =
                          pl.cda_ci_low != null && pl.cda_ci_high != null
                            ? `[${pl.cda_ci_low.toFixed(3)} ; ${pl.cda_ci_high.toFixed(3)}]`
                            : "";
                        return (
                          <li
                            key={l.index}
                            className="px-2 py-1 rounded border border-border flex items-center gap-2"
                          >
                            <span className="text-muted">#{l.index + 1}</span>
                            <span className="text-text">
                              CdA {pl.cda.toFixed(3)}
                            </span>
                            <span className="text-muted">{ciStr}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={excludedCount === 0}
                  className="text-xs text-muted hover:text-text disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  {t("lapSelector.includeAll")}
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onReanalyze}
                  loading={reanalyzing}
                  disabled={!dirty || reanalyzing}
                  leftIcon={<RefreshCw size={12} aria-hidden />}
                >
                  {t("lapSelector.reanalyze")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
