import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Loader2, Trophy, Wind, Activity, User, AlertTriangle, X, FileText } from "lucide-react";
import { analyze, analyzeBatch } from "../api/client";
import { getCached, setCache, type CacheOpts } from "../api/cache";
import { saveToHistory } from "../api/history";
import { weightedAggregate } from "../lib/aggregate";
import type { AnalysisResult, HierarchicalAnalysisResult } from "../types";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS_BY_BIKE, CRR_PRESETS, isHardFailure, type BikeType } from "../types";
import PositionSchematic from "./PositionSchematic";
import InfoTooltip from "./InfoTooltip";
import CdAEvolutionChart from "./CdAEvolutionChart";

/* ---------- types ---------- */

interface RideResult {
  file: File;
  result?: AnalysisResult;
  status: "pending" | "loading" | "done" | "error";
  error?: string;
}

interface RiderEntry {
  id: string;
  name: string;
  mass: number;
  positionIdx: number;
  crrFixed: string;
  rides: RideResult[];
}

/* Aggregated stats for a rider with multiple rides */
interface RiderAgg {
  rider: RiderEntry;
  cda: number;
  crr: number;
  cdaLow: number;
  cdaHigh: number;
  nrmse: number;     // normalised RMSE = RMSE / avg_power (0–1)
  rmse: number;
  avgSpeed: number;
  avgPower: number;
  nRides: number;
  nPoints: number;
  nExcluded: number;
}

function emptyRider(n: number): RiderEntry {
  return {
    id: `r${Date.now()}-${n}`,
    name: `Cycliste ${n}`,
    mass: 75,
    positionIdx: 2,
    crrFixed: "0.0032",
    rides: [],
  };
}

/**
 * Weighted average of rider results, weighted by valid_points.
 * Rides with R² < 0 or RMSE > 150 W are excluded from the average —
 * their data quality is too poor to contribute meaningful signal.
 * If ALL rides are excluded, fall back to including everything so the
 * rider still appears in the comparison (with a warning via low R²).
 */
/**
 * Quality gate: exclude rides where nRMSE (= RMSE / avg_power) > 45%.
 *
 * nRMSE is variance-independent unlike R². However, the RMSE is computed
 * from power residuals even when the solver optimises altitude (Chung VE
 * or wind-inverse). A well-fit ride (R² altitude = 0.98) can still have
 * RMSE ~60W because per-second power is noisy. So the threshold must be
 * generous — we only exclude truly broken rides, not noisy-but-valid ones.
 *
 * Thresholds for display:
 *   nRMSE < 30%  → good (green)
 *   30–45%       → acceptable (white)
 *   > 45%        → excluded from average (model fundamentally doesn't fit)
 */
const MAX_NRMSE = 0.45;

function aggregate(r: RiderEntry, bikeType: BikeType = "road"): RiderAgg | null {
  const { minCda: MIN_CDA, maxCda: MAX_CDA } = BIKE_TYPE_CONFIG[bikeType];
  const done = r.rides.filter((rd) => rd.status === "done" && rd.result);
  if (done.length === 0) return null;

  // Filter to "good" rides only — using quality_status from backend gate
  // (bound_hit / non_identifiable / high_nrmse) AND legacy nRMSE/CdA bounds
  let good = done.filter((rd) => {
    const res = rd.result!;
    if (isHardFailure(res.quality_status)) return false;
    const avgP = res.avg_power_w || 1;
    const nrmse = (res.rmse_w || 0) / avgP;
    return nrmse <= MAX_NRMSE && res.cda >= MIN_CDA && res.cda <= MAX_CDA;
  });
  const nExcluded = done.length - good.length;

  // If all rides excluded, fall back to all (user sees bad R² as warning)
  if (good.length === 0) good = done;

  // Unified weighted aggregation (lib/aggregate.ts) — same formula as
  // App.tsx and IntervalsPage so the CdA displayed in Compare matches
  // everywhere else in the app.
  const agg = weightedAggregate(good.map((rd) => ({
    cda: rd.result!.cda,
    crr: rd.result!.crr,
    cdaCiLow: rd.result!.cda_ci_low,
    cdaCiHigh: rd.result!.cda_ci_high,
    avgPowerW: rd.result!.avg_power_w,
    avgRho: rd.result!.avg_rho,
    avgSpeedKmh: rd.result!.avg_speed_kmh,
    rmseW: rd.result!.rmse_w || 0,
    validPoints: rd.result!.valid_points,
  })))!;
  const meanCda = agg.cda;
  const meanCrr = agg.crr;
  const cdaLow = agg.cdaLow;
  const cdaHigh = agg.cdaHigh;
  const meanPower = agg.avgPowerW;
  const nrmse = meanPower > 0 ? agg.rmseW / meanPower : 0;
  const meanSpeed = agg.avgSpeedKmh;

  return {
    rider: r,
    cda: meanCda,
    crr: meanCrr,
    cdaLow,
    cdaHigh,
    nrmse,
    rmse: agg.rmseW,
    avgSpeed: meanSpeed,
    avgPower: meanPower,
    nRides: good.length,
    nPoints: agg.weights.reduce((a, b) => a + b, 0),
    nExcluded,
  };
}

/* ---------- main component ---------- */

export default function CompareMode({ onBack }: { onBack: () => void }) {
  const [riders, setRiders] = useState<RiderEntry[]>([emptyRider(1), emptyRider(2)]);
  const [running, setRunning] = useState(false);
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [useLocalCache, setUseLocalCache] = useState(true);
  const [hierByRider, setHierByRider] = useState<Record<string, HierarchicalAnalysisResult | null>>({});

  const updateRider = (id: string, patch: Partial<RiderEntry>) =>
    setRiders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRider = () => setRiders((rs) => [...rs, emptyRider(rs.length + 1)]);
  const removeRider = (id: string) => setRiders((rs) => rs.filter((r) => r.id !== id));

  const addFiles = (riderId: string, files: File[]) => {
    const accepted = files.filter((f) => /\.(fit|gpx|tcx)$/i.test(f.name));
    if (accepted.length === 0) return;
    setRiders((rs) =>
      rs.map((r) =>
        r.id === riderId
          ? { ...r, rides: [...r.rides, ...accepted.map((f) => ({ file: f, status: "pending" as const }))] }
          : r,
      ),
    );
  };

  const removeFile = (riderId: string, idx: number) => {
    setRiders((rs) =>
      rs.map((r) =>
        r.id === riderId ? { ...r, rides: r.rides.filter((_, i) => i !== idx) } : r,
      ),
    );
  };

  const runAll = async () => {
    setRunning(true);
    // Mark all pending rides as loading
    setRiders((rs) =>
      rs.map((r) => ({
        ...r,
        rides: r.rides.map((rd) =>
          rd.status === "pending" || rd.status === "error"
            ? { ...rd, status: "loading" as const, error: undefined }
            : rd,
        ),
      })),
    );

    // Process sequentially to avoid rate-limits
    for (const rider of riders) {
      for (let i = 0; i < rider.rides.length; i++) {
        const rd = rider.rides[i];
        if (rd.status !== "pending" && rd.status !== "loading" && rd.status !== "error") continue;
        // Update status to loading
        setRiders((rs) =>
          rs.map((r) =>
            r.id === rider.id
              ? {
                  ...r,
                  rides: r.rides.map((x, j) =>
                    j === i ? { ...x, status: "loading" as const } : x,
                  ),
                }
              : r,
          ),
        );
        try {
          const posPreset = POSITION_PRESETS_BY_BIKE[bikeType][rider.positionIdx];
          const crrVal = rider.crrFixed ? parseFloat(rider.crrFixed.replace(",", ".")) : undefined;
          const crr = crrVal && crrVal > 0 ? crrVal : undefined;
          // CompareMode is multi-ride per rider → disable prior. The aggregate
          // inverse-variance weighting handles the regularization.
          const isMulti = rider.rides.length > 1;
          const cacheOpts: CacheOpts = {
            mass_kg: rider.mass, bike_type: bikeType, crr_fixed: crr,
            cda_prior_mean: isMulti ? undefined : posPreset?.cdaPrior,
            cda_prior_sigma: isMulti ? undefined : posPreset?.cdaSigma,
            disable_prior: isMulti,
          };
          const fromCache = useLocalCache ? getCached(rd.file, cacheOpts) : null;
          const res = fromCache || await analyze({
            file: rd.file, mass_kg: rider.mass, bike_type: bikeType,
            crr_fixed: crr,
            cda_prior_mean: isMulti ? undefined : posPreset?.cdaPrior,
            cda_prior_sigma: isMulti ? undefined : posPreset?.cdaSigma,
            disable_prior: isMulti,
          });
          if (!fromCache) setCache(rd.file, res, cacheOpts);
          setRiders((rs) =>
            rs.map((r) =>
              r.id === rider.id
                ? {
                    ...r,
                    rides: r.rides.map((x, j) =>
                      j === i ? { ...x, status: "done" as const, result: res } : x,
                    ),
                  }
                : r,
            ),
          );
        } catch (e: any) {
          setRiders((rs) =>
            rs.map((r) =>
              r.id === rider.id
                ? {
                    ...r,
                    rides: r.rides.map((x, j) =>
                      j === i
                        ? { ...x, status: "error" as const, error: e.message || String(e) }
                        : x,
                    ),
                  }
                : r,
            ),
          );
        }
      }
    }
    // Hierarchical (Method B) per rider, in parallel — only when ≥ 2 rides
    const hierResults: Record<string, HierarchicalAnalysisResult | null> = {};
    await Promise.all(
      riders.map(async (rider) => {
        if (rider.rides.length < 2) {
          hierResults[rider.id] = null;
          return;
        }
        const crrVal = rider.crrFixed ? parseFloat(rider.crrFixed.replace(",", ".")) : undefined;
        const crr = crrVal && crrVal > 0 ? crrVal : undefined;
        try {
          const r = await analyzeBatch({
            files: rider.rides.map((rd) => rd.file),
            mass_kg: rider.mass,
            crr_fixed: crr,
            bike_type: bikeType,
          });
          hierResults[rider.id] = r;
        } catch {
          hierResults[rider.id] = null;
        }
      }),
    );
    setHierByRider(hierResults);

    // Save to history per rider
    for (const rider of riders) {
      const done = rider.rides.filter((rd) => rd.status === "done" && rd.result);
      const good = done.filter((rd) => {
        const res = rd.result!;
        const n = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
        const { minCda, maxCda } = BIKE_TYPE_CONFIG[bikeType];
        return n <= MAX_NRMSE && res.cda >= minCda && res.cda <= maxCda;
      });
      if (good.length > 0) {
        // Unified aggregation — same formula as the display block above.
        const aggRider = weightedAggregate(good.map((rd) => ({
          cda: rd.result!.cda,
          crr: rd.result!.crr,
          cdaCiLow: rd.result!.cda_ci_low,
          cdaCiHigh: rd.result!.cda_ci_high,
          avgPowerW: rd.result!.avg_power_w,
          avgRho: rd.result!.avg_rho,
          avgSpeedKmh: rd.result!.avg_speed_kmh,
          rmseW: rd.result!.rmse_w || 0,
          validPoints: rd.result!.valid_points,
        })))!;
        const hCda = aggRider.cda;
        const hCrr = aggRider.crr;
        const hLow: number | null = good.length >= 2 ? aggRider.cdaLow : null;
        const hHigh: number | null = good.length >= 2 ? aggRider.cdaHigh : null;
        const posP = POSITION_PRESETS_BY_BIKE[bikeType][rider.positionIdx];
        const crrVal = rider.crrFixed ? parseFloat(rider.crrFixed) : null;
        saveToHistory({
          id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          mode: "compare",
          label: `${rider.name} (${good.length} sortie${good.length > 1 ? "s" : ""})`,
          cda: hCda, cdaLow: hLow, cdaHigh: hHigh, crr: hCrr,
          rmseW: aggRider.rmseW, avgPowerW: aggRider.avgPowerW, avgRho: aggRider.avgRho,
          bikeType,
          positionLabel: posP?.label || bikeType,
          massKg: rider.mass,
          crrFixed: crrVal && crrVal > 0 ? crrVal : null,
          cdaPriorMean: posP?.cdaPrior || null,
          cdaPriorSigma: posP?.cdaSigma || null,
          maxNrmse: MAX_NRMSE,
          useCache: useLocalCache,
          disablePrior: rider.rides.length > 1,
          aggregationMethod: rider.rides.length > 1 ? "inverse_var" : "single",
          hierarchicalMu: hierResults[rider.id]?.mu_cda,
          hierarchicalTau: hierResults[rider.id]?.tau,
          nRides: good.length,
          nExcluded: done.length - good.length,
          nTotalPoints: good.reduce((a, r) => a + (r.result?.valid_points || 0), 0),
          rideCdas: good.map((r) => ({
            date: r.result!.ride_date, cda: r.result!.cda,
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
          athleteKey: `compare:${rider.name.toLowerCase().replace(/\s+/g, "_") || rider.id}`,
          athleteName: rider.name || `Rider ${rider.id}`,
        });
      }
    }

    setRunning(false);
  };

  const { minCda: minCdaBound, maxCda: maxCdaBound } = BIKE_TYPE_CONFIG[bikeType];

  const aggs = riders
    .map((r) => aggregate(r, bikeType))
    .filter((a): a is RiderAgg => a !== null);

  const canRun = riders.filter((r) => r.rides.length > 0 && r.mass > 0).length >= 2;

  // Rankings
  const bestAero = aggs.length >= 2 ? [...aggs].sort((a, b) => a.cda - b.cda)[0] : null;
  const bestRolling = aggs.length >= 2 ? [...aggs].sort((a, b) => a.crr - b.crr)[0] : null;
  const drag = (a: RiderAgg) => {
    const v = 11.11;
    return 0.5 * a.cda * 1.2 * v * v + a.crr * a.rider.mass * 9.80665;
  };
  const mostEfficient = aggs.length >= 2 ? [...aggs].sort((a, b) => drag(a) - drag(b))[0] : null;
  const bestWCda = aggs.length >= 2
    ? [...aggs].sort((a, b) => b.avgPower / b.cda - a.avgPower / a.cda)[0]
    : null;

  // Drafting warning
  let draftWarning: { drafter: string; puller: string; cdaGap: number } | null = null;
  if (aggs.length >= 2) {
    const speeds = aggs.map((a) => a.avgSpeed);
    const minS = Math.min(...speeds);
    const maxS = Math.max(...speeds);
    if (maxS > 0 && (maxS - minS) / maxS < 0.05) {
      const byCda = [...aggs].sort((a, b) => a.cda - b.cda);
      const low = byCda[0];
      const high = byCda[byCda.length - 1];
      const gap = (high.cda - low.cda) / high.cda;
      if (gap > 0.15) {
        draftWarning = { drafter: low.rider.name, puller: high.rider.name, cdaGap: gap };
      }
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted hover:text-text">
        ← Mode analyse unique
      </button>

      <div>
        <h2 className="text-xl font-bold">Comparaison multi-cyclistes</h2>
        <p className="text-sm text-muted mt-1">
          Glissez-déposez <strong>plusieurs fichiers</strong> par cycliste pour des
          résultats moyennés plus précis. Formats : .FIT, .GPX, .TCX.
        </p>
        <div className="mt-3">
          <label className="block text-xs text-muted mb-1">Type de vélo</label>
          <div className="flex gap-1 max-w-sm">
            {(Object.entries(BIKE_TYPE_CONFIG) as [BikeType, typeof BIKE_TYPE_CONFIG[BikeType]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBikeType(key as BikeType)}
                title={cfg.description}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition ${
                  bikeType === key
                    ? "bg-teal text-white font-semibold"
                    : "bg-bg border border-border text-muted hover:text-text"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            CdA attendu : {BIKE_TYPE_CONFIG[bikeType].minCda} – {BIKE_TYPE_CONFIG[bikeType].maxCda} m²
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {riders.map((r, i) => (
          <RiderRow
            key={r.id}
            rider={r}
            index={i}
            agg={aggregate(r, bikeType)}
            bikeType={bikeType}
            onUpdate={(patch) => updateRider(r.id, patch)}
            onAddFiles={(files) => addFiles(r.id, files)}
            onRemoveFile={(idx) => removeFile(r.id, idx)}
            onRemove={riders.length > 2 ? () => removeRider(r.id) : undefined}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setUseLocalCache(!useLocalCache)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            useLocalCache ? "bg-teal" : "bg-border"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            useLocalCache ? "translate-x-4" : ""
          }`} />
        </button>
        <label className="text-xs text-muted">
          Cache local {useLocalCache ? "(activé)" : "(désactivé — re-analyse tout)"}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={addRider}
          className="px-4 py-2 border border-border rounded hover:border-muted text-sm"
        >
          + Ajouter un cycliste
        </button>
        <button
          onClick={runAll}
          disabled={running || !canRun}
          className="px-5 py-2 bg-teal hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded flex items-center gap-2"
        >
          {running ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Analyse en cours…
            </>
          ) : (
            "Comparer"
          )}
        </button>
      </div>

      {aggs.length >= 2 && draftWarning && (
        <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="text-orange-400 flex-shrink-0" size={20} />
          <div className="text-sm">
            <div className="font-semibold text-orange-400">Drafting probable</div>
            <p className="mt-1">
              <strong>{draftWarning.drafter}</strong> a un CdA{" "}
              {(draftWarning.cdaGap * 100).toFixed(0)}% plus bas que{" "}
              <strong>{draftWarning.puller}</strong> à vitesse similaire.
              Probable que {draftWarning.drafter} a suivi les roues.
            </p>
          </div>
        </div>
      )}

      {aggs.length >= 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {bestAero && (
              <RankCard
                icon={<Wind className="text-teal" size={18} />}
                title="Meilleur aéro"
                tooltip="CdA le plus bas (moyenne pondérée sur toutes les sorties)."
                winner={bestAero.rider.name}
                metric={`CdA = ${bestAero.cda.toFixed(3)} m²`}
                sub={
                  bestAero.nRides > 1
                    ? `IC95 [${bestAero.cdaLow.toFixed(3)} – ${bestAero.cdaHigh.toFixed(3)}] • ${bestAero.nRides} sorties`
                    : undefined
                }
              />
            )}
            {bestRolling && (
              <RankCard
                icon={<Activity className="text-teal" size={18} />}
                title="Meilleur roulement"
                tooltip="Crr le plus bas."
                winner={bestRolling.rider.name}
                metric={`Crr = ${bestRolling.crr.toFixed(4)}`}
              />
            )}
            {bestWCda && (
              <RankCard
                icon={<Wind className="text-teal" size={18} />}
                title="Meilleur W/CdA"
                tooltip="W/CdA = puissance moyenne / CdA. Le rouleur le plus rapide sur le plat : combine fitness (watts) et aéro (CdA bas). Analogue du W/kg pour le plat."
                winner={bestWCda.rider.name}
                metric={`${(bestWCda.avgPower / bestWCda.cda).toFixed(0)} W/CdA`}
                sub={`→ ${(Math.pow(2 * bestWCda.avgPower / (bestWCda.cda * 1.2), 1/3) * 3.6).toFixed(1)} km/h théorique`}
              />
            )}
            {mostEfficient && (
              <RankCard
                icon={<Trophy className="text-teal" size={18} />}
                title="Plus efficient"
                tooltip="Force de traînée totale (aéro + roulement) à 40 km/h la plus basse."
                winner={mostEfficient.rider.name}
                metric={`${drag(mostEfficient).toFixed(1)} N @ 40 km/h`}
              />
            )}
          </div>

          <div className="bg-panel border border-border rounded-lg p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3">Tableau comparatif</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase border-b border-border">
                  <th className="text-left py-2 font-normal">Cycliste</th>
                  <th className="text-right font-normal">Sorties</th>
                  <th className="text-right font-normal">Masse</th>
                  <th className="text-right font-normal">
                    CdA
                    <InfoTooltip text="CdA moyen pondéré sur toutes les sorties retenues. Avec ≥2 sorties, l'IC95 est calculé à partir de la dispersion inter-rides (pas intra-ride) : il reflète la reproductibilité de la mesure à travers les conditions." />
                  </th>
                  <th className="text-right font-normal">Crr</th>
                  <th className="text-right font-normal">Traînée @ 40</th>
                  <th className="text-right font-normal">
                    W/CdA
                    <InfoTooltip text="Puissance moyenne / CdA = capacité à aller vite sur le plat. L'analogue aéro du W/kg pour la montagne. Plus c'est haut, plus le cycliste va vite à plat. 300 ≈ 33 km/h, 500 ≈ 39 km/h, 700 ≈ 44 km/h (plat, sans vent, ρ=1.2)." />
                  </th>
                  <th className="text-right font-normal">
                    V_plat
                    <InfoTooltip text="Vitesse théorique sur le plat sans vent, calculée depuis W/CdA : V = (2 × P / (CdA × ρ))^(1/3). Utilise ρ = 1.2 kg/m³ (niveau de la mer, 15°C)." />
                  </th>
                  <th className="text-right font-normal">
                    Qualité
                    <InfoTooltip text="nRMSE = RMSE / puissance moyenne. Mesure l'erreur relative du modèle, indépendante de la variabilité de la sortie. < 15% = excellent, 15-25% = correct, > 25% = mauvais (ride exclue de la moyenne)." />
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {aggs.map((a) => (
                  <tr key={a.rider.id} className="border-b border-border/50">
                    <td className="py-2">{a.rider.name}</td>
                    <td className="text-right">
                      {a.nRides}
                      {a.nExcluded > 0 && (
                        <span className="text-coral text-xs ml-1" title={`${a.nExcluded} sortie(s) exclue(s) (R² < 0 ou RMSE > 150W)`}>
                          (-{a.nExcluded})
                        </span>
                      )}
                    </td>
                    <td className="text-right">{a.rider.mass.toFixed(0)} kg</td>
                    <td className="text-right text-teal">
                      {a.cda.toFixed(3)}
                      {a.nRides >= 2 && (
                        <div className="text-xs text-muted font-mono">
                          [{a.cdaLow.toFixed(3)} – {a.cdaHigh.toFixed(3)}]
                        </div>
                      )}
                      {hierByRider[a.rider.id] && (
                        <div
                          className="text-[10px] text-info font-mono mt-0.5"
                          title="Méthode hiérarchique : DerSimonian–Laird (random-effects)"
                        >
                          μ={hierByRider[a.rider.id]!.mu_cda.toFixed(3)} τ=±{hierByRider[a.rider.id]!.tau.toFixed(3)}
                        </div>
                      )}
                    </td>
                    <td className="text-right text-teal">{a.crr.toFixed(4)}</td>
                    <td className="text-right">{drag(a).toFixed(1)} N</td>
                    <td className="text-right text-info">
                      {(a.avgPower / a.cda).toFixed(0)}
                    </td>
                    <td className="text-right text-info">
                      {(Math.pow(2 * a.avgPower / (a.cda * 1.2), 1/3) * 3.6).toFixed(1)} km/h
                    </td>
                    <td className="text-right">
                      <span className={
                        a.nrmse < 0.30
                          ? "text-teal"
                          : a.nrmse < 0.45
                            ? "text-text"
                            : "text-coral"
                      }>
                        {(a.nrmse * 100).toFixed(0)}%
                      </span>
                      <div className="text-xs text-muted">±{a.rmse.toFixed(0)} W</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aggs.some((a) => a.nRides > 1 || a.nExcluded > 0) && (
              <p className="text-xs text-muted mt-2">
                CdA/Crr/R²/RMSE = moyenne pondérée par le nombre de points
                valides sur l'ensemble des sorties de chaque cycliste.
                {aggs.some((a) => a.nExcluded > 0) && (
                  <span className="text-coral">
                    {" "}Sorties avec nRMSE &gt; 45% exclues de la moyenne
                    et des graphes (modèle non fiable — drafting, vent extrême, ou capteur défectueux).
                  </span>
                )}
              </p>
            )}
          </div>

          {/* CdA evolution over time */}
          <CdAEvolutionChart
            riders={riders
              .filter((r) => r.rides.some((rd) => rd.status === "done" && rd.result))
              .map((r) => ({
                name: r.name,
                points: r.rides
                  .filter((rd): rd is RideResult & { result: AnalysisResult } => {
                    if (rd.status !== "done" || !rd.result) return false;
                    const avgP = rd.result.avg_power_w || 1;
                    const nrmse = (rd.result.rmse_w || 0) / avgP;
                    return nrmse <= MAX_NRMSE && rd.result.cda >= minCdaBound && rd.result.cda <= maxCdaBound;
                  })
                  .map((rd) => ({
                    date: rd.result.ride_date,
                    cda: rd.result.cda,
                    r2: rd.result.r_squared,
                    fileName: rd.file.name,
                  }))
                  .sort((a, b) => a.date.localeCompare(b.date)),
              }))}
          />

          <div>
            <h3 className="text-sm font-semibold mb-3">Positions estimées</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {aggs.map((a) => (
                <div key={a.rider.id} className="bg-panel border border-border rounded-lg p-3">
                  <PositionSchematic cda={a.cda} label={a.rider.name} size={220} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- sub-components ---------- */

function RankCard({
  icon,
  title,
  tooltip,
  winner,
  metric,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  tooltip: string;
  winner: string;
  metric: string;
  sub?: string;
}) {
  return (
    <div className="bg-panel border border-teal rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted">
        {icon} {title}
        <InfoTooltip text={tooltip} />
      </div>
      <div className="text-lg font-semibold mt-2">{winner}</div>
      <div className="text-sm text-teal font-mono mt-1">{metric}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function RiderRow({
  rider,
  index,
  agg,
  bikeType,
  onUpdate,
  onAddFiles,
  onRemoveFile,
  onRemove,
}: {
  rider: RiderEntry;
  index: number;
  agg: RiderAgg | null;
  bikeType: BikeType;
  onUpdate: (p: Partial<RiderEntry>) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
  onRemove?: () => void;
}) {
  const { minCda: minCdaBound, maxCda: maxCdaBound } = BIKE_TYPE_CONFIG[bikeType];
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      onAddFiles(files);
    },
    [onAddFiles],
  );

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAddFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const doneCount = rider.rides.filter((r) => r.status === "done").length;
  const loadingCount = rider.rides.filter((r) => r.status === "loading").length;

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <User size={16} className="text-muted" />
        <input
          type="text"
          value={rider.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent border-none text-text font-semibold focus:outline-none"
          placeholder={`Cycliste ${index + 1}`}
        />
        <div className="flex-1" />
        {agg && (
          <span className="text-xs text-teal font-mono">
            CdA {agg.cda.toFixed(3)} ({agg.nRides} sortie{agg.nRides > 1 ? "s" : ""})
          </span>
        )}
        {loadingCount > 0 && (
          <Loader2 className="animate-spin text-info" size={14} />
        )}
        {onRemove && (
          <button onClick={onRemove} className="text-muted hover:text-coral">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Position slider per rider (road only) */}
      {bikeType === "road" && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            Position :
            <span className="text-teal font-semibold">{POSITION_PRESETS_BY_BIKE[bikeType][rider.positionIdx].label}</span>
            <span className="opacity-60">(prior ≈ {POSITION_PRESETS_BY_BIKE[bikeType][rider.positionIdx].cdaPrior})</span>
          </div>
          <input
            type="range" min={0} max={POSITION_PRESETS_BY_BIKE[bikeType].length - 1} step={1}
            value={rider.positionIdx}
            onChange={(e) => onUpdate({ positionIdx: parseInt(e.target.value) })}
            className="w-full accent-teal"
          />
          <div className="flex justify-between text-[10px] text-muted mt-0.5">
            {POSITION_PRESETS_BY_BIKE[bikeType].map((p, i) => (
              <span key={i}
                className={`cursor-pointer ${i === rider.positionIdx ? "text-teal font-semibold" : ""}`}
                onClick={() => onUpdate({ positionIdx: i })}
              >{p.label}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_150px] gap-3">
        {/* Drop zone */}
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-3 cursor-pointer transition text-center ${
              dragging ? "border-teal bg-teal/5" : "border-border hover:border-muted"
            }`}
          >
            <Upload size={16} className="mx-auto mb-1 text-muted" />
            <p className="text-xs text-muted">
              Glissez-déposez un ou plusieurs .FIT / .GPX / .TCX
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".fit,.gpx,.tcx"
              multiple
              className="hidden"
              onChange={onSelect}
            />
          </div>

          {/* File chips + legend */}
          {rider.rides.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {rider.rides.map((rd, i) => {
                // Determine if this ride would be excluded by quality gate
                const nrmse =
                  rd.status === "done" && rd.result
                    ? (rd.result.rmse_w || 0) / Math.max(rd.result.avg_power_w, 1)
                    : 0;
                const isExcluded = rd.status === "done" && rd.result && (nrmse > MAX_NRMSE || rd.result.cda < minCdaBound || rd.result.cda > maxCdaBound);
                const isBad = rd.status === "error" || isExcluded;
                let tooltip: string | undefined;
                if (rd.status === "error") {
                  tooltip = `Erreur : ${rd.error || "analyse échouée"}`;
                } else if (rd.status === "done" && rd.result) {
                  tooltip = `${rd.file.name}\nCdA ${rd.result.cda.toFixed(3)} • nRMSE ${(nrmse * 100).toFixed(0)}% • ±${rd.result.rmse_w.toFixed(0)}W`;
                  if (rd.result.cda_raw != null && Math.abs(rd.result.cda_raw - rd.result.cda) > 0.02) {
                    tooltip += `\nCdA hors prior (vent+Crr régularisés) : ${rd.result.cda_raw.toFixed(3)}`;
                  }
                  if ((rd.result.prior_adaptive_factor ?? 1) > 1.05) {
                    tooltip += `\nPrior renforcé ×${(rd.result.prior_adaptive_factor ?? 1).toFixed(1)}`;
                  }
                  if (rd.result.power_meter_display) {
                    tooltip += `\nCapteur : ${rd.result.power_meter_display}`;
                    if (rd.result.power_meter_quality === "low") {
                      tooltip += " ⚠ mono-jambe ou calibration manquante";
                    }
                  }
                  if (rd.result.quality_status && rd.result.quality_status !== "ok" && rd.result.quality_reason) {
                    tooltip += `\n\n⚠ Exclue : ${rd.result.quality_reason}`;
                  }
                }
                return (
                <span
                  key={i}
                  title={tooltip}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono ${
                    isBad
                      ? "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
                      : rd.status === "done"
                        ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800"
                        : rd.status === "loading"
                          ? "bg-blue-900/30 text-blue-400 border border-blue-800"
                          : "bg-bg text-muted border border-border"
                  }`}
                >
                  {rd.status === "done" && !isBad && <span>✓</span>}
                  {isBad && <span>✗</span>}
                  {rd.status === "loading" && <Loader2 className="animate-spin text-blue-400" size={10} />}
                  <FileText size={11} />
                  {rd.file.name.length > 25
                    ? rd.file.name.slice(0, 22) + "…"
                    : rd.file.name}
                  {rd.status === "done" && rd.result && !isBad && (
                    <>
                      <span className="opacity-70">{rd.result.cda.toFixed(3)}</span>
                      <span className="opacity-40">{(nrmse * 100).toFixed(0)}%</span>
                      {(rd.result.prior_adaptive_factor ?? 1) > 2.0 ? (
                        <span className="opacity-80 text-coral" title={`prior très fortement renforcé ×${(rd.result.prior_adaptive_factor ?? 1).toFixed(1)} — données peu informatives`}>⚡⚡</span>
                      ) : (rd.result.prior_adaptive_factor ?? 1) > 1.05 && (
                        <span className="opacity-70 text-warn" title="prior renforcé">⚡</span>
                      )}
                      {rd.result.quality_status === "prior_dominated" && (
                        <span className="opacity-70 text-warn" title="résultat dominé par le prior">ⓘ</span>
                      )}
                    </>
                  )}
                  {isBad && rd.result && <span className="opacity-40">{rd.result.cda.toFixed(3)}</span>}
                  {isBad && !rd.result && <span className="opacity-40">err.</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                    className="hover:text-coral"
                  >
                    <X size={11} />
                  </button>
                </span>
                );
              })}
              {/* Legend */}
              {rider.rides.some((r) => r.status === "done") && (
                <div className="w-full flex gap-4 mt-1.5 text-[10px] text-muted">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> ✓ Retenue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> ✗ Exclue (erreur ou nRMSE &gt; 45%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> En cours
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mass input */}
        <div>
          <label className="block text-xs text-muted mb-1">Masse (kg)</label>
          <input
            type="number"
            value={rider.mass}
            onChange={(e) => onUpdate({ mass: parseFloat(e.target.value) || 0 })}
            className="w-full bg-bg border border-border rounded px-2 py-1 font-mono text-sm"
            step={0.1}
            min={30}
            max={200}
          />
        </div>

        {/* Crr dropdown */}
        <div>
          <label className="block text-xs text-muted mb-1">Pneus (Crr)</label>
          <select
            value={rider.crrFixed}
            onChange={(e) => onUpdate({ crrFixed: e.target.value })}
            className={`w-full bg-bg border rounded px-2 py-1 font-mono text-xs ${
              !rider.crrFixed ? "border-orange-500/50" : "border-border"
            }`}
          >
            {CRR_PRESETS.map((p) => (
              <option key={p.crr} value={p.crr === 0 ? "" : String(p.crr)}>
                {p.crr === 0 ? "Auto" : `${p.crr.toFixed(4)}`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
