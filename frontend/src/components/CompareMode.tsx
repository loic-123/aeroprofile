import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Loader2, Trophy, Wind, Activity, User, AlertTriangle, X, FileText } from "lucide-react";
import { analyze } from "../api/client";
import type { AnalysisResult } from "../types";
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
 * Quality gate: exclude rides where nRMSE (= RMSE / avg_power) > 60%.
 *
 * nRMSE is variance-independent unlike R². However, the RMSE is computed
 * from power residuals even when the solver optimises altitude (Chung VE
 * or wind-inverse). A well-fit ride (R² altitude = 0.98) can still have
 * RMSE ~60W because per-second power is noisy. So the threshold must be
 * generous — we only exclude truly broken rides, not noisy-but-valid ones.
 *
 * Thresholds for display:
 *   nRMSE < 30%  → good (green)
 *   30–60%       → acceptable (white)
 *   > 60%        → excluded from average (model fundamentally doesn't fit)
 */
const MAX_NRMSE = 0.60;

function aggregate(r: RiderEntry): RiderAgg | null {
  const done = r.rides.filter((rd) => rd.status === "done" && rd.result);
  if (done.length === 0) return null;

  // Filter to "good" rides only — using nRMSE (= RMSE / avg_power)
  let good = done.filter((rd) => {
    const res = rd.result!;
    const avgP = res.avg_power_w || 1;
    const nrmse = (res.rmse_w || 0) / avgP;
    return nrmse <= MAX_NRMSE;
  });
  const nExcluded = done.length - good.length;

  // If all rides excluded, fall back to all (user sees bad R² as warning)
  if (good.length === 0) good = done;

  let totalW = 0;
  let sumCda = 0, sumCrr = 0, sumRmse = 0, sumSpeed = 0, sumPower = 0;
  for (const rd of good) {
    const res = rd.result!;
    const w = Math.max(res.valid_points, 1);
    totalW += w;
    sumCda += res.cda * w;
    sumCrr += res.crr * w;
    sumRmse += (res.rmse_w || 0) * w;
    sumSpeed += res.avg_speed_kmh * w;
    sumPower += res.avg_power_w * w;
  }
  const meanCda = sumCda / totalW;
  const meanCrr = sumCrr / totalW;

  // IC95 from inter-ride variance: treat each ride's CdA as an independent
  // estimate, compute the standard error of the weighted mean, then ±1.96·SE.
  // With only 1 ride, fall back to the per-ride CI if available.
  let cdaLow = meanCda;
  let cdaHigh = meanCda;
  if (good.length >= 2) {
    const cdas = good.map((rd) => rd.result!.cda);
    const weights = good.map((rd) => Math.max(rd.result!.valid_points, 1));
    const wSum = weights.reduce((a, b) => a + b, 0);
    // Weighted variance
    let wVar = 0;
    for (let i = 0; i < cdas.length; i++) {
      wVar += weights[i] * (cdas[i] - meanCda) ** 2;
    }
    wVar /= wSum;
    const se = Math.sqrt(wVar / good.length);
    cdaLow = meanCda - 1.96 * se;
    cdaHigh = meanCda + 1.96 * se;
  } else if (good.length === 1) {
    const res = good[0].result!;
    if (res.cda_ci_low && res.cda_ci_high && res.cda_ci_low > 0) {
      cdaLow = res.cda_ci_low;
      cdaHigh = res.cda_ci_high;
    }
  }

  const meanRmse = sumRmse / totalW;
  const meanPower = sumPower / totalW;
  const nrmse = meanPower > 0 ? meanRmse / meanPower : 0;

  return {
    rider: r,
    cda: meanCda,
    crr: meanCrr,
    cdaLow,
    cdaHigh,
    nrmse,
    rmse: meanRmse,
    avgSpeed: sumSpeed / totalW,
    avgPower: meanPower,
    nRides: good.length,
    nPoints: totalW,
    nExcluded,
  };
}

/* ---------- main component ---------- */

export default function CompareMode({ onBack }: { onBack: () => void }) {
  const [riders, setRiders] = useState<RiderEntry[]>([emptyRider(1), emptyRider(2)]);
  const [running, setRunning] = useState(false);

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
          const res = await analyze({ file: rd.file, mass_kg: rider.mass });
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
    setRunning(false);
  };

  const aggs = riders
    .map((r) => aggregate(r))
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
      </div>

      <div className="space-y-3">
        {riders.map((r, i) => (
          <RiderRow
            key={r.id}
            rider={r}
            index={i}
            agg={aggregate(r)}
            onUpdate={(patch) => updateRider(r.id, patch)}
            onAddFiles={(files) => addFiles(r.id, files)}
            onRemoveFile={(idx) => removeFile(r.id, idx)}
            onRemove={riders.length > 2 ? () => removeRider(r.id) : undefined}
          />
        ))}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    </td>
                    <td className="text-right text-teal">{a.crr.toFixed(4)}</td>
                    <td className="text-right">{drag(a).toFixed(1)} N</td>
                    <td className="text-right">
                      <span className={
                        a.nrmse < 0.30
                          ? "text-teal"
                          : a.nrmse < 0.60
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
                    {" "}Sorties avec nRMSE &gt; 60% exclues de la moyenne
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
                    return nrmse <= MAX_NRMSE;
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
  onUpdate,
  onAddFiles,
  onRemoveFile,
  onRemove,
}: {
  rider: RiderEntry;
  index: number;
  agg: RiderAgg | null;
  onUpdate: (p: Partial<RiderEntry>) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
  onRemove?: () => void;
}) {
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
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

          {/* File chips */}
          {rider.rides.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {rider.rides.map((rd, i) => {
                // Determine if this ride would be excluded by quality gate
                const isExcluded =
                  rd.status === "done" &&
                  rd.result &&
                  (rd.result.rmse_w || 0) / Math.max(rd.result.avg_power_w, 1) > MAX_NRMSE;
                return (
                <span
                  key={i}
                  title={
                    isExcluded
                      ? `Exclue de la moyenne (nRMSE ${((rd.result!.rmse_w / Math.max(rd.result!.avg_power_w, 1)) * 100).toFixed(0)}% > 60%)`
                      : undefined
                  }
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono ${
                    rd.status === "error"
                      ? "bg-coral/10 text-coral"
                      : isExcluded
                        ? "bg-coral/10 text-coral line-through opacity-60"
                        : rd.status === "done"
                          ? "bg-teal/10 text-teal"
                          : rd.status === "loading"
                            ? "bg-info/10 text-info"
                            : "bg-bg text-muted"
                  }`}
                >
                  <FileText size={11} />
                  {rd.file.name.length > 25
                    ? rd.file.name.slice(0, 22) + "…"
                    : rd.file.name}
                  {rd.status === "done" && rd.result && (
                    <span className="opacity-60">
                      CdA {rd.result.cda.toFixed(3)}
                    </span>
                  )}
                  {rd.status === "loading" && (
                    <Loader2 className="animate-spin" size={10} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                    className="hover:text-coral"
                  >
                    <X size={11} />
                  </button>
                </span>
                );
              })}
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
      </div>
    </div>
  );
}
