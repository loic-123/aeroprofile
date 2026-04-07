import { useState } from "react";
import FileUpload from "./components/FileUpload";
import ResultsDashboard from "./components/ResultsDashboard";
import CompareMode from "./components/CompareMode";
import BlogIndex from "./pages/BlogIndex";
import { ARTICLES } from "./pages/articles";
import { BlogProvider } from "./components/BlogLayout";
import { analyze } from "./api/client";
import type { AnalysisResult } from "./types";
import { Wind, Users, User, FileText, Loader2, BookOpen } from "lucide-react";
import InfoTooltip from "./components/InfoTooltip";
import CdAEvolutionChart from "./components/CdAEvolutionChart";

type Mode = "single" | "compare" | "blog";

const MAX_NRMSE = 0.60;

interface RideAnalysis {
  file: File;
  result?: AnalysisResult;
  error?: string;
  excluded: boolean;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [rides, setRides] = useState<RideAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [blogSlug, setBlogSlug] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  const handleAnalyze = async (
    files: File[],
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number },
  ) => {
    setLoading(true);
    setError(null);
    setRides([]);
    setSelectedIdx(0);
    setTotalFiles(files.length);
    setDoneCount(0);

    const results: RideAnalysis[] = [];
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const res = await analyze({ file, mass_kg, ...opts });
        const nrmse = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
        results.push({ file, result: res, excluded: nrmse > MAX_NRMSE });
      } catch (e: any) {
        results.push({ file, error: e.message || String(e), excluded: true });
      }
      setDoneCount(fi + 1);
      setRides([...results]);
    }

    // Select the best ride (lowest nRMSE among non-excluded) for detail view
    const good = results
      .map((r, i) => ({ ...r, idx: i }))
      .filter((r) => !r.excluded && r.result);
    if (good.length > 0) {
      const best = good.sort(
        (a, b) =>
          (a.result!.rmse_w / Math.max(a.result!.avg_power_w, 1)) -
          (b.result!.rmse_w / Math.max(b.result!.avg_power_w, 1))
      )[0];
      setSelectedIdx(best.idx);
    }
    setLoading(false);
  };

  const goodRides = rides.filter((r) => !r.excluded && r.result);
  const hasResults = rides.some((r) => r.result);
  const isMulti = rides.length > 1;

  // Weighted average across good rides (same logic as CompareMode)
  let aggCda: number | null = null;
  let aggCrr: number | null = null;
  let aggCdaLow: number | null = null;
  let aggCdaHigh: number | null = null;
  let aggPower: number | null = null;
  if (goodRides.length >= 1) {
    const nrmses = goodRides.map((r) =>
      Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01)
    );
    const bestN = Math.min(...nrmses);
    const worstN = Math.max(...nrmses);
    const span = worstN - bestN;
    let totalW = 0, sumCda = 0, sumCrr = 0, sumPow = 0;
    for (let j = 0; j < goodRides.length; j++) {
      const res = goodRides[j].result!;
      const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
      const w = Math.max(res.valid_points, 1) * qw;
      totalW += w;
      sumCda += res.cda * w;
      sumCrr += res.crr * w;
      sumPow += res.avg_power_w * w;
    }
    aggCda = sumCda / totalW;
    aggCrr = sumCrr / totalW;
    aggPower = sumPow / totalW;
    if (goodRides.length >= 2) {
      const cdas = goodRides.map((r) => r.result!.cda);
      let wVar = 0;
      for (const c of cdas) wVar += (c - aggCda!) ** 2;
      wVar /= cdas.length;
      const se = Math.sqrt(wVar / cdas.length);
      aggCdaLow = aggCda - 1.96 * se;
      aggCdaHigh = aggCda + 1.96 * se;
    }
  }

  const selectedResult = rides[selectedIdx]?.result || null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3 flex-wrap">
        <Wind className="text-teal" size={24} />
        <h1 className="text-xl font-bold tracking-tight">AeroProfile</h1>
        <span className="text-muted text-sm ml-2 hidden md:inline">
          CdA / Crr depuis votre fichier d'activité
        </span>
        <div className="flex-1" />
        <div className="flex bg-panel border border-border rounded">
          <button
            onClick={() => {
              setMode("single");
              setRides([]);
              setError(null);
            }}
            className={`px-3 py-1.5 text-sm flex items-center gap-2 ${
              mode === "single" ? "bg-teal text-white" : "text-muted"
            }`}
          >
            <User size={14} /> Analyse
          </button>
          <button
            onClick={() => {
              setMode("compare");
              setRides([]);
              setError(null);
            }}
            className={`px-3 py-1.5 text-sm flex items-center gap-2 ${
              mode === "compare" ? "bg-teal text-white" : "text-muted"
            }`}
          >
            <Users size={14} /> Comparer
          </button>
          <button
            onClick={() => {
              setMode("blog");
              setBlogSlug(null);
            }}
            className={`px-3 py-1.5 text-sm flex items-center gap-2 ${
              mode === "blog" ? "bg-teal text-white" : "text-muted"
            }`}
          >
            <BookOpen size={14} /> Méthodo
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {mode === "blog" ? (
          <BlogProvider value={{ slug: blogSlug, go: setBlogSlug }}>
            {blogSlug && ARTICLES[blogSlug] ? (
              (() => { const Comp = ARTICLES[blogSlug]; return <Comp />; })()
            ) : (
              <BlogIndex />
            )}
          </BlogProvider>
        ) : mode === "compare" ? (
          <CompareMode onBack={() => setMode("single")} />
        ) : (
          <>
            {!hasResults && !loading && (
              <FileUpload onAnalyze={handleAnalyze} loading={loading} error={error} />
            )}

            {loading && !hasResults && (
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto text-teal" size={32} />
                <p className="text-muted mt-3">Analyse en cours…</p>
              </div>
            )}

            {hasResults && (
              <>
                <button
                  onClick={() => {
                    setRides([]);
                    setError(null);
                  }}
                  className="mb-4 text-sm text-muted hover:text-text"
                >
                  ← Nouvelle analyse
                </button>

                {/* Progress bar while still analyzing */}
                {loading && totalFiles > 1 && (
                  <div className="mb-4 bg-panel border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin text-teal" size={14} />
                        Analyse en cours…
                      </span>
                      <span className="font-mono text-teal">
                        {doneCount} / {totalFiles}
                      </span>
                    </div>
                    <div className="h-2 bg-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal rounded-full transition-all duration-500"
                        style={{ width: `${(doneCount / totalFiles) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1.5">
                      {doneCount < totalFiles
                        ? `Fichier en cours : ${totalFiles - doneCount} restant${totalFiles - doneCount > 1 ? "s" : ""}`
                        : "Finalisation…"
                      }
                    </p>
                  </div>
                )}

                {/* Multi-ride aggregate banner */}
                {isMulti && aggCda !== null && (
                  <div className="bg-panel border border-teal rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <div className="text-xs text-muted uppercase tracking-wide flex items-center">
                          CdA moyen ({goodRides.length} sortie{goodRides.length > 1 ? "s" : ""} retenue{goodRides.length > 1 ? "s" : ""} sur {rides.length})
                          <InfoTooltip text="Moyenne pondérée par le nombre de points valides × qualité (1/nRMSE). Les sorties avec nRMSE > 60% sont exclues. L'IC95 reflète la dispersion entre rides." />
                        </div>
                        <div className="text-3xl font-mono font-bold text-teal mt-1">
                          CdA = {aggCda.toFixed(3)}
                          {aggCdaLow != null && (
                            <span className="text-sm text-muted font-normal ml-2">
                              IC95 [{aggCdaLow.toFixed(3)} – {aggCdaHigh!.toFixed(3)}]
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-auto flex gap-6 text-right">
                        {aggCrr !== null && (
                          <div>
                            <div className="text-xs text-muted">Crr moyen</div>
                            <div className="text-xl font-mono text-teal">{aggCrr.toFixed(4)}</div>
                          </div>
                        )}
                        {aggPower !== null && aggCda !== null && aggCda > 0 && (
                          <div>
                            <div className="text-xs text-muted flex items-center justify-end">
                              W/CdA
                              <InfoTooltip text="Puissance moyenne / CdA = capacité à aller vite sur le plat. Plus c'est haut, plus vous êtes rapide. 300 ≈ 33 km/h, 500 ≈ 39 km/h, 700 ≈ 44 km/h." />
                            </div>
                            <div className="text-xl font-mono text-info">
                              {(aggPower / aggCda).toFixed(0)}
                            </div>
                          </div>
                        )}
                        {aggPower !== null && aggCda !== null && aggCda > 0 && (
                          <div>
                            <div className="text-xs text-muted">V plat théorique</div>
                            <div className="text-xl font-mono text-info">
                              {(Math.pow(2 * aggPower / (aggCda * 1.2), 1/3) * 3.6).toFixed(1)} km/h
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ride chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rides.map((r, i) => {
                        const nrmse = r.result
                          ? (r.result.rmse_w || 0) / Math.max(r.result.avg_power_w, 1)
                          : 0;
                        return (
                          <button
                            key={i}
                            onClick={() => r.result && setSelectedIdx(i)}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono transition ${
                              r.excluded
                                ? "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
                                : i === selectedIdx
                                  ? "bg-teal/20 text-teal border border-teal"
                                  : "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:border-teal"
                            }`}
                          >
                            {r.excluded ? "✗" : i === selectedIdx ? "▶" : "✓"}
                            <FileText size={11} />
                            {r.file.name.length > 20
                              ? r.file.name.slice(0, 17) + "…"
                              : r.file.name}
                            {r.result && !r.excluded && (
                              <span className="opacity-60">
                                {r.result.cda.toFixed(3)}
                              </span>
                            )}
                            {r.excluded && r.error && (
                              <span className="opacity-60">erreur</span>
                            )}
                            {r.excluded && r.result && (
                              <span className="opacity-60">excl.</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-teal" /> Retenue (cliquer = détail)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Exclue (nRMSE &gt; 60%)
                      </span>
                    </div>
                  </div>
                )}

                {/* CdA evolution over time (multi-ride) */}
                {isMulti && goodRides.length >= 2 && (
                  <div className="mb-6">
                    <CdAEvolutionChart
                      riders={[{
                        name: "CdA",
                        points: goodRides.map((r) => ({
                          date: r.result!.ride_date,
                          cda: r.result!.cda,
                          r2: r.result!.r_squared,
                          fileName: r.file.name,
                        })).sort((a, b) => a.date.localeCompare(b.date)),
                      }]}
                    />
                  </div>
                )}

                {/* Detail view of selected ride */}
                {selectedResult && (
                  <ResultsDashboard result={selectedResult} />
                )}

              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
