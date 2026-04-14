import { useState } from "react";
import FileUpload from "./components/FileUpload";
import ProfilePicker from "./components/ProfilePicker";
import ResultsDashboard from "./components/ResultsDashboard";
import CompareMode from "./components/CompareMode";
import BlogIndex from "./pages/BlogIndex";
import IntervalsPage from "./pages/IntervalsPage";
import { ARTICLES } from "./pages/articles";
import { BlogProvider } from "./components/BlogLayout";
import { analyze, analyzeBatch } from "./api/client";
import { getCached, setCache, type CacheOpts } from "./api/cache";
import type { AnalysisResult, HierarchicalAnalysisResult } from "./types";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS_BY_BIKE, type BikeType } from "./types";
import { Wind, Users, User, FileText, Loader2, BookOpen, Link2, Clock } from "lucide-react";
import { saveToHistory, type HistoryEntry } from "./api/history";
import { getActiveProfile, type ProfileSettings } from "./api/profiles";
import HistoryPage from "./pages/HistoryPage";
import InfoTooltip from "./components/InfoTooltip";
import CdAEvolutionChart from "./components/CdAEvolutionChart";
import CdARunningAvgChart from "./components/CdARunningAvgChart";
import CdATotem from "./components/CdATotem";
import TabSwitcher from "./components/TabSwitcher";
import ReferenceTable from "./components/ReferenceTable";
import PositionSchematic from "./components/PositionSchematic";

type Mode = "single" | "compare" | "intervals" | "blog" | "history";

const DEFAULT_MAX_NRMSE = 0.45;

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
  const [viewTab, setViewTab] = useState<"overview" | "detail">("overview");
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [lastMass, setLastMass] = useState(75);
  const [lastMaxNrmse, setLastMaxNrmse] = useState(DEFAULT_MAX_NRMSE);
  const [hierResult, setHierResult] = useState<HierarchicalAnalysisResult | null>(null);
  const [hierLoading, setHierLoading] = useState(false);
  const [hierError, setHierError] = useState<string | null>(null);

  // --- Upload-mode profile wiring -----------------------------------------
  // The ProfilePicker above FileUpload drives this: when the user loads
  // a profile, we bump `uploadProfileVersion` to force FileUpload to
  // remount with the new defaults. `uploadFormSettings` is the mirror of
  // FileUpload's internal state so the "Save to profile" button has
  // access to the up-to-date values.
  const initialActiveProfile = getActiveProfile();
  const [uploadProfileKey, setUploadProfileKey] = useState(initialActiveProfile.key);
  const [uploadProfileVersion, setUploadProfileVersion] = useState(0);
  const [uploadInitialSettings, setUploadInitialSettings] = useState<ProfileSettings>(
    initialActiveProfile.settings || {},
  );
  const [uploadFormSettings, setUploadFormSettings] = useState<ProfileSettings>(
    initialActiveProfile.settings || {},
  );
  const onUploadProfileLoad = (s: ProfileSettings) => {
    setUploadInitialSettings(s);
    setUploadFormSettings(s);
    setUploadProfileKey(getActiveProfile().key);
    setUploadProfileVersion((v) => v + 1);
  };

  const handleAnalyze = async (
    files: File[],
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number; useCache?: boolean; bikeType?: BikeType; positionIdx?: number; maxNrmse?: number },
  ) => {
    const bt = opts.bikeType || "road";
    setBikeType(bt);
    setLastMass(mass_kg);
    const { minCda: MIN_CDA, maxCda: MAX_CDA } = BIKE_TYPE_CONFIG[bt];
    const MAX_NRMSE = opts.maxNrmse || DEFAULT_MAX_NRMSE;
    setLastMaxNrmse(MAX_NRMSE);
    const posPreset = opts.positionIdx != null ? POSITION_PRESETS_BY_BIKE[bt][opts.positionIdx] : undefined;
    setLoading(true);
    setError(null);
    setRides([]);
    setSelectedIdx(0);
    setTotalFiles(files.length);
    setDoneCount(0);

    const isMultiRideTop = files.length > 1;
    const cacheOpts: CacheOpts = {
      mass_kg,
      crr_fixed: opts.crr_fixed,
      eta: opts.eta,
      wind_height_factor: opts.wind_height_factor,
      bike_type: bt,
      cda_prior_mean: isMultiRideTop ? undefined : posPreset?.cdaPrior,
      cda_prior_sigma: isMultiRideTop ? undefined : posPreset?.cdaSigma,
      disable_prior: isMultiRideTop,
    };
    const results: RideAnalysis[] = [];
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      // Check local cache (keyed by file + mass + crr + eta + wind)
      const fromCache = opts.useCache !== false ? getCached(file, cacheOpts) : null;
      if (fromCache) {
        const nrmse = (fromCache.rmse_w || 0) / Math.max(fromCache.avg_power_w, 1);
        const qBad = fromCache.quality_status && fromCache.quality_status !== "ok" && fromCache.quality_status !== "prior_dominated";
        results.push({ file, result: fromCache, excluded: !!qBad || nrmse > MAX_NRMSE || fromCache.cda < MIN_CDA || fromCache.cda > MAX_CDA });
      } else {
        try {
          // In multi-file mode, disable per-ride CdA prior. The aggregate
          // inverse-variance weighting handles the regularization correctly.
          // Single-file mode keeps the prior as a soft stabilizer.
          const isMultiRide = files.length > 1;
          const res = await analyze({
            file, mass_kg, ...opts, bike_type: bt,
            cda_prior_mean: isMultiRide ? undefined : posPreset?.cdaPrior,
            cda_prior_sigma: isMultiRide ? undefined : posPreset?.cdaSigma,
            disable_prior: isMultiRide,
          });
          const nrmse = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
          const qBad = res.quality_status && res.quality_status !== "ok" && res.quality_status !== "prior_dominated";
          results.push({ file, result: res, excluded: !!qBad || nrmse > MAX_NRMSE || res.cda < MIN_CDA || res.cda > MAX_CDA });
          setCache(file, res, cacheOpts);
        } catch (e: any) {
          results.push({ file, error: e.message || String(e), excluded: true });
        }
      }
      setDoneCount(fi + 1);
      setRides([...results]);
    }

    // Hierarchical analysis (in parallel, only for multi-file mode)
    let hierPromise: Promise<HierarchicalAnalysisResult | null> = Promise.resolve(null);
    if (files.length >= 2) {
      setHierLoading(true);
      setHierError(null);
      setHierResult(null);
      hierPromise = analyzeBatch({
        files,
        mass_kg,
        crr_fixed: opts.crr_fixed,
        bike_type: bt,
      })
        .then((r) => {
          setHierResult(r);
          return r;
        })
        .catch((e) => {
          setHierError(e.message || String(e));
          return null;
        })
        .finally(() => setHierLoading(false));
    } else {
      setHierResult(null);
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

    // Save to history
    const goodForHistory = results.filter((r) => !r.excluded && r.result);
    if (goodForHistory.length > 0) {
      const nrmses = goodForHistory.map((r) => Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01));
      const bestN = Math.min(...nrmses), worstN = Math.max(...nrmses), span = worstN - bestN;
      let tw = 0, sc = 0, sr = 0, sp = 0, sRho = 0, sRmse = 0;
      for (let j = 0; j < goodForHistory.length; j++) {
        const res = goodForHistory[j].result!;
        const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
        const w = Math.max(res.valid_points, 1) * qw;
        tw += w; sc += res.cda * w; sr += res.crr * w; sp += res.avg_power_w * w; sRho += res.avg_rho * w; sRmse += (res.rmse_w || 0) * w;
      }
      const hCda = sc / tw, hCrr = sr / tw;
      let hLow: number | null = null, hHigh: number | null = null;
      if (goodForHistory.length >= 2) {
        const cdas = goodForHistory.map((r) => r.result!.cda);
        const wVar = cdas.reduce((a, c) => a + (c - hCda) ** 2, 0) / cdas.length;
        const se = Math.sqrt(wVar / cdas.length);
        hLow = hCda - 1.96 * se; hHigh = hCda + 1.96 * se;
      }
      const fileNames = files.map((f) => f.name);
      const label = files.length === 1 ? fileNames[0] : `${goodForHistory.length} sortie${goodForHistory.length > 1 ? "s" : ""} (${fileNames[0]}${files.length > 1 ? "…" : ""})`;
      const hier = await hierPromise;
      // Bike name: take the first ride's source_format (FIT/GPX/TCX) — we
      // don't have a richer bike identity in upload mode yet, but the
      // backend-extracted bike_name will be added later when available.
      const activeProfile = getActiveProfile();
      saveToHistory({
        id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        mode: "single",
        label,
        cda: hCda, cdaLow: hLow, cdaHigh: hHigh, crr: hCrr,
        rmseW: sRmse / tw, avgPowerW: sp / tw, avgRho: sRho / tw,
        bikeType: bt,
        positionLabel: posPreset?.label || BIKE_TYPE_CONFIG[bt].label,
        massKg: mass_kg,
        crrFixed: opts.crr_fixed ?? null,
        cdaPriorMean: posPreset?.cdaPrior ?? null,
        cdaPriorSigma: posPreset?.cdaSigma ?? null,
        maxNrmse: MAX_NRMSE,
        useCache: opts.useCache ?? true,
        disablePrior: isMultiRideTop,
        aggregationMethod: files.length === 1 ? "single" : "inverse_var",
        hierarchicalMu: hier?.mu_cda,
        hierarchicalTau: hier?.tau,
        nRides: goodForHistory.length,
        nExcluded: results.length - goodForHistory.length,
        nTotalPoints: goodForHistory.reduce((a, r) => a + (r.result?.valid_points || 0), 0),
        rideCdas: goodForHistory.map((r) => ({
          date: r.result!.ride_date,
          cda: r.result!.cda,
          nrmse: (r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1),
        })),
        athleteKey: activeProfile.key,
        athleteName: activeProfile.name,
      });
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
  let aggRho: number | null = null;
  let aggRmse: number | null = null;
  if (goodRides.length >= 1) {
    const nrmses = goodRides.map((r) =>
      Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01)
    );
    const bestN = Math.min(...nrmses);
    const worstN = Math.max(...nrmses);
    const span = worstN - bestN;
    // Inverse-variance weighted aggregation (DerSimonian-Laird, fixed effects).
    // Each ride contributes w_i = (1/σ_i²) × quality_i where σ_i comes from the
    // solver's confidence interval (Hessian at MAP estimate). Rides with tighter
    // CI naturally weigh more. The quality factor (nRMSE-based) is kept as a
    // multiplicative reliability discount on top of the statistical variance.
    let totalW = 0, sumCda = 0, sumCrr = 0, sumPow = 0, sumRho = 0, sumRmse = 0;
    for (let j = 0; j < goodRides.length; j++) {
      const res = goodRides[j].result!;
      const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
      // Per-ride sigma from CI95: sigma = (high - low) / (2 * 1.96)
      const ciWidth = (res.cda_ci_high || 0) - (res.cda_ci_low || 0);
      const sigma = ciWidth > 0 ? Math.max(ciWidth / 3.92, 0.001) : 0.05;
      const invVar = 1 / (sigma * sigma);
      const w = invVar * qw;
      totalW += w;
      sumCda += res.cda * w;
      sumCrr += res.crr * w;
      sumPow += res.avg_power_w * w;
      sumRho += res.avg_rho * w;
      sumRmse += (res.rmse_w || 0) * w;
    }
    aggCda = sumCda / totalW;
    aggCrr = sumCrr / totalW;
    aggRmse = sumRmse / totalW;
    aggPower = sumPow / totalW;
    aggRho = sumRho / totalW;
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
        <span className="text-[10px] font-mono text-muted opacity-60" title="Build ID — increment to verify hot-reload">
          v2026.04.14-profiles2
        </span>
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
            onClick={() => setMode("intervals")}
            className={`px-3 py-1.5 text-sm flex items-center gap-2 ${
              mode === "intervals" ? "bg-teal text-white" : "text-muted"
            }`}
          >
            <Link2 size={14} /> Intervals
          </button>
          <button
            onClick={() => setMode("history")}
            className={`px-3 py-1.5 text-sm flex items-center gap-2 ${
              mode === "history" ? "bg-teal text-white" : "text-muted"
            }`}
          >
            <Clock size={14} /> Historique
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
        {mode === "history" ? (
          <HistoryPage />
        ) : mode === "intervals" ? (
          <IntervalsPage />
        ) : mode === "blog" ? (
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
              <>
                <ProfilePicker
                  currentSettings={uploadFormSettings}
                  onLoad={onUploadProfileLoad}
                  context="upload"
                />
                <FileUpload
                  key={`${uploadProfileKey}-${uploadProfileVersion}`}
                  onAnalyze={handleAnalyze}
                  loading={loading}
                  error={error}
                  initialMass={uploadInitialSettings.massKg}
                  initialBikeType={uploadInitialSettings.bikeType}
                  initialPositionIdx={uploadInitialSettings.positionIdx}
                  initialCrrFixed={uploadInitialSettings.crrFixed ?? null}
                  initialMaxNrmse={uploadInitialSettings.maxNrmse}
                  onSettingsChange={(s) =>
                    setUploadFormSettings({
                      massKg: s.mass,
                      bikeType: s.bikeType,
                      positionIdx: s.positionIdx,
                      crrFixed: s.crrFixed,
                      maxNrmse: s.maxNrmse,
                    })
                  }
                />
              </>
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
                        ? `${totalFiles - doneCount} restant${totalFiles - doneCount > 1 ? "s" : ""}…`
                        : "Finalisation…"
                      }
                    </p>
                  </div>
                )}

                {/* Single file → no tabs, show dashboard directly */}
                {!isMulti && selectedResult && (
                  <ResultsDashboard result={selectedResult} massKg={lastMass} />
                )}

                {/* Single file excluded → show warning with reason */}
                {!isMulti && !selectedResult && rides.length === 1 && rides[0].result && (
                  <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4 text-sm">
                    <div className="font-semibold text-orange-400 mb-2">Sortie exclue</div>
                    {(() => {
                      const r = rides[0].result!;
                      const nrmse = (r.rmse_w || 0) / Math.max(r.avg_power_w, 1);
                      const reasons: string[] = [];
                      if (nrmse > (lastMaxNrmse)) reasons.push(`nRMSE = ${(nrmse * 100).toFixed(0)}% (seuil : ${(lastMaxNrmse * 100).toFixed(0)}%) — le modèle physique n'arrive pas à prédire correctement la puissance sur cette sortie`);
                      if (r.cda < BIKE_TYPE_CONFIG[bikeType].minCda) reasons.push(`CdA = ${r.cda.toFixed(3)} est en dessous du minimum (${BIKE_TYPE_CONFIG[bikeType].minCda}) pour un vélo ${BIKE_TYPE_CONFIG[bikeType].label} — possible drafting`);
                      if (r.cda > BIKE_TYPE_CONFIG[bikeType].maxCda) reasons.push(`CdA = ${r.cda.toFixed(3)} dépasse le maximum (${BIKE_TYPE_CONFIG[bikeType].maxCda}) pour un vélo ${BIKE_TYPE_CONFIG[bikeType].label}`);
                      return (
                        <>
                          <ul className="list-disc ml-4 space-y-1 text-text">
                            {reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                          <p className="text-muted mt-2">
                            Vous pouvez augmenter le seuil nRMSE dans les options avancées, ou essayer avec d'autres paramètres (masse, Crr, position).
                          </p>
                          <div className="mt-3 grid grid-cols-3 gap-3 text-xs font-mono">
                            <div>CdA : <span className="text-teal">{r.cda.toFixed(3)}</span></div>
                            <div>Crr : <span className="text-teal">{r.crr.toFixed(4)}</span></div>
                            <div>RMSE : <span className="text-muted">±{r.rmse_w.toFixed(0)} W</span></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Single file error */}
                {!isMulti && !selectedResult && rides.length === 1 && rides[0].error && (
                  <div className="bg-coral/10 border border-coral rounded-lg p-4 text-sm text-coral">
                    Erreur d'analyse : {rides[0].error}
                  </div>
                )}

                {/* Multi-ride → tabbed view */}
                {isMulti && aggCda !== null && (
                  <>
                    <TabSwitcher
                      tabs={[
                        { id: "overview", label: "Vue d'ensemble" },
                        { id: "detail", label: "Détail d'une sortie" },
                      ]}
                      active={viewTab}
                      onChange={(id) => setViewTab(id as "overview" | "detail")}
                    />

                    {viewTab === "overview" && (
                      <div className="space-y-6">
                        {/* Totem */}
                        {!loading && <CdATotem cda={aggCda} />}

                        {/* Aggregate banner */}
                        <div className="bg-panel border border-teal rounded-lg p-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div>
                              <div className="text-xs text-muted uppercase tracking-wide flex items-center">
                                CdA moyen ({goodRides.length} sortie{goodRides.length > 1 ? "s" : ""} retenue{goodRides.length > 1 ? "s" : ""} sur {rides.length}) — méthode inverse-variance
                                <InfoTooltip text="Méthode A : chaque ride est analysée séparément, puis agrégée par moyenne pondérée par 1/σ² (Hessienne) × qualité (1/nRMSE). C'est l'approche standard en méta-analyse fixed-effects." />
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
                              {aggRmse !== null && (
                                <div>
                                  <div className="text-xs text-muted">RMSE moyen</div>
                                  <div className="text-xl font-mono text-muted">±{aggRmse.toFixed(0)} W</div>
                                </div>
                              )}
                              {aggPower !== null && aggCda > 0 && (
                                <div>
                                  <div className="text-xs text-muted flex items-center justify-end">
                                    W/CdA
                                    <InfoTooltip text="Puissance moyenne / CdA = capacité à aller vite sur le plat." />
                                  </div>
                                  <div className="text-xl font-mono text-info">
                                    {(aggPower / aggCda).toFixed(0)}
                                  </div>
                                </div>
                              )}
                              {aggPower !== null && aggCda > 0 && (
                                <div>
                                  <div className="text-xs text-muted">V plat</div>
                                  <div className="text-xl font-mono text-info">
                                    {(Math.pow(2 * aggPower / (aggCda * (aggRho || 1.2)), 1/3) * 3.6).toFixed(1)} km/h
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hierarchical (Method B) banner — for comparison */}
                        {(hierLoading || hierResult || hierError) && (
                          <div className="bg-panel border border-info/40 rounded-lg p-4">
                            <div className="text-xs text-muted uppercase tracking-wide flex items-center">
                              CdA moyen — méthode hiérarchique (random-effects)
                              <InfoTooltip text="Méthode B : optimisation conjointe sur toutes les rides simultanément, avec un seul Crr partagé et des CdAᵢ par ride contraints à varier autour d'un μ commun (modèle random-effects, DerSimonian & Laird 1986, Gelman BDA3 ch.5). Mathématiquement plus rigoureuse — partage l'information entre rides." />
                            </div>
                            {hierLoading && (
                              <div className="text-sm text-muted mt-2 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={14} />
                                Optimisation hiérarchique en cours…
                              </div>
                            )}
                            {hierError && (
                              <div className="text-sm text-coral mt-1">Erreur : {hierError}</div>
                            )}
                            {hierResult && (
                              <div className="flex items-center gap-3 flex-wrap mt-1">
                                <div>
                                  <div className="text-3xl font-mono font-bold text-info">
                                    CdA = {hierResult.mu_cda.toFixed(3)}
                                    <span className="text-sm text-muted font-normal ml-2">
                                      IC95 [{hierResult.mu_cda_ci_low.toFixed(3)} – {hierResult.mu_cda_ci_high.toFixed(3)}]
                                    </span>
                                  </div>
                                  {aggCda !== null && Math.abs(hierResult.mu_cda - aggCda) > 0.001 && (
                                    <div className="text-xs text-muted mt-0.5">
                                      Δ vs inverse-variance : {(hierResult.mu_cda - aggCda >= 0 ? "+" : "")}{(hierResult.mu_cda - aggCda).toFixed(4)}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-auto flex gap-6 text-right">
                                  <div>
                                    <div className="text-xs text-muted">Crr partagé</div>
                                    <div className="text-xl font-mono text-info">{hierResult.crr.toFixed(4)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted">τ inter-rides</div>
                                    <div className="text-xl font-mono text-muted">±{hierResult.tau.toFixed(3)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted">Rides utilisées</div>
                                    <div className="text-xl font-mono text-muted">{hierResult.n_rides}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Position + References + Derived metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-panel border border-border rounded-lg p-4 flex justify-center">
                            <PositionSchematic cda={aggCda} label="Position moyenne" size={240} />
                          </div>
                          <div className="bg-panel border border-border rounded-lg p-4 md:col-span-2">
                            <h3 className="text-sm font-semibold mb-2">Métriques dérivées (moyenne)</h3>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-mono">
                              {[30, 35, 40, 45].map((s) => {
                                const v = s / 3.6;
                                const pAero = 0.5 * aggCda * (aggRho || 1.2) * v * v * v;
                                const pRoll = (aggCrr || 0.004) * lastMass * 9.80665 * v;
                                const pTotal = (pAero + pRoll) / 0.977;
                                return (
                                  <div key={s} className="flex justify-between border-b border-border/30 py-1">
                                    <span className="text-muted">{s} km/h</span>
                                    <span className="text-teal">{pTotal.toFixed(0)} W</span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-muted mt-2">
                              Watts pour rouler sur le plat ({lastMass} kg, pas de vent, ρ = {(aggRho || 1.2).toFixed(2)})
                            </p>
                          </div>
                        </div>

                        <ReferenceTable cda={aggCda} crr={aggCrr || 0.004} />

                        {/* Charts */}
                        {goodRides.length >= 2 && (
                          <>
                            <CdARunningAvgChart
                              rides={goodRides.map((r) => ({
                                date: r.result!.ride_date,
                                cda: r.result!.cda,
                                nrmse: (r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1),
                                fileName: r.file.name,
                              }))}
                              aggCda={aggCda}
                            />
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
                          </>
                        )}

                        {/* Ride chips */}
                        <div className="bg-panel border border-border rounded-lg p-4">
                          <h3 className="text-sm font-semibold mb-3">Sorties analysées</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {rides.map((r, i) => {
                              const isBad = r.excluded;
                              let tooltip = "";
                              let nrmseVal = 0;
                              if (r.error) {
                                tooltip = `Erreur : ${r.error}`;
                              } else if (r.result) {
                                nrmseVal = (r.result.rmse_w || 0) / Math.max(r.result.avg_power_w, 1);
                                tooltip = `${r.file.name}\nCdA ${r.result.cda.toFixed(3)} • nRMSE ${(nrmseVal*100).toFixed(0)}% • ±${r.result.rmse_w.toFixed(0)}W`;
                                if (r.result.cda_raw != null && Math.abs(r.result.cda_raw - r.result.cda) > 0.02) {
                                  tooltip += `\nCdA brut (MLE): ${r.result.cda_raw.toFixed(3)}`;
                                }
                                if ((r.result.prior_adaptive_factor ?? 1) > 1.05) {
                                  tooltip += `\nPrior renforcé ×${(r.result.prior_adaptive_factor ?? 1).toFixed(1)}`;
                                }
                                if (r.result.power_meter_display) {
                                  tooltip += `\nCapteur : ${r.result.power_meter_display}`;
                                  if (r.result.power_meter_quality === "low") {
                                    tooltip += " ⚠ mono-jambe ou calibration manquante";
                                  }
                                }
                                if (r.result.quality_status && r.result.quality_status !== "ok" && r.result.quality_reason) {
                                  tooltip += `\n\n⚠ Exclue : ${r.result.quality_reason}`;
                                }
                              }
                              return (
                              <button
                                key={i}
                                onClick={() => {
                                  if (r.result && !isBad) {
                                    setSelectedIdx(i);
                                    setViewTab("detail");
                                  }
                                }}
                                title={tooltip}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono transition ${
                                  isBad
                                    ? "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
                                    : "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:border-teal cursor-pointer"
                                }`}
                              >
                                {isBad ? "✗" : "✓"}
                                <FileText size={11} />
                                {r.file.name.length > 20 ? r.file.name.slice(0, 17) + "…" : r.file.name}
                                {r.result && !isBad && (
                                  <>
                                    <span className="opacity-70">{r.result.cda.toFixed(3)}</span>
                                    <span className="opacity-40">{(nrmseVal*100).toFixed(0)}%</span>
                                    {(r.result.prior_adaptive_factor ?? 1) > 1.05 && (
                                      <span className="opacity-70 text-warn" title="prior renforcé">⚡</span>
                                    )}
                                    {r.result.quality_status === "prior_dominated" && (
                                      <span className="opacity-70 text-warn" title="résultat dominé par le prior">ⓘ</span>
                                    )}
                                  </>
                                )}
                                {isBad && r.result && <span className="opacity-40">{r.result.cda.toFixed(3)}</span>}
                                {isBad && !r.result && <span className="opacity-40">err.</span>}
                              </button>
                              );
                            })}
                          </div>
                          <div className="flex gap-4 mt-1.5 text-[10px] text-muted">
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Retenue (cliquer → détail)
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Exclue
                            </span>
                          </div>
                          <p className="text-[10px] text-muted mt-2 leading-relaxed">
                            Exclusion : nRMSE &gt; 45%, CdA hors [{BIKE_TYPE_CONFIG[bikeType].minCda}–{BIKE_TYPE_CONFIG[bikeType].maxCda}] m²,
                            ou solveur dégénéré (tape une borne / non-identifiable). Survolez une ride exclue pour la raison exacte.
                          </p>
                        </div>
                      </div>
                    )}

                    {viewTab === "detail" && selectedResult && (
                      <div>
                        <div className="bg-panel border border-border rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm flex-wrap">
                          <FileText size={14} className="text-muted" />
                          <span className="text-muted">Détail de :</span>
                          <span className="font-mono text-teal">{rides[selectedIdx]?.file?.name}</span>
                          <div className="flex gap-1 ml-auto">
                            {rides.filter((r) => !r.excluded && r.result).map((r, j) => {
                              const realIdx = rides.indexOf(r);
                              return (
                                <button
                                  key={realIdx}
                                  onClick={() => setSelectedIdx(realIdx)}
                                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                                    realIdx === selectedIdx
                                      ? "bg-teal text-white"
                                      : "bg-panel border border-border text-muted hover:text-text"
                                  }`}
                                >
                                  {r.file.name.length > 12 ? r.file.name.slice(0, 10) + "…" : r.file.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <ResultsDashboard result={selectedResult} massKg={lastMass} />
                      </div>
                    )}
                  </>
                )}

              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
