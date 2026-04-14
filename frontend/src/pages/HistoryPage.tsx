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
  // Multi-select filter sets. Null-sentinel "__unknown__" is used for entries
  // missing the corresponding label. An empty Set() means "not yet initialised"
  // — on first render we auto-select everything so the user sees all their
  // analyses by default; the `*Initialised` flags prevent re-seeding on
  // subsequent renders (so un-checking everything is respected).
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set());
  const [sensorFilterInitialised, setSensorFilterInitialised] = useState(false);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [athletesInitialised, setAthletesInitialised] = useState(false);
  const [selectedBikes, setSelectedBikes] = useState<Set<string>>(new Set());
  const [bikesInitialised, setBikesInitialised] = useState(false);

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

  // --- Filter options (athletes / sensors / bikes) ---
  const { athleteOptions, sensorOptions, bikeOptions } = useMemo(() => {
    const ac = new Map<string, { label: string; count: number }>();
    let athleteUnknown = 0;
    const sc = new Map<string, number>();
    let sensorUnknown = 0;
    const bc = new Map<string, { label: string; count: number }>();
    let bikeUnknown = 0;
    for (const e of entries) {
      // Athlete
      if (e.athleteKey) {
        const lbl = e.athleteName || e.athleteKey;
        const cur = ac.get(e.athleteKey) || { label: lbl, count: 0 };
        ac.set(e.athleteKey, { label: lbl, count: cur.count + 1 });
      } else athleteUnknown++;
      // Sensor
      if (e.powerMeterLabel) sc.set(e.powerMeterLabel, (sc.get(e.powerMeterLabel) || 0) + 1);
      else sensorUnknown++;
      // Bike
      if (e.bikeKey) {
        const lbl = e.bikeLabel || e.bikeKey;
        const cur = bc.get(e.bikeKey) || { label: lbl, count: 0 };
        bc.set(e.bikeKey, { label: lbl, count: cur.count + 1 });
      } else bikeUnknown++;
    }
    return {
      athleteOptions: {
        labels: [...ac.entries()]
          .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        unknownCount: athleteUnknown,
      },
      sensorOptions: {
        labels: [...sc.entries()].sort((a, b) => a[0].localeCompare(b[0])),
        unknownCount: sensorUnknown,
      },
      bikeOptions: {
        labels: [...bc.entries()]
          .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        unknownCount: bikeUnknown,
      },
    };
  }, [entries]);

  // --- First-render initialisation (select all) ---
  if (!sensorFilterInitialised && (sensorOptions.labels.length > 0 || sensorOptions.unknownCount > 0)) {
    const initial = new Set<string>();
    for (const [lbl] of sensorOptions.labels) initial.add(lbl);
    if (sensorOptions.unknownCount > 0) initial.add("__unknown__");
    setSelectedSensors(initial);
    setSensorFilterInitialised(true);
  }
  if (!athletesInitialised && (athleteOptions.labels.length > 0 || athleteOptions.unknownCount > 0)) {
    const initial = new Set<string>();
    for (const opt of athleteOptions.labels) initial.add(opt.key);
    if (athleteOptions.unknownCount > 0) initial.add("__unknown__");
    setSelectedAthletes(initial);
    setAthletesInitialised(true);
  }
  if (!bikesInitialised && (bikeOptions.labels.length > 0 || bikeOptions.unknownCount > 0)) {
    const initial = new Set<string>();
    for (const opt of bikeOptions.labels) initial.add(opt.key);
    if (bikeOptions.unknownCount > 0) initial.add("__unknown__");
    setSelectedBikes(initial);
    setBikesInitialised(true);
  }

  // --- Intersection filter: an entry is kept if it matches ALL filter dimensions ---
  const filteredEntries = useMemo(() => {
    const noSensor = selectedSensors.size === 0;
    const noAthlete = selectedAthletes.size === 0;
    const noBike = selectedBikes.size === 0;
    return entries.filter((e) => {
      if (!noSensor) {
        const key = e.powerMeterLabel || "__unknown__";
        if (!selectedSensors.has(key)) return false;
      }
      if (!noAthlete) {
        const key = e.athleteKey || "__unknown__";
        if (!selectedAthletes.has(key)) return false;
      }
      if (!noBike) {
        const key = e.bikeKey || "__unknown__";
        if (!selectedBikes.has(key)) return false;
      }
      return true;
    });
  }, [entries, selectedSensors, selectedAthletes, selectedBikes]);

  // Generic toggle / select-all / select-none helpers
  const makeToggle =
    (set: Set<string>, setter: (s: Set<string>) => void) => (key: string) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setter(next);
    };
  const toggleSensor = makeToggle(selectedSensors, setSelectedSensors);
  const toggleAthlete = makeToggle(selectedAthletes, setSelectedAthletes);
  const toggleBike = makeToggle(selectedBikes, setSelectedBikes);

  const selectAllSensors = () => {
    const next = new Set<string>();
    for (const [lbl] of sensorOptions.labels) next.add(lbl);
    if (sensorOptions.unknownCount > 0) next.add("__unknown__");
    setSelectedSensors(next);
  };
  const selectNoSensors = () => setSelectedSensors(new Set(["__none__"]));
  const selectAllAthletes = () => {
    const next = new Set<string>();
    for (const opt of athleteOptions.labels) next.add(opt.key);
    if (athleteOptions.unknownCount > 0) next.add("__unknown__");
    setSelectedAthletes(next);
  };
  const selectNoAthletes = () => setSelectedAthletes(new Set(["__none__"]));
  const selectAllBikes = () => {
    const next = new Set<string>();
    for (const opt of bikeOptions.labels) next.add(opt.key);
    if (bikeOptions.unknownCount > 0) next.add("__unknown__");
    setSelectedBikes(next);
  };
  const selectNoBikes = () => setSelectedBikes(new Set(["__none__"]));

  // Timeline: now restricted to the FILTERED set so the rolling std is
  // computed only over rides that share the same athlete (and optional
  // sensor/bike). This is critical because mixing several riders' CdAs in
  // the same std window produces meaningless regime changes.
  const timeline = useMemo(() => {
    type Point = {
      date: string;
      cda: number;
      entryId: string;
      sensorLabel: string | null;
      sensorQuality: string | null;
    };
    const all: Point[] = [];
    for (const e of filteredEntries) {
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
  }, [filteredEntries]);

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

      {/* Bias ratio histogram — per-sensor distribution of the power-meter
          calibration ratio. Spots sensors that systematically drift. */}
      <BiasHistogram entries={filteredEntries} />


      {/* Multi-dimension filter blocks. Each block behaves independently but
          they compose via intersection: a history entry must match the
          selected keys in EVERY block to be displayed. */}
      <FilterBlocks
        athletes={{
          options: athleteOptions,
          selected: selectedAthletes,
          toggle: toggleAthlete,
          selectAll: selectAllAthletes,
          selectNone: selectNoAthletes,
        }}
        sensors={{
          options: sensorOptions,
          selected: selectedSensors,
          toggle: toggleSensor,
          selectAll: selectAllSensors,
          selectNone: selectNoSensors,
        }}
        bikes={{
          options: bikeOptions,
          selected: selectedBikes,
          toggle: toggleBike,
          selectAll: selectAllBikes,
          selectNone: selectNoBikes,
        }}
        nFiltered={filteredEntries.length}
        nTotal={entries.length}
      />

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
                {e.athleteName && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono hidden md:inline bg-info/15 text-info"
                    title={`Profil : ${e.athleteName}`}
                  >
                    👤 {e.athleteName.length > 16 ? e.athleteName.slice(0, 14) + "…" : e.athleteName}
                  </span>
                )}
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
                    {e.athleteName && (
                      <div>Profil : <span className="text-info font-mono">{e.athleteName}</span></div>
                    )}
                    {e.bikeLabel && (
                      <div>Vélo : <span className="text-warn font-mono">{e.bikeLabel}</span></div>
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

interface FilterBlockProps {
  title: string;
  unknownLabel: string;
  options:
    | { labels: Array<[string, number]>; unknownCount: number } // sensors (string key = label)
    | { labels: Array<{ key: string; label: string; count: number }>; unknownCount: number };
  selected: Set<string>;
  toggle: (key: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  accent?: "teal" | "info" | "warn";
}

function FilterBlock({ title, unknownLabel, options, selected, toggle, selectAll, selectNone, accent = "teal" }: FilterBlockProps) {
  // Normalise to {key, label, count}[]
  const normalised: Array<{ key: string; label: string; count: number }> = Array.isArray(options.labels[0])
    ? (options.labels as Array<[string, number]>).map(([l, c]) => ({ key: l, label: l, count: c }))
    : (options.labels as Array<{ key: string; label: string; count: number }>);
  if (normalised.length === 0 && options.unknownCount === 0) return null;
  const accentCls =
    accent === "info"
      ? "bg-info/10 border-info text-info"
      : accent === "warn"
        ? "bg-warn/10 border-warn text-warn"
        : "bg-teal/10 border-teal text-teal";
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted font-semibold">{title}</span>
        <div className="flex items-center gap-2 text-[10px]">
          <button onClick={selectAll} className="px-2 py-0.5 rounded border border-border hover:border-teal text-muted hover:text-teal">
            Tous
          </button>
          <button onClick={selectNone} className="px-2 py-0.5 rounded border border-border hover:border-coral text-muted hover:text-coral">
            Aucun
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {normalised.map((o) => {
          const checked = selected.has(o.key);
          return (
            <label
              key={o.key}
              className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border font-mono cursor-pointer transition ${
                checked ? accentCls : "bg-bg border-border text-muted hover:border-muted"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(o.key)} className="accent-teal" />
              <span>{o.label}</span>
              <span className="opacity-60">({o.count})</span>
            </label>
          );
        })}
        {options.unknownCount > 0 && (
          <label
            className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border font-mono cursor-pointer transition ${
              selected.has("__unknown__") ? "bg-muted/20 border-muted text-text" : "bg-bg border-border text-muted hover:border-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has("__unknown__")}
              onChange={() => toggle("__unknown__")}
              className="accent-teal"
            />
            <span>{unknownLabel}</span>
            <span className="opacity-60">({options.unknownCount})</span>
          </label>
        )}
      </div>
    </div>
  );
}

interface FilterBlocksProps {
  athletes: {
    options: { labels: Array<{ key: string; label: string; count: number }>; unknownCount: number };
    selected: Set<string>;
    toggle: (key: string) => void;
    selectAll: () => void;
    selectNone: () => void;
  };
  sensors: {
    options: { labels: Array<[string, number]>; unknownCount: number };
    selected: Set<string>;
    toggle: (key: string) => void;
    selectAll: () => void;
    selectNone: () => void;
  };
  bikes: {
    options: { labels: Array<{ key: string; label: string; count: number }>; unknownCount: number };
    selected: Set<string>;
    toggle: (key: string) => void;
    selectAll: () => void;
    selectNone: () => void;
  };
  nFiltered: number;
  nTotal: number;
}

function FilterBlocks({ athletes, sensors, bikes, nFiltered, nTotal }: FilterBlocksProps) {
  const anyFilter =
    athletes.options.labels.length > 0 ||
    athletes.options.unknownCount > 0 ||
    sensors.options.labels.length > 0 ||
    sensors.options.unknownCount > 0 ||
    bikes.options.labels.length > 0 ||
    bikes.options.unknownCount > 0;
  if (!anyFilter) return null;
  return (
    <div className="space-y-2">
      <FilterBlock
        title="Filtrer par profil :"
        unknownLabel="Profil inconnu"
        options={athletes.options}
        selected={athletes.selected}
        toggle={athletes.toggle}
        selectAll={athletes.selectAll}
        selectNone={athletes.selectNone}
        accent="info"
      />
      <FilterBlock
        title="Filtrer par capteur :"
        unknownLabel="Capteur inconnu"
        options={sensors.options}
        selected={sensors.selected}
        toggle={sensors.toggle}
        selectAll={sensors.selectAll}
        selectNone={sensors.selectNone}
        accent="teal"
      />
      <FilterBlock
        title="Filtrer par vélo :"
        unknownLabel="Vélo inconnu"
        options={bikes.options}
        selected={bikes.selected}
        toggle={bikes.toggle}
        selectAll={bikes.selectAll}
        selectNone={bikes.selectNone}
        accent="warn"
      />
      <p className="text-[10px] text-muted">
        → {nFiltered} analyse{nFiltered > 1 ? "s" : ""} sélectionnée{nFiltered > 1 ? "s" : ""} sur {nTotal}
      </p>
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
        {/* X axis ticks: one tick per quarter-year boundary crossed in the
            dataset, so the user can anchor regime changes to real dates.
            For each quarter (Jan/Apr/Jul/Oct 1st), find the first timeline
            point on or after that date and render a tick + label there. */}
        {(() => {
          if (timeline.length === 0) return null;
          const firstDate = new Date(timeline[0].date);
          const lastDate = new Date(timeline[timeline.length - 1].date);
          const ticks: { label: string; idx: number }[] = [];
          // Start from the first quarter ≥ firstDate
          const startYear = firstDate.getFullYear();
          const startQuarter = Math.floor(firstDate.getMonth() / 3);
          let y = startYear;
          let q = startQuarter;
          // Advance to the first quarter *after* firstDate so the label is
          // always distinct from the first data point's date.
          q += 1;
          if (q > 3) {
            q = 0;
            y += 1;
          }
          while (true) {
            const qDate = new Date(y, q * 3, 1);
            if (qDate > lastDate) break;
            const qStr = qDate.toISOString().slice(0, 10);
            // Find the first timeline index with date >= qStr
            const idx = timeline.findIndex((p) => p.date >= qStr);
            if (idx >= 0) {
              ticks.push({
                label: `${y}-${String(q * 3 + 1).padStart(2, "0")}`,
                idx,
              });
            }
            q += 1;
            if (q > 3) {
              q = 0;
              y += 1;
            }
          }
          // If we have more than 8 quarter ticks, keep every other one to
          // avoid label collisions on tight screens.
          const shown = ticks.length > 8 ? ticks.filter((_, i) => i % 2 === 0) : ticks;
          return (
            <>
              {shown.map((t, i) => (
                <g key={i}>
                  <line
                    x1={xOf(t.idx)}
                    x2={xOf(t.idx)}
                    y1={H - PB}
                    y2={H - PB + 3}
                    stroke="#6b7280"
                    opacity={0.6}
                  />
                  <text
                    x={xOf(t.idx)}
                    y={H - 8}
                    fill="#6b7280"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {t.label}
                  </text>
                </g>
              ))}
            </>
          );
        })()}
      </svg>
    </div>
  );
}

/** Per-sensor histogram of the power-meter calibration bias ratio.
 *
 *  A well-calibrated sensor sits at 1.0 ± 0.1. A sensor that drifts
 *  shows a wide spread; a sensor that lies systematically shows a
 *  shifted center. Comparing the histograms of two sensors for the
 *  same rider lets the user see at a glance which one is more
 *  reliable — not through some abstract metric, but from the raw
 *  distribution of "how far the measured power was from the
 *  theoretical value on each ride".
 */
function BiasHistogram({ entries }: { entries: HistoryEntry[] }) {
  // Gather (sensor, biasRatio) pairs from rideCdas across all entries.
  // Group by sensor; skip rides without bias data.
  type Bin = { ratio: number; sensor: string };
  const bins: Bin[] = [];
  for (const e of entries) {
    for (const rc of e.rideCdas) {
      if (rc.biasRatio != null && Number.isFinite(rc.biasRatio)) {
        bins.push({
          ratio: rc.biasRatio,
          sensor: rc.powerMeter || e.powerMeterLabel || "Inconnu",
        });
      }
    }
  }
  if (bins.length < 10) return null;

  // Group by sensor
  const bySensor = new Map<string, number[]>();
  for (const b of bins) {
    const arr = bySensor.get(b.sensor) || [];
    arr.push(b.ratio);
    bySensor.set(b.sensor, arr);
  }
  const sensors = [...bySensor.keys()].sort();

  // Shared bucketing: 0.6 -> 1.6 in 0.05 steps (20 buckets)
  const MIN = 0.6;
  const MAX = 1.6;
  const N_BUCKETS = 20;
  const bucketize = (vals: number[]): number[] => {
    const out = new Array(N_BUCKETS).fill(0);
    for (const v of vals) {
      const clipped = Math.max(MIN, Math.min(MAX, v));
      const idx = Math.min(N_BUCKETS - 1, Math.floor(((clipped - MIN) / (MAX - MIN)) * N_BUCKETS));
      out[idx]++;
    }
    return out;
  };

  const COLORS: Record<number, string> = {
    0: "#3ba99c",
    1: "#f59e0b",
    2: "#e4572e",
    3: "#6b7280",
  };

  // SVG layout
  const W = 700;
  const H = 160;
  const PL = 35;
  const PR = 10;
  const PT = 25;
  const PB = 30;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const bucketW = innerW / N_BUCKETS;

  // Compute max y across all sensors for shared scale
  const bucketsBySensor = sensors.map((s) => ({
    sensor: s,
    buckets: bucketize(bySensor.get(s)!),
    n: bySensor.get(s)!.length,
    mean: bySensor.get(s)!.reduce((a, b) => a + b, 0) / bySensor.get(s)!.length,
  }));
  const maxY = Math.max(1, ...bucketsBySensor.map((b) => Math.max(...b.buckets)));

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">
          Distribution du biais de calibration par capteur
        </h3>
        <span className="text-[10px] text-muted font-mono">
          {bins.length} rides avec bias
        </span>
      </div>
      <p className="text-[11px] text-muted mb-2 leading-tight">
        Biais = puissance mesurée / puissance théorique (CdA prior, Crr=0.005)
        sur les portions plates. Un capteur bien calibré centre à 1.0 avec une
        distribution serrée. Un capteur qui dérive montre une distribution large ou décentrée.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Reference line at 1.0 */}
        {(() => {
          const x1 = PL + ((1.0 - MIN) / (MAX - MIN)) * innerW;
          return (
            <line
              x1={x1}
              x2={x1}
              y1={PT}
              y2={H - PB}
              stroke="#3ba99c"
              strokeDasharray="3,3"
              opacity={0.6}
            />
          );
        })()}
        {/* X axis labels */}
        {[0.6, 0.8, 1.0, 1.2, 1.4, 1.6].map((v, i) => (
          <text
            key={i}
            x={PL + ((v - MIN) / (MAX - MIN)) * innerW}
            y={H - PB + 12}
            fill="#6b7280"
            fontSize="9"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {v.toFixed(1)}
          </text>
        ))}
        {/* Stacked histogram bars per sensor (one colour per sensor) */}
        {bucketsBySensor.map(({ sensor: _s, buckets }, sIdx) => {
          const color = COLORS[sIdx % 4];
          return buckets.map((n, i) => {
            if (n === 0) return null;
            const x = PL + i * bucketW;
            const h = (n / maxY) * innerH;
            const y = H - PB - h;
            // Offset each sensor's bars slightly so they don't overlap
            const offset = sIdx * (bucketW / sensors.length) * 0.9;
            const w = bucketW / sensors.length * 0.85;
            return (
              <rect
                key={`${sIdx}-${i}`}
                x={x + offset}
                y={y}
                width={w}
                height={h}
                fill={color}
                opacity={0.85}
              >
                <title>{`${bucketsBySensor[sIdx].sensor}: bucket ${(MIN + i * (MAX - MIN) / N_BUCKETS).toFixed(2)} → ${n} rides`}</title>
              </rect>
            );
          });
        })}
        {/* Legend */}
        {bucketsBySensor.map((s, i) => (
          <g key={i} transform={`translate(${PL + i * 180}, 10)`}>
            <rect width={10} height={10} fill={COLORS[i % 4]} />
            <text x={14} y={9} fill="#e9edf3" fontSize="10" fontFamily="monospace">
              {s.sensor.length > 20 ? s.sensor.slice(0, 18) + "…" : s.sensor} (n={s.n}, μ={s.mean.toFixed(2)})
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
