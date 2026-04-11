import { useState } from "react";
import { Clock, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { getHistory, deleteFromHistory, clearHistory, type HistoryEntry } from "../api/history";

export default function HistoryPage() {
  const [entries, setEntries] = useState(() => getHistory());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

      <div className="space-y-2">
        {entries.map((e) => {
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
                      {e.cdaPriorMean != null ? `${e.cdaPriorMean.toFixed(2)} ± ${e.cdaPriorSigma?.toFixed(2)}` : "défaut"}
                    </span></div>
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
