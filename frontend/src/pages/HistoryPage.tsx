import { useState, useMemo } from "react";
import { Clock, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { getHistory, deleteFromHistory, clearHistory, type HistoryEntry } from "../api/history";

/** Rolling standard deviation over a window of N consecutive values. */
function rollingStd(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    const slice = values.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const varSum = slice.reduce((a, b) => a + (b - mean) ** 2, 0);
    out[i] = Math.sqrt(varSum / (window - 1));
  }
  return out;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState(() => getHistory());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sensorFilter, setSensorFilter] = useState<string>("__all__");

  const handleDelete = (id: string) => {
    deleteFromHistory(id);
    setEntries(getHistory());
  };

  const handleClear = () => {
    if (confirm("Supprimer tout l'historique ?")) {
      clearHistory();
      setEntries([]);
    }
  };

  const modeLabel = (m: string) =>
    m === "single" ? "Analyse" : m === "intervals" ? "Intervals" : "Comparer";

  // Unique sensor labels across the history for the filter dropdown
  const sensorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.powerMeterLabel) set.add(e.powerMeterLabel);
    }
    return [...set].sort();
  }, [entries]);

  // Filter entries by selected sensor
  const filteredEntries = useMemo(() => {
    if (sensorFilter === "__all__") return entries;
    if (sensorFilter === "__unknown__") return entries.filter((e) => !e.powerMeterLabel);
    return entries.filter((e) => e.powerMeterLabel === sensorFilter);
  }, [entries, sensorFilter]);

  // Build timeline points in chronological order (across ALL entries, not just
  // the filtered ones, since the filter is for reading the list — the chart
  // should show the full journey to make regime changes visible).
  // For each entry expand to (date, cda) per ride, then compute rolling std
  // over a window of 10 consecutive rides.
  const timeline = useMemo(() => {
    type Point = {
      date: string;
      cda: number;
      entryId: string;
      sensorLabel: string | null;
      sensorQuality: string | null;
    };
    const all: Point[] = [];
    for (const e of entries) {
      for (const rc of e.rideCdas) {
        all.push({
          date: rc.date,
          cda: rc.cda,
          entryId: e.id,
          sensorLabel: e.powerMeterLabel ?? null,
          sensorQuality: e.powerMeterQuality ?? null,
        });
      }
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    const window = 10;
    const stds = rollingStd(all.map((p) => p.cda), window);
    return all.map((p, i) => ({ ...p, std: stds[i] }));
  }, [entries]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-teal" size={20} />
            Historique des analyses
          </h2>
          <p className="text-sm text-muted mt-1">
            {entries.length} analyse{entries.length > 1 ? "s" : ""} sauvegardée{entries.length > 1 ? "s" : ""}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-muted hover:text-coral flex items-center gap-1"
          >
            <Trash2 size={12} /> Tout effacer
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center text-muted">
          Aucune analyse dans l'historique. Lancez une analyse pour la voir apparaître ici.
        </div>
      )}

      {/* Rolling std timeline — helps spot when a sensor change or position
          change affected the ride-to-ride consistency of the CdA. */}
      {timeline.length >= 10 && (
        <RollingStdTimeline timeline={timeline} />
      )}

      {sensorOptions.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Filtrer par capteur :</span>
          <select
            value={sensorFilter}
            onChange={(e) => setSensorFilter(e.target.value)}
            className="bg-panel border border-border rounded px-2 py-1 font-mono"
          >
            <option value="__all__">Tous ({entries.length})</option>
            {sensorOptions.map((s) => {
              const n = entries.filter((e) => e.powerMeterLabel === s).length;
              return (
                <option key={s} value={s}>
                  {s} ({n})
                </option>
              );
            })}
            {entries.some((e) => !e.powerMeterLabel) && (
              <option value="__unknown__">
                Capteur inconnu ({entries.filter((e) => !e.powerMeterLabel).length})
              </option>
            )}
          </select>
        </div>
      )}

      {filteredEntries.length === 0 && entries.length > 0 && (
        <div className="bg-panel border border-border rounded-lg p-4 text-center text-muted text-sm">
          Aucune analyse ne correspond au filtre capteur.
        </div>
      )}

      <div className="space-y-2">
        {filteredEntries.map((e) => {
          const isExpanded = expandedIds.has(e.id);
          const nrmse = e.avgPowerW > 0 ? (e.rmseW / e.avgPowerW * 100).toFixed(0) : "?";
          const wCda = e.cda > 0 ? (e.avgPowerW / e.cda).toFixed(0) : "–";
          const vFlat = e.cda > 0 && e.avgRho > 0
            ? (Math.pow(2 * e.avgPowerW / (e.cda * e.avgRho), 1/3) * 3.6).toFixed(1)
            : "–";

          return (
            <div key={e.id} className="bg-panel border border-border rounded-lg overflow-hidden">
              {/* Header row — always visible */}
              <button
                onClick={() => setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                  return next;
                })}
                className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-bg/50 transition"
              >
                {isExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                <span className="text-muted font-mono text-xs w-36">
                  {new Date(e.timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  e.mode === "intervals" ? "bg-info/20 text-info" : e.mode === "compare" ? "bg-purple-500/20 text-purple-400" : "bg-teal/20 text-teal"
                }`}>
                  {modeLabel(e.mode)}
                </span>
                <span className="truncate flex-1 text-left">{e.label}</span>
                {e.powerMeterLabel && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono hidden lg:inline ${
                      e.powerMeterQuality === "low"
                        ? "bg-coral/15 text-coral"
                        : e.powerMeterQuality === "medium"
                          ? "bg-warn/15 text-warn"
                          : e.powerMeterQuality === "high"
                            ? "bg-teal/15 text-teal"
                            : "bg-border/30 text-muted"
                    }`}
                    title={e.powerMeterLabel}
                  >
                    {e.powerMeterLabel.length > 24
                      ? e.powerMeterLabel.slice(0, 22) + "…"
                      : e.powerMeterLabel}
                  </span>
                )}
                <span className="font-mono text-teal font-semibold">CdA {e.cda.toFixed(3)}</span>
                {e.cdaLow != null && (
                  <span className="font-mono text-xs text-muted hidden md:inline">
                    [{e.cdaLow.toFixed(3)}–{e.cdaHigh!.toFixed(3)}]
                  </span>
                )}
                <span className="font-mono text-xs text-muted">{e.nRides} ride{e.nRides > 1 ? "s" : ""}</span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <div className="text-xs text-muted">CdA</div>
                      <div className="font-mono text-teal text-lg">{e.cda.toFixed(3)}</div>
                      {e.cdaLow != null && (
                        <div className="text-xs text-muted font-mono">IC95 [{e.cdaLow.toFixed(3)} – {e.cdaHigh!.toFixed(3)}]</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted">Crr</div>
                      <div className="font-mono text-teal text-lg">{e.crr.toFixed(4)}</div>
                      {e.crrFixed != null && <div className="text-xs text-muted">fixé</div>}
                    </div>
                    <div>
                      <div className="text-xs text-muted">W/CdA</div>
                      <div className="font-mono text-info text-lg">{wCda}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">V plat</div>
                      <div className="font-mono text-info text-lg">{vFlat} km/h</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs text-muted">
                    <div>RMSE : <span className="text-text font-mono">±{e.rmseW.toFixed(0)} W</span> (nRMSE {nrmse}%)</div>
                    <div>Masse : <span className="text-text font-mono">{e.massKg} kg</span></div>
                    <div>Rides : <span className="text-text font-mono">{e.nRides}</span> retenues, <span className="text-text font-mono">{e.nExcluded}</span> exclues</div>
                    <div>Vélo : <span className="text-text">{e.bikeType}</span> · <span className="text-text">{e.positionLabel}</span></div>
                    <div>Crr : <span className="text-text font-mono">{e.crrFixed != null ? `${e.crrFixed.toFixed(4)} (fixé)` : "auto"}</span></div>
                    <div>Prior CdA : <span className="text-text font-mono">
                      {e.cdaPriorMean != null && e.cdaPriorMean > 0 ? `${e.cdaPriorMean.toFixed(2)} ± ${e.cdaPriorSigma?.toFixed(2)}` : "aucun"}
                    </span></div>
                    {e.powerMeterLabel && (
                      <div className="md:col-span-2">
                        Capteur : <span className={`font-mono ${
                          e.powerMeterQuality === "low" ? "text-coral" :
                          e.powerMeterQuality === "medium" ? "text-warn" :
                          e.powerMeterQuality === "high" ? "text-teal" : "text-text"
                        }`}>{e.powerMeterLabel}</span>
                        {e.powerBiasRatio != null && (
                          <span className="text-muted"> · biais médian ×{e.powerBiasRatio.toFixed(2)}</span>
                        )}
                      </div>
                    )}
                    {e.maxNrmse != null && (
                      <div>Seuil qualité : <span className="text-text font-mono">{e.maxNrmse >= 9.9 ? "désactivé" : `${(e.maxNrmse * 100).toFixed(0)}%`}</span></div>
                    )}
                    {e.useCache != null && (
                      <div>Cache : <span className="text-text">{e.useCache ? "activé" : "désactivé"}</span></div>
                    )}
                    {e.dateFrom && e.dateTo && (
                      <div className="md:col-span-3">Période : <span className="text-text font-mono">{e.dateFrom} → {e.dateTo}</span></div>
                    )}
                    {e.minDistanceKm != null && (
                      <div>Distance : <span className="text-text font-mono">{e.minDistanceKm}–{e.maxDistanceKm} km</span></div>
                    )}
                    {e.maxElevationM != null && (
                      <div>D+ max : <span className="text-text font-mono">{e.maxElevationM} m</span></div>
                    )}
                    {e.minDurationH != null && (
                      <div>Durée min : <span className="text-text font-mono">{Math.round(e.minDurationH * 60)} min</span></div>
                    )}
                    {e.excludeGroup != null && (
                      <div>Groupe exclu : <span className="text-text">{e.excludeGroup ? "oui" : "non"}</span></div>
                    )}
                  </div>

                  {/* Mini CdA evolution */}
                  {e.rideCdas.length >= 2 && (
                    <div className="mt-3">
                      <div className="text-xs text-muted mb-1">CdA par sortie</div>
                      <div className="flex items-end gap-0.5 h-12">
                        {e.rideCdas.map((rc, j) => {
                          const min = Math.min(...e.rideCdas.map((x) => x.cda));
                          const max = Math.max(...e.rideCdas.map((x) => x.cda));
                          const range = max - min || 0.01;
                          const h = 8 + ((rc.cda - min) / range) * 40; // 8px to 48px
                          return (
                            <div
                              key={j}
                              title={`${rc.date}: CdA ${rc.cda.toFixed(3)}`}
                              className="bg-teal/60 rounded-sm flex-1 min-w-[3px] max-w-[8px]"
                              style={{ height: `${h}px` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-xs text-muted hover:text-coral flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mini-chart: rolling 10-ride CdA std over time, coloured by sensor quality.
 *  A high std means high ride-to-ride variance — usually a sign that the
 *  sensor drifted or that the user's position was inconsistent. Sudden drops
 *  correspond to sensor swaps or better calibration. */
function RollingStdTimeline({
  timeline,
}: {
  timeline: Array<{
    date: string;
    cda: number;
    std: number | null;
    sensorLabel: string | null;
    sensorQuality: string | null;
  }>;
}) {
  const valid = timeline.filter((p) => p.std != null) as Array<
    typeof timeline[number] & { std: number }
  >;
  if (valid.length < 2) return null;
  const maxStd = Math.max(...valid.map((p) => p.std));
  const targetStd = 0.02; // "good" threshold

  // Color by sensor quality
  const color = (q: string | null): string => {
    if (q === "low") return "#e4572e";
    if (q === "medium") return "#f59e0b";
    if (q === "high") return "#3ba99c";
    return "#6b7280";
  };

  // Derive phase segments for background bands: consecutive rides with the
  // same sensor label form a phase. Dates at phase boundaries are highlighted.
  const phases: Array<{ start: number; end: number; label: string | null; quality: string | null }> = [];
  let ps = 0;
  for (let i = 1; i <= timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = i < timeline.length ? timeline[i] : null;
    if (!cur || cur.sensorLabel !== prev.sensorLabel) {
      phases.push({
        start: ps,
        end: i - 1,
        label: prev.sensorLabel,
        quality: prev.sensorQuality,
      });
      ps = i;
    }
  }

  // SVG dimensions
  const W = 700;
  const H = 120;
  const PL = 40;
  const PR = 10;
  const PT = 15;
  const PB = 25;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const xOf = (i: number) => PL + (i / Math.max(timeline.length - 1, 1)) * innerW;
  const yMax = Math.max(maxStd, targetStd * 2);
  const yOf = (s: number) => PT + (1 - s / yMax) * innerH;

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">
          Stabilité du CdA (écart-type glissant sur 10 sorties)
        </h3>
        <span className="text-[10px] text-muted font-mono">
          {valid.length} fenêtres · cible σ &lt; {targetStd.toFixed(2)}
        </span>
      </div>
      <p className="text-[11px] text-muted mb-2 leading-tight">
        Une baisse brutale = changement de capteur ou meilleure calibration. Les zones colorées en fond représentent les périodes où le même capteur était utilisé.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Phase background bands */}
        {phases.map((p, i) => {
          const x1 = xOf(p.start);
          const x2 = xOf(p.end);
          if (x2 - x1 < 2) return null;
          return (
            <rect
              key={i}
              x={x1}
              y={PT}
              width={x2 - x1}
              height={innerH}
              fill={color(p.quality)}
              opacity={0.08}
            />
          );
        })}
        {/* Target line */}
        <line
          x1={PL}
          x2={W - PR}
          y1={yOf(targetStd)}
          y2={yOf(targetStd)}
          stroke="#3ba99c"
          strokeDasharray="3,3"
          opacity={0.5}
        />
        <text x={PL - 4} y={yOf(targetStd) + 3} fill="#3ba99c" fontSize="9" textAnchor="end" fontFamily="monospace">
          {targetStd.toFixed(2)}
        </text>
        {/* Y axis */}
        <text x={PL - 4} y={PT + 4} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">
          {yMax.toFixed(2)}
        </text>
        <text x={PL - 4} y={H - PB + 3} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">
          0
        </text>
        {/* Std line */}
        <polyline
          fill="none"
          stroke="#e9edf3"
          strokeWidth={1.5}
          points={valid
            .map((p) => {
              const i = timeline.indexOf(p);
              return `${xOf(i)},${yOf(p.std)}`;
            })
            .join(" ")}
        />
        {/* Points, coloured by sensor quality */}
        {valid.map((p, j) => {
          const i = timeline.indexOf(p);
          return (
            <circle
              key={j}
              cx={xOf(i)}
              cy={yOf(p.std)}
              r={2}
              fill={color(p.sensorQuality)}
            >
              <title>{`${p.date} · σ=${p.std.toFixed(3)}${p.sensorLabel ? `\n${p.sensorLabel}` : ""}`}</title>
            </circle>
          );
        })}
        {/* X axis — first/last date labels */}
        {timeline.length > 0 && (
          <>
            <text x={PL} y={H - 8} fill="#6b7280" fontSize="9" textAnchor="start" fontFamily="monospace">
              {timeline[0].date}
            </text>
            <text x={W - PR} y={H - 8} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">
              {timeline[timeline.length - 1].date}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
