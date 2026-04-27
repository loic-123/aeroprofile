import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Lap } from "../../types";
import { Button, Card } from "../ui";

interface Props {
  laps: Lap[];
  excludedLapIndices: number[];
  onChange: (excluded: number[]) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  dirty: boolean;
}

const MIN_LAP_DURATION_S = 30;

export function LapSelector({
  laps,
  excludedLapIndices,
  onChange,
  onReanalyze,
  reanalyzing,
  dirty,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!laps || laps.length < 2) return null;

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
