import { useState, useMemo } from "react";
import { Clock, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import {
  getHistory,
  deleteFromHistory,
  clearHistory,
  getIgnoredEntryIds,
  setIgnoredEntryIds,
  type HistoryEntry,
} from "../api/history";

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
  // Per-entry "ignore on charts" toggle (persisted). Default = none ignored
  // → all entries contribute to the timeline and the bias histogram. The
  // user can click the eye icon on any card header to exclude that entry
  // from the two charts without deleting it.
  const [ignoredEntries, setIgnoredEntriesState] = useState<Set<string>>(() => getIgnoredEntryIds());
  const toggleIgnored = (id: string) => {
    setIgnoredEntriesState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setIgnoredEntryIds(next);
      return next;
    });
  };

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
  // Sensor options are built from the per-ride `rideCdas[].powerMeter`
  // field, not the entry-level `powerMeterLabel`. Aggregate entries built
  // from a mix of sensors surface as "Mixte (N capteurs — principal : …)"
  // at the entry level, which is not a useful filter key. Counting unique
  // sensors per ride gives the user a real per-sensor breakdown.
  const { athleteOptions, sensorOptions, bikeOptions } = useMemo(() => {
    const ac = new Map<string, { label: string; count: number }>();
    let athleteUnknown = 0;
    const sc = new Map<string, number>(); // label -> ride count
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
      // Sensor — walk the per-ride list. Fall back to the entry label for
      // legacy entries that don't carry per-ride sensor metadata.
      const hasPerRide = e.rideCdas.some((rc) => rc.powerMeter);
      if (hasPerRide) {
        for (const rc of e.rideCdas) {
          if (rc.powerMeter) sc.set(rc.powerMeter, (sc.get(rc.powerMeter) || 0) + 1);
          else sensorUnknown++;
        }
      } else if (e.powerMeterLabel && !e.powerMeterLabel.startsWith("Mixte")) {
        // Legacy single-sensor entry: use its label directly, count N rides.
        sc.set(e.powerMeterLabel, (sc.get(e.powerMeterLabel) || 0) + e.rideCdas.length);
      } else {
        sensorUnknown += e.rideCdas.length || 1;
      }
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
  // Sensor filter operates on per-ride sensors so a mixed-sensor aggregate
  // is kept as long as at least one of its rides uses a selected sensor.
  // The `timeline` memo then further trims ride points to the selected set
  // so the rolling-std chart only plots rides from selected sensors.
  const filteredEntries = useMemo(() => {
    const noSensor = selectedSensors.size === 0;
    const noAthlete = selectedAthletes.size === 0;
    const noBike = selectedBikes.size === 0;
    return entries.filter((e) => {
      if (!noSensor) {
        const hasPerRide = e.rideCdas.some((rc) => rc.powerMeter);
        if (hasPerRide) {
          const hit = e.rideCdas.some((rc) => rc.powerMeter && selectedSensors.has(rc.powerMeter));
          const unknownHit = selectedSensors.has("__unknown__") && e.rideCdas.some((rc) => !rc.powerMeter);
          if (!hit && !unknownHit) return false;
        } else {
          // Legacy entry without per-ride sensors: match by entry label
          const key = (e.powerMeterLabel && !e.powerMeterLabel.startsWith("Mixte"))
            ? e.powerMeterLabel
            : "__unknown__";
          if (!selectedSensors.has(key)) return false;
        }
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

  // Chart-only view: subset of filteredEntries with the user's per-entry
  // "ignore on charts" toggles applied. The cards list keeps the full
  // filteredEntries so the user can still see (and re-include) the ignored
  // entries. Only the timeline and the bias histogram read this view.
  const chartsEntries = useMemo(
    () => filteredEntries.filter((e) => !ignoredEntries.has(e.id)),
    [filteredEntries, ignoredEntries],
  );

  // Timeline: now restricted to the FILTERED set so the rolling std is
  // computed only over rides that share the same athlete (and optional
  // sensor/bike). This is critical because mixing several riders' CdAs in
  // the same std window produces meaningless regime changes.
  const timeline = useMemo(() => {
    type Point = {
      date: string;
      cda: number;
      entryId: string;
      rideSensor: string | null;    // best guess for this ride individually
      sensorLabel: string | null;   // majority sensor over the rolling window (used for colour)
      sensorQuality: string | null;
    };
    // Entries created before we added rc.powerMeter don't carry
    // per-ride sensor info. The entry-level label is our only
    // source. It can take two shapes:
    //   - a real sensor string ("Favero Assioma (Duo / Pro)") when
    //     all rides in the aggregate used the same sensor
    //   - "Mixte (N capteurs — principal : XXX)" when the rides
    //     used several sensors. We parse out the "principal" field
    //     to keep a meaningful fallback instead of dumping every
    //     point in an Unknown bucket.
    const extractEntrySensor = (label: string | null): string | null => {
      if (!label) return null;
      const m = label.match(/principal\s*:\s*(.+?)\)?$/i);
      if (m) return m[1].trim();
      if (label.startsWith("Mixte")) return null; // can't parse, give up
      return label;
    };

    // Dedup by (athleteKey, date): guarantees at most one point per day
    // per athlete on the stability chart. Three cases it covers:
    //   1. A ride re-analysed in a later history entry (after a Crr change,
    //      a pipeline fix, etc.) — we keep the most recent entry.
    //   2. Two different rides on the same day inside the same history entry
    //      (double session, morning+evening) — we keep the one with the
    //      best (lowest) nRMSE, which is the most trustworthy estimate.
    //   3. Two entries that happen to cover the same day via different
    //      activities — case 1's "most recent" rule handles it.
    // Tie-breaker order: entry.timestamp desc, then rc.nrmse asc.
    type Key = string;
    const bestByKey = new Map<Key, { entry: HistoryEntry; rc: HistoryEntry["rideCdas"][number] }>();
    const noSensor = selectedSensors.size === 0;
    for (const e of chartsEntries) {
      const athKey = e.athleteKey || "__unknown__";
      for (const rc of e.rideCdas) {
        // Filter per-ride by sensor selection so re-selecting Assioma only
        // shows Assioma points (the entry-level filter above just decides
        // which entries contribute candidates).
        if (!noSensor) {
          const sensorKey = rc.powerMeter || "__unknown__";
          if (!selectedSensors.has(sensorKey)) continue;
        }
        const key: Key = `${athKey}|${rc.date}`;
        const prev = bestByKey.get(key);
        if (!prev) {
          bestByKey.set(key, { entry: e, rc });
          continue;
        }
        // Newer entry wins outright.
        if (prev.entry.timestamp < e.timestamp) {
          bestByKey.set(key, { entry: e, rc });
          continue;
        }
        // Same entry, same day: two distinct rides with the same date.
        // Keep the one with the best nRMSE (lowest is better).
        if (prev.entry.id === e.id && rc.nrmse < prev.rc.nrmse) {
          bestByKey.set(key, { entry: e, rc });
        }
      }
    }
    const all: Point[] = [];
    for (const { entry: e, rc } of bestByKey.values()) {
      const entrySensor = extractEntrySensor(e.powerMeterLabel || null);
      const rideSensor = rc.powerMeter || entrySensor;
      all.push({
        date: rc.date,
        cda: rc.cda,
        entryId: e.id,
        rideSensor,
        sensorLabel: null,
        sensorQuality: e.powerMeterQuality ?? null,
      });
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    const window = 10;
    const stds = rollingStd(all.map((p) => p.cda), window);
    // For each point, the displayed "sensor" is the *majority* sensor
    // among the 10 rides that make up the rolling σ window. That way a
    // point's colour tells the user "which sensor was dominant when
    // this stability was measured". Points at a transition (50/50)
    // take whichever sensor has one more ride; points with no ties
    // are unambiguous.
    const majorityWindow = (endIdx: number): string | null => {
      const start = Math.max(0, endIdx - window + 1);
      const counts = new Map<string, number>();
      for (let j = start; j <= endIdx; j++) {
        const s = all[j].rideSensor;
        if (s) counts.set(s, (counts.get(s) || 0) + 1);
      }
      if (counts.size === 0) return null;
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    return all.map((p, i) => ({
      ...p,
      std: stds[i],
      sensorLabel: majorityWindow(i),
    }));
  }, [chartsEntries, selectedSensors]);

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
      <BiasHistogram entries={chartsEntries} selectedSensors={selectedSensors} />


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

      {(ignoredEntries.size > 0 || filteredEntries.length > 5) && (
        <p className="text-[11px] text-muted leading-tight">
          Cliquez sur l'icône <Eye size={11} className="inline align-text-bottom" /> à droite d'une analyse pour l'inclure/exclure du graphique de stabilité et de l'histogramme de biais capteur.
          {ignoredEntries.size > 0 && (
            <>
              {" "}
              <button
                onClick={() => {
                  setIgnoredEntriesState(new Set());
                  setIgnoredEntryIds(new Set());
                }}
                className="text-info hover:text-info/80 underline"
              >
                Réinclure les {ignoredEntries.size} analyse{ignoredEntries.size > 1 ? "s" : ""} ignorée{ignoredEntries.size > 1 ? "s" : ""}
              </button>
            </>
          )}
        </p>
      )}

      <div className="space-y-2">
        {filteredEntries.map((e) => {
          const isExpanded = expandedIds.has(e.id);
          const isIgnored = ignoredEntries.has(e.id);
          const nrmse = e.avgPowerW > 0 ? (e.rmseW / e.avgPowerW * 100).toFixed(0) : "?";
          const wCda = e.cda > 0 ? (e.avgPowerW / e.cda).toFixed(0) : "–";
          const vFlat = e.cda > 0 && e.avgRho > 0
            ? (Math.pow(2 * e.avgPowerW / (e.cda * e.avgRho), 1/3) * 3.6).toFixed(1)
            : "–";

          return (
            <div
              key={e.id}
              className={`bg-panel rounded-lg overflow-hidden transition ${
                isIgnored
                  ? "border border-dashed border-border/50 opacity-50"
                  : "border border-border"
              }`}
            >
              {/* Header row — always visible */}
              <div className="w-full flex items-center">
              <button
                onClick={() => setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                  return next;
                })}
                className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3 text-sm hover:bg-bg/50 transition"
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
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  toggleIgnored(e.id);
                }}
                className={`shrink-0 mr-2 p-2 rounded transition ${
                  isIgnored
                    ? "text-muted hover:text-info"
                    : "text-info/70 hover:text-info hover:bg-info/10"
                }`}
                title={
                  isIgnored
                    ? "Réinclure cette analyse dans le graphique de stabilité et l'histogramme de biais"
                    : "Exclure cette analyse du graphique de stabilité et de l'histogramme de biais (sans la supprimer)"
                }
                aria-label={isIgnored ? "Réinclure dans les graphiques" : "Exclure des graphiques"}
              >
                {isIgnored ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              </div>

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
  // σ interpretation thresholds:
  //   < GOOD (0.03)    — good: rides are reproducible
  //   GOOD..WARN (0.05)— moderate: aggregate is OK, individual rides so-so
  //   > WARN           — bad: individual rides are unreliable
  const GOOD_STD = 0.03;
  const WARN_STD = 0.05;
  const targetStd = GOOD_STD;

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
  const H = 140; // a bit taller to fit the sensor legend row below the chart
  const PL = 40;
  const PR = 10;
  const PT = 15;
  const PB = 40; // room for x-axis ticks and the sensor legend
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  // Date-based x axis: turn each point's ISO date into an epoch timestamp
  // and scale linearly between the first and last VALID point (ones with
  // a computed σ). Using the full timeline for min/max would push every
  // visible point to the right when the first 9 points have no rolling
  // window yet — e.g. a single old ride in 2023 followed by a long gap
  // before the next 10+ rides in 2024.
  const tsOf = (dateStr: string) => new Date(dateStr).getTime();
  const tsMin = tsOf(valid[0].date);
  const tsMax = tsOf(valid[valid.length - 1].date);
  const tsRange = Math.max(tsMax - tsMin, 1); // avoid /0 on a single-day history
  const xOfDate = (dateStr: string) =>
    PL + ((tsOf(dateStr) - tsMin) / tsRange) * innerW;
  const xOf = (i: number) => xOfDate(timeline[i].date);
  const yMax = Math.max(maxStd, targetStd * 2);
  const yOf = (s: number) => PT + (1 - s / yMax) * innerH;

  // Distinct sensors in the order they first appear → assign a stable
  // colour to each. Points and phase bands use the same palette so the
  // user can read off which sensor drove each part of the curve.
  // Palette: first colours are reserved for *named* sensors in the order
  // they first appear in the dataset. The special "__unknown__" key is
  // always mapped to grey regardless of its position, so rides without a
  // sensor label (legacy entries) don't accidentally steal the first
  // colour slot.
  const SENSOR_PALETTE = [
    "#3ba99c", // teal
    "#f59e0b", // amber
    "#e4572e", // coral
    "#8b5cf6", // violet
    "#3b82f6", // blue
    "#ec4899", // pink
    "#10b981", // emerald
  ];
  const UNKNOWN_COLOR = "#6b7280"; // grey
  const sensorOrder: string[] = [];
  for (const p of timeline) {
    if (!p.sensorLabel) continue; // skip unknown for ordering
    if (!sensorOrder.includes(p.sensorLabel)) sensorOrder.push(p.sensorLabel);
  }
  const sensorColor = (label: string | null): string => {
    if (!label) return UNKNOWN_COLOR;
    const idx = sensorOrder.indexOf(label);
    if (idx < 0) return UNKNOWN_COLOR;
    return SENSOR_PALETTE[idx % SENSOR_PALETTE.length];
  };

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">
          Stabilité du CdA (écart-type glissant sur 10 sorties)
        </h3>
        <span className="text-[10px] text-muted font-mono">
          {valid.length} fenêtres · <span className="text-teal">σ&lt;{GOOD_STD.toFixed(2)}</span> bon · <span className="text-warn">&lt;{WARN_STD.toFixed(2)}</span> moyen · <span className="text-coral">&gt;{WARN_STD.toFixed(2)}</span> peu fiable
        </span>
      </div>
      <p className="text-[11px] text-muted mb-2 leading-tight">
        Écart-type (σ) de votre CdA sur les 10 dernières sorties à chaque date.
        Plus c'est bas, plus vos estimations sont reproductibles. Une baisse
        brutale = changement de capteur ou meilleure calibration. Les zones
        horizontales indiquent le niveau de fiabilité (vert = bon, jaune =
        moyen, rouge = peu fiable). Le fond teinté par capteur est
        volontairement discret pour ne pas masquer les seuils.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Horizontal σ interpretation bands: green = good, yellow = moderate,
            red = unreliable. The y coordinates are clamped into the plot area
            in case maxStd is below a threshold. */}
        {(() => {
          const yGood = Math.max(yOf(GOOD_STD), PT);
          const yWarn = Math.max(yOf(WARN_STD), PT);
          const yBase = H - PB;
          return (
            <>
              {/* Red zone: σ > WARN_STD (top of the plot) */}
              {yWarn > PT && (
                <rect x={PL} y={PT} width={innerW} height={yWarn - PT}
                  fill="#e4572e" opacity={0.06} />
              )}
              {/* Yellow zone: GOOD_STD < σ <= WARN_STD */}
              {yGood > yWarn && (
                <rect x={PL} y={yWarn} width={innerW} height={yGood - yWarn}
                  fill="#f59e0b" opacity={0.06} />
              )}
              {/* Green zone: σ <= GOOD_STD */}
              {yBase > yGood && (
                <rect x={PL} y={yGood} width={innerW} height={yBase - yGood}
                  fill="#3ba99c" opacity={0.06} />
              )}
            </>
          );
        })()}
        {/* Phase background bands — coloured per distinct sensor (same
            palette as the points). Low opacity so the bands are visible
            without drowning the reliability zones. */}
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
              fill={sensorColor(p.label)}
              opacity={0.06}
            />
          );
        })}
        {/* Threshold lines */}
        <line
          x1={PL} x2={W - PR}
          y1={yOf(GOOD_STD)} y2={yOf(GOOD_STD)}
          stroke="#3ba99c" strokeDasharray="3,3" opacity={0.6}
        />
        <text x={PL - 4} y={yOf(GOOD_STD) + 3} fill="#3ba99c" fontSize="9" textAnchor="end" fontFamily="monospace">
          {GOOD_STD.toFixed(2)}
        </text>
        {yOf(WARN_STD) > PT + 3 && (
          <>
            <line
              x1={PL} x2={W - PR}
              y1={yOf(WARN_STD)} y2={yOf(WARN_STD)}
              stroke="#f59e0b" strokeDasharray="3,3" opacity={0.5}
            />
            <text x={PL - 4} y={yOf(WARN_STD) + 3} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="monospace">
              {WARN_STD.toFixed(2)}
            </text>
          </>
        )}
        {/* Y axis */}
        <text x={PL - 4} y={PT + 4} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">
          {yMax.toFixed(2)}
        </text>
        <text x={PL - 4} y={H - PB + 3} fill="#6b7280" fontSize="9" textAnchor="end" fontFamily="monospace">
          0
        </text>
        {/* Std curve — monotone cubic interpolation (Fritsch-Carlson 1980).
            Earlier versions used uniform Catmull-Rom which, on a calendar
            time x-axis with irregular spacing (two consecutive days next
            to a 30-day gap), produces overshoots and visible self-crossing
            loops. Monotone cubic guarantees the interpolant never
            overshoots the data between points — no loops, ever, by
            construction. Reference: Fritsch & Carlson, "Monotone Piecewise
            Cubic Interpolation", SIAM J. Numer. Anal. 17(2), 1980. */}
        {(() => {
          const pts = valid.map((p) => ({
            x: xOfDate(p.date),
            y: yOf(p.std),
          }));
          if (pts.length < 2) return null;
          const n = pts.length;
          // Secants dk = (yk+1 − yk) / (xk+1 − xk)
          const dks: number[] = new Array(n - 1);
          for (let k = 0; k < n - 1; k++) {
            const dx = pts[k + 1].x - pts[k].x || 1e-6;
            dks[k] = (pts[k + 1].y - pts[k].y) / dx;
          }
          // Initial tangents: average of adjacent secants; endpoints take
          // the single adjacent secant.
          const ms: number[] = new Array(n);
          ms[0] = dks[0];
          ms[n - 1] = dks[n - 2];
          for (let k = 1; k < n - 1; k++) {
            if (dks[k - 1] * dks[k] <= 0) {
              // Sign change or zero slope → enforce flat tangent to
              // preserve monotonicity of each segment.
              ms[k] = 0;
            } else {
              ms[k] = (dks[k - 1] + dks[k]) / 2;
            }
          }
          // Fritsch-Carlson correction: ensure (α, β) = (m_k / d_k, m_k+1 / d_k)
          // stays inside the circle α² + β² ≤ 9 (equivalently inside [0,3]²).
          for (let k = 0; k < n - 1; k++) {
            if (dks[k] === 0) {
              ms[k] = 0;
              ms[k + 1] = 0;
              continue;
            }
            const a = ms[k] / dks[k];
            const b = ms[k + 1] / dks[k];
            const h = a * a + b * b;
            if (h > 9) {
              const t = 3 / Math.sqrt(h);
              ms[k] = t * a * dks[k];
              ms[k + 1] = t * b * dks[k];
            }
          }
          // Emit cubic Bezier segments. For Hermite → Bezier with tangents
          // m_k, m_{k+1} and length h_k = x_{k+1} − x_k:
          //   cp1 = (x_k + h_k/3,     y_k     + m_k     * h_k/3)
          //   cp2 = (x_{k+1} − h_k/3, y_{k+1} − m_{k+1} * h_k/3)
          let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
          for (let k = 0; k < n - 1; k++) {
            const p1 = pts[k];
            const p2 = pts[k + 1];
            const h = p2.x - p1.x;
            const cp1x = p1.x + h / 3;
            const cp1y = p1.y + (ms[k] * h) / 3;
            const cp2x = p2.x - h / 3;
            const cp2y = p2.y - (ms[k + 1] * h) / 3;
            d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
          }
          return (
            <path
              d={d}
              fill="none"
              stroke="#e9edf3"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })()}
        {/* Points, coloured by sensor identity (one colour per distinct
            sensor label, matching the phase band + the legend row below). */}
        {valid.map((p, j) => {
          return (
            <circle
              key={j}
              cx={xOfDate(p.date)}
              cy={yOf(p.std)}
              r={2.6}
              fill={sensorColor(p.sensorLabel)}
              stroke="#0c0f14"
              strokeWidth={0.4}
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
          if (valid.length === 0) return null;
          // Use the valid-rides range (same as the x axis scaling)
          // instead of the full timeline to avoid ghost ticks in a
          // trailing empty pre-window zone.
          const firstDate = new Date(valid[0].date);
          const lastDate = new Date(valid[valid.length - 1].date);
          // Build ticks at every quarter boundary that falls strictly
          // inside the [firstDate, lastDate] span. Each tick's x position
          // comes from the real calendar date (xOfDate), not from a ride
          // index, so the spacing stays proportional to elapsed time.
          const ticks: { label: string; dateStr: string }[] = [];
          const startYear = firstDate.getFullYear();
          const startQuarter = Math.floor(firstDate.getMonth() / 3);
          let y = startYear;
          let q = startQuarter + 1; // first quarter strictly after firstDate
          if (q > 3) { q = 0; y += 1; }
          while (true) {
            const qDate = new Date(y, q * 3, 1);
            if (qDate > lastDate) break;
            const dateStr = qDate.toISOString().slice(0, 10);
            ticks.push({
              label: `${y}-${String(q * 3 + 1).padStart(2, "0")}`,
              dateStr,
            });
            q += 1;
            if (q > 3) { q = 0; y += 1; }
          }
          // If we have more than 8 quarter ticks, keep every other one to
          // avoid label collisions on tight screens.
          const shown = ticks.length > 8 ? ticks.filter((_, i) => i % 2 === 0) : ticks;
          return (
            <>
              {shown.map((t, i) => {
                const x = xOfDate(t.dateStr);
                return (
                  <g key={i}>
                    <line
                      x1={x} x2={x}
                      y1={H - PB} y2={H - PB + 3}
                      stroke="#6b7280" opacity={0.6}
                    />
                    <text
                      x={x}
                      y={H - PB + 13}
                      fill="#6b7280"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {t.label}
                    </text>
                  </g>
                );
              })}
            </>
          );
        })()}
        {/* Sensor legend row below the x axis ticks. We list the known
            sensors in first-seen order + an "Inconnu" bucket when any
            point lacks a sensor label (e.g. legacy history entries
            analysed before rc.powerMeter existed). */}
        {(() => {
          const knownPresent = sensorOrder.filter((s) =>
            timeline.some((p) => p.sensorLabel === s),
          );
          const hasUnknown = timeline.some((p) => !p.sensorLabel);
          const entries: { key: string; label: string; color: string }[] = [
            ...knownPresent.map((s) => ({ key: s, label: s, color: sensorColor(s) })),
          ];
          if (hasUnknown) {
            entries.push({ key: "__unknown__", label: "Inconnu (re-analyse pour colorer)", color: UNKNOWN_COLOR });
          }
          if (entries.length === 0) return null;
          const legendY = H - 4;
          const colWidth = innerW / Math.max(entries.length, 1);
          // Budget ~5.4 px per monospace char at fontSize 9, minus the
          // circle (~12 px) and a 4 px right-gap. This keeps labels inside
          // their own column so 3+ sensors never overlap.
          const charsPerCol = Math.max(4, Math.floor((colWidth - 16) / 5.4));
          const truncate = (s: string) =>
            s.length > charsPerCol ? s.slice(0, Math.max(1, charsPerCol - 1)) + "…" : s;
          return (
            <g>
              {entries.map((e, i) => {
                const cx = PL + i * colWidth + 6;
                const display = truncate(e.label);
                return (
                  <g key={i}>
                    <circle cx={cx} cy={legendY - 3} r={3} fill={e.color} />
                    <text
                      x={cx + 6}
                      y={legendY}
                      fill="#9ca3af"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {display}
                      <title>{e.label}</title>
                    </text>
                  </g>
                );
              })}
            </g>
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
function BiasHistogram({ entries, selectedSensors }: { entries: HistoryEntry[]; selectedSensors: Set<string> }) {
  // Gather (sensor, biasRatio) per ride, deduplicated by (athleteKey, date):
  // the same ride re-analysed twice would otherwise double-count into the
  // histogram. We keep the version from the most recent entry per athlete.
  // Per-ride sensor filter: if the user has selected specific sensors in
  // the history filter block, only rides whose sensor is in the selection
  // contribute to the histogram. Rides without per-ride sensor metadata
  // fall back to the entry label (or "__unknown__").
  type Sample = { ratio: number; sensor: string };
  const noSensorFilter = selectedSensors.size === 0;
  const bestByKey = new Map<string, { entry: HistoryEntry; rc: HistoryEntry["rideCdas"][number] }>();
  for (const e of entries) {
    const athKey = e.athleteKey || "__unknown__";
    const entryHasPerRide = e.rideCdas.some((rc) => rc.powerMeter);
    for (const rc of e.rideCdas) {
      if (rc.biasRatio == null || !Number.isFinite(rc.biasRatio)) continue;
      // Resolve per-ride sensor key for the filter check.
      let sensorKey: string;
      if (rc.powerMeter) sensorKey = rc.powerMeter;
      else if (!entryHasPerRide && e.powerMeterLabel && !e.powerMeterLabel.startsWith("Mixte"))
        sensorKey = e.powerMeterLabel;
      else sensorKey = "__unknown__";
      if (!noSensorFilter && !selectedSensors.has(sensorKey)) continue;
      const key = `${athKey}|${rc.date}`;
      const prev = bestByKey.get(key);
      if (!prev) {
        bestByKey.set(key, { entry: e, rc });
        continue;
      }
      if (prev.entry.timestamp < e.timestamp) {
        bestByKey.set(key, { entry: e, rc });
        continue;
      }
      // Intra-entry collision: two rides same day in the same entry,
      // keep the one with the best nRMSE (same rule as the timeline).
      if (prev.entry.id === e.id && rc.nrmse < prev.rc.nrmse) {
        bestByKey.set(key, { entry: e, rc });
      }
    }
  }
  const samples: Sample[] = [];
  for (const { entry: e, rc } of bestByKey.values()) {
    samples.push({
      ratio: rc.biasRatio!,
      sensor: rc.powerMeter || e.powerMeterLabel || "Inconnu",
    });
  }
  if (samples.length < 10) return null;

  // Group by sensor
  const bySensor = new Map<string, number[]>();
  for (const s of samples) {
    const arr = bySensor.get(s.sensor) || [];
    arr.push(s.ratio);
    bySensor.set(s.sensor, arr);
  }
  const sensors = [...bySensor.keys()].sort();

  // Kernel Density Estimate on a uniform grid. Gaussian kernel, Silverman
  // bandwidth rule-of-thumb per sensor. Smoother + more honest than a
  // stacked histogram when N is small per sensor.
  const MIN = 0.6;
  const MAX = 1.6;
  const N_GRID = 120;
  const grid = Array.from({ length: N_GRID }, (_, i) => MIN + (i / (N_GRID - 1)) * (MAX - MIN));
  const kde = (vals: number[]): { ys: number[]; h: number } => {
    const n = vals.length;
    if (n === 0) return { ys: new Array(N_GRID).fill(0), h: 0.05 };
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, n - 1);
    const sd = Math.sqrt(variance);
    // Silverman: h = 1.06 * σ * n^(-1/5). Floor at 0.03 so small samples
    // don't degenerate into spikes.
    const h = Math.max(0.03, 1.06 * (sd || 0.1) * Math.pow(n, -1 / 5));
    const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
    const ys = grid.map((x) => {
      let s = 0;
      for (const v of vals) {
        const z = (x - v) / h;
        s += Math.exp(-0.5 * z * z);
      }
      return s * norm;
    });
    return { ys, h };
  };

  const COLORS: Record<number, string> = {
    0: "#3ba99c",
    1: "#f59e0b",
    2: "#e4572e",
    3: "#6b7280",
  };

  // SVG layout. Legend is rendered BELOW the chart in dedicated rows to
  // avoid colliding with the curves. We reserve ~14 px per legend row,
  // wrapping 2 legend items per row.
  const W = 700;
  const PL = 35;
  const PR = 10;
  const PT = 10;
  const PB_CHART = 26;
  const LEGEND_COLS = 2;
  const LEGEND_ROW_H = 14;
  const nLegendRows = Math.ceil(sensors.length / LEGEND_COLS);
  const PB = PB_CHART + nLegendRows * LEGEND_ROW_H + 4;
  const H = 160 + Math.max(0, (nLegendRows - 1) * LEGEND_ROW_H);
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  // Compute one KDE per sensor on the shared grid; share the y scale so
  // the curves are comparable in density (peak height = "how concentrated
  // this sensor's rides are around that bias value").
  const kdeBySensor = sensors.map((s) => {
    const vals = bySensor.get(s)!;
    const { ys } = kde(vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { sensor: s, ys, n: vals.length, mean };
  });
  const maxY = Math.max(0.001, ...kdeBySensor.flatMap((d) => d.ys));
  const xOf = (x: number) => PL + ((x - MIN) / (MAX - MIN)) * innerW;
  const yOf = (y: number) => H - PB - (y / maxY) * innerH;
  const curvePath = (ys: number[]): string => {
    let d = "";
    for (let i = 0; i < ys.length; i++) {
      d += (i === 0 ? "M" : "L") + xOf(grid[i]).toFixed(1) + "," + yOf(ys[i]).toFixed(1) + " ";
    }
    return d.trim();
  };
  const areaPath = (ys: number[]): string => {
    const baseY = H - PB;
    let d = "M" + xOf(grid[0]).toFixed(1) + "," + baseY.toFixed(1) + " ";
    for (let i = 0; i < ys.length; i++) {
      d += "L" + xOf(grid[i]).toFixed(1) + "," + yOf(ys[i]).toFixed(1) + " ";
    }
    d += "L" + xOf(grid[ys.length - 1]).toFixed(1) + "," + baseY.toFixed(1) + " Z";
    return d;
  };

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">
          Distribution du biais de calibration par capteur
        </h3>
        <span className="text-[10px] text-muted font-mono">
          {samples.length} rides avec bias
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
        {/* X axis labels — sit just below the chart baseline */}
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
        {/* X axis title */}
        <text
          x={PL + innerW / 2}
          y={H - PB + 22}
          fill="#6b7280"
          fontSize="9"
          textAnchor="middle"
          fontFamily="monospace"
        >
          biais (mesuré / théorique)
        </text>
        {/* Smooth KDE curves per sensor — one bell curve per power meter,
            filled semi-transparent so overlap is visible. */}
        {kdeBySensor.map(({ sensor: _s, ys }, sIdx) => {
          const color = COLORS[sIdx % 4];
          return (
            <g key={sIdx}>
              <path d={areaPath(ys)} fill={color} opacity={0.18} />
              <path d={curvePath(ys)} fill="none" stroke={color} strokeWidth={1.8} opacity={0.95} />
            </g>
          );
        })}
        {/* Mean markers at the top of each curve (small triangle) */}
        {kdeBySensor.map(({ sensor: _s, ys, mean }, sIdx) => {
          const color = COLORS[sIdx % 4];
          // Find the KDE value at mean by interpolation (mean is usually
          // close to the curve peak but not exactly on a grid point).
          const t = (mean - MIN) / (MAX - MIN);
          const idxF = Math.max(0, Math.min(N_GRID - 1, t * (N_GRID - 1)));
          const i0 = Math.floor(idxF);
          const i1 = Math.min(N_GRID - 1, i0 + 1);
          const f = idxF - i0;
          const yAtMean = ys[i0] * (1 - f) + ys[i1] * f;
          const mx = xOf(mean);
          const my = yOf(yAtMean);
          return (
            <g key={`mean-${sIdx}`}>
              <line x1={mx} x2={mx} y1={my} y2={H - PB} stroke={color} strokeWidth={1} strokeDasharray="2,2" opacity={0.7} />
              <circle cx={mx} cy={my} r={2.5} fill={color} stroke="#0b1020" strokeWidth={0.8} />
            </g>
          );
        })}
        {/* Legend — wraps onto multiple rows to prevent overlaps */}
        {kdeBySensor.map((s, i) => {
          const row = Math.floor(i / LEGEND_COLS);
          const col = i % LEGEND_COLS;
          const colW = innerW / LEGEND_COLS;
          const x = PL + col * colW;
          const y = H - PB + 34 + row * LEGEND_ROW_H;
          // Truncate long sensor labels so they fit within one legend column,
          // accounting for the "(n=NN, μ=X.XX)" suffix (~14 chars).
          const maxLabelChars = Math.max(8, Math.floor(colW / 6.5) - 14);
          const label = s.sensor.length > maxLabelChars
            ? s.sensor.slice(0, maxLabelChars - 1) + "…"
            : s.sensor;
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <rect width={9} height={9} y={-8} fill={COLORS[i % 4]} />
              <text x={13} y={0} fill="#e9edf3" fontSize="10" fontFamily="monospace">
                {label} (n={s.n}, μ={s.mean.toFixed(2)})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
