import { useEffect, useState } from "react";
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
import { BIKE_TYPE_CONFIG, POSITION_PRESETS_BY_BIKE, isHardFailure, type BikeType } from "./types";
import { Wind, Users, User, FileText, Loader2, BookOpen, Link2, Clock } from "lucide-react";
import { saveToHistory, type HistoryEntry } from "./api/history";
import { weightedAggregate, type AggregationInput } from "./lib/aggregate";
import { getActiveProfile, type ProfileSettings } from "./api/profiles";
import HistoryPage from "./pages/HistoryPage";
import LandingPage from "./pages/LandingPage";
import AboutPage from "./pages/AboutPage";
import { Footer } from "./components/layout/Footer";
import InfoTooltip from "./components/InfoTooltip";
import { NavTabs } from "./components/ui";
import { AnimatePresence, motion } from "framer-motion";
import { Github } from "lucide-react";
import CdAEvolutionChart from "./components/CdAEvolutionChart";
import CdARunningAvgChart from "./components/CdARunningAvgChart";
import CdATotem from "./components/CdATotem";
import TabSwitcher from "./components/TabSwitcher";
import ReferenceTable from "./components/ReferenceTable";
import PositionSchematic from "./components/PositionSchematic";

type Mode = "home" | "single" | "compare" | "intervals" | "blog" | "history" | "about";

const DEFAULT_MAX_NRMSE = 0.45;

interface RideAnalysis {
  file: File;
  result?: AnalysisResult;
  error?: string;
  excluded: boolean;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("home");
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
  const [lastPositionIdx, setLastPositionIdx] = useState<number | undefined>(undefined);
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, blogSlug]);

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
    setLastPositionIdx(opts.positionIdx);
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
        const qBad = isHardFailure(fromCache.quality_status);
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
          const qBad = isHardFailure(res.quality_status);
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
      // Use the unified weightedAggregate helper — guarantees the CdA
      // saved to history matches what the user sees on screen (same
      // formula used below for `aggCda`). Previously the save path used
      // w = valid_points × quality while the display path used w =
      // (1/σ²) × quality, so the two CdAs differed by up to 0.01 m².
      const hAggInput: AggregationInput[] = goodForHistory.map((r) => ({
        cda: r.result!.cda,
        crr: r.result!.crr,
        cdaCiLow: r.result!.cda_ci_low,
        cdaCiHigh: r.result!.cda_ci_high,
        avgPowerW: r.result!.avg_power_w,
        avgRho: r.result!.avg_rho,
        avgSpeedKmh: r.result!.avg_speed_kmh,
        rmseW: r.result!.rmse_w || 0,
        validPoints: r.result!.valid_points,
      }));
      const hAgg = weightedAggregate(hAggInput);
      const hCda = hAgg?.cda ?? 0;
      const hCrr = hAgg?.crr ?? 0;
      const hLow: number | null = goodForHistory.length >= 2 && hAgg ? hAgg.cdaLow : null;
      const hHigh: number | null = goodForHistory.length >= 2 && hAgg ? hAgg.cdaHigh : null;
      const sRmseAvg = hAgg?.rmseW ?? 0;
      const sPowerAvg = hAgg?.avgPowerW ?? 0;
      const sRhoAvg = hAgg?.avgRho ?? 0;
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
        rmseW: sRmseAvg, avgPowerW: sPowerAvg, avgRho: sRhoAvg,
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
          biasRatio: r.result!.power_bias_ratio ?? undefined,
          powerMeter: r.result!.power_meter_display ?? undefined,
          chungCda: r.result!.chung_cda ?? undefined,
          solverCrossCheckDelta: r.result!.solver_cross_check_delta ?? undefined,
          solverConfidence: r.result!.solver_confidence,
          qualityStatus: r.result!.quality_status,
          cdaRaw: r.result!.cda_raw ?? undefined,
          qualityReason: r.result!.quality_reason ?? undefined,
          solverMethod: r.result!.solver_method ?? undefined,
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

  // Weighted aggregation across good rides — single source of truth in
  // lib/aggregate.ts. Same formula as the save-to-history path above, so
  // what the user sees is literally what we persist.
  let aggCda: number | null = null;
  let aggCrr: number | null = null;
  let aggCdaLow: number | null = null;
  let aggCdaHigh: number | null = null;
  let aggPower: number | null = null;
  let aggRho: number | null = null;
  let aggRmse: number | null = null;
  if (goodRides.length >= 1) {
    const agg = weightedAggregate(
      goodRides.map((r) => ({
        cda: r.result!.cda,
        crr: r.result!.crr,
        cdaCiLow: r.result!.cda_ci_low,
        cdaCiHigh: r.result!.cda_ci_high,
        avgPowerW: r.result!.avg_power_w,
        avgRho: r.result!.avg_rho,
        avgSpeedKmh: r.result!.avg_speed_kmh,
        rmseW: r.result!.rmse_w || 0,
        validPoints: r.result!.valid_points,
      })),
    );
    if (agg) {
      aggCda = agg.cda;
      aggCrr = agg.crr;
      aggRmse = agg.rmseW;
      aggPower = agg.avgPowerW;
      aggRho = agg.avgRho;
      if (goodRides.length >= 2) {
        aggCdaLow = agg.cdaLow;
        aggCdaHigh = agg.cdaHigh;
      }
    }
  }

  const selectedResult = rides[selectedIdx]?.result || null;

  // Helper that resets ride state when switching modes — avoids
  // showing stale results from a previous analysis when returning
  // to /analyze from another tab.
  const changeMode = (v: Mode) => {
    setMode(v);
    if (v === "single" || v === "compare") {
      setRides([]);
      setError(null);
    }
    if (v === "blog") setBlogSlug(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          {/* Brand — clickable, goes home */}
          <button
            onClick={() => changeMode("home")}
            className="inline-flex items-center gap-2 text-text font-semibold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
            aria-label="Go to AeroProfile home"
          >
            <Wind size={18} className="text-primary" aria-hidden />
            <span className="text-base">AeroProfile</span>
          </button>

          {/* Primary nav — only shown when NOT on the home landing so
              the landing page itself reads as a single continuous
              narrative rather than a dashboard with a top bar. */}
          {mode !== "home" && (
            <NavTabs<Mode>
              ariaLabel="Main navigation"
              layoutId="app-nav"
              iconOnlyOnMobile
              className="ml-2"
              value={(["single", "compare"].includes(mode) ? "analyze" : mode) as Mode}
              onChange={(v) => {
                // The "analyze" virtual value maps onto "single".
                if ((v as string) === "analyze") changeMode("single");
                else changeMode(v);
              }}
              items={[
                { value: "analyze" as Mode, label: "Analyze", icon: <User size={14} aria-hidden /> },
                { value: "intervals", label: "Intervals", icon: <Link2 size={14} aria-hidden /> },
                { value: "blog", label: "Methods", icon: <BookOpen size={14} aria-hidden /> },
                { value: "about", label: "About", icon: <User size={14} aria-hidden /> },
              ]}
            />
          )}

          <div className="flex-1" />

          {/* Utility icons: history + github. History is a personal
              archive (localStorage), not a primary feature — it lives
              as a discreet icon in the top-right. */}
          <button
            onClick={() => changeMode("history")}
            aria-label="History"
            title="History"
            className="p-2 rounded text-muted hover:text-text hover:bg-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Clock size={16} aria-hidden />
          </button>
          <a
            href="https://github.com/loic-123/aeroprofile"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            title="GitHub"
            className="p-2 rounded text-muted hover:text-text hover:bg-panel transition-colors"
          >
            <Github size={16} aria-hidden />
          </a>

          {/* Primary CTA on the landing — pushes users directly into
              the analyze flow without making them hunt for it. */}
          {mode === "home" && (
            <button
              onClick={() => changeMode("single")}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-fg text-sm font-medium transition-colors duration-base hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Analyze
            </button>
          )}
        </div>
      </header>

      <main className={mode === "home" ? "flex-1" : "flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
        {mode === "home" ? (
          <LandingPage
            onGotoAnalyze={() => changeMode("single")}
            onGotoMethodsIndex={() => {
              setBlogSlug(null);
              setMode("blog");
            }}
            onGotoArticle={(slug) => {
              setBlogSlug(slug);
              setMode("blog");
            }}
            onGotoAbout={() => changeMode("about")}
          />
        ) : mode === "about" ? (
          <AboutPage
            onGotoHome={() => changeMode("home")}
            onGotoAnalyze={() => changeMode("single")}
            onGotoMethods={() => {
              setBlogSlug(null);
              setMode("blog");
            }}
          />
        ) : mode === "history" ? (
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
                  <ResultsDashboard result={selectedResult} massKg={lastMass} bikeType={bikeType} positionIdx={lastPositionIdx} />
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

                        {/* Méthode hiérarchique (DerSimonian–Laird) banner — for comparison */}
                        {(hierLoading || hierResult || hierError) && (
                          <div className="bg-panel border border-info/40 rounded-lg p-4">
                            <div className="text-xs text-muted uppercase tracking-wide flex items-center">
                              CdA moyen — méthode hiérarchique (DerSimonian–Laird)
                              <InfoTooltip text="Méta-analyse à effets aléatoires : chaque ride contribue son CdA_i avec son incertitude σ_i (Hessienne du fit Chung VE). L'estimateur DerSimonian–Laird agrège ensuite τ² (variance inter-rides), puis combine les CdA_i avec les poids w_i = 1/(σ_i² + τ²). Réf. DerSimonian & Laird (Controlled Clinical Trials, 1986)." />
                            </div>
                            {hierLoading && (
                              <div className="text-sm text-muted mt-2 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={14} />
                                Optimisation hiérarchique en cours…
                              </div>
                            )}
                            {hierError && (
                              hierError.includes("au moins 10 sorties") ? (
                                <div className="text-sm text-muted mt-1 flex items-start gap-2">
                                  <span className="text-info mt-0.5">ⓘ</span>
                                  <span>{hierError}</span>
                                </div>
                              ) : (
                                <div className="text-sm text-coral mt-1">Erreur : {hierError}</div>
                              )
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
                                  tooltip += `\nCdA hors prior (vent+Crr régularisés) : ${r.result.cda_raw.toFixed(3)}`;
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
                                    {(r.result.prior_adaptive_factor ?? 1) > 2.0 ? (
                                      <span className="opacity-80 text-coral" title={`prior très fortement renforcé ×${(r.result.prior_adaptive_factor ?? 1).toFixed(1)} — données peu informatives`}>⚡⚡</span>
                                    ) : (r.result.prior_adaptive_factor ?? 1) > 1.05 && (
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
                        <ResultsDashboard result={selectedResult} massKg={lastMass} bikeType={bikeType} positionIdx={lastPositionIdx} />
                      </div>
                    )}
                  </>
                )}

              </>
            )}
          </>
        )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer
        onGotoMethods={() => {
          setBlogSlug(null);
          setMode("blog");
        }}
        onGotoAbout={() => changeMode("about")}
      />
    </div>
  );
}
