import { useState } from "react";
import { Upload, Trash2, Loader2, Trophy, Wind, Activity, User } from "lucide-react";
import { analyze } from "../api/client";
import type { AnalysisResult } from "../types";
import PositionSchematic from "./PositionSchematic";
import InfoTooltip from "./InfoTooltip";

interface RiderEntry {
  id: string;
  name: string;
  file: File | null;
  mass: number;
  status: "idle" | "loading" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
}

function emptyRider(n: number): RiderEntry {
  return {
    id: `r${Date.now()}-${n}`,
    name: `Cycliste ${n}`,
    file: null,
    mass: 75,
    status: "idle",
  };
}

export default function CompareMode({ onBack }: { onBack: () => void }) {
  const [riders, setRiders] = useState<RiderEntry[]>([emptyRider(1), emptyRider(2)]);

  const update = (id: string, patch: Partial<RiderEntry>) =>
    setRiders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const add = () => setRiders((rs) => [...rs, emptyRider(rs.length + 1)]);
  const remove = (id: string) => setRiders((rs) => rs.filter((r) => r.id !== id));

  const runAll = async () => {
    const ready = riders.filter((r) => r.file && r.mass > 0);
    if (ready.length < 2) return;
    await Promise.all(
      ready.map(async (r) => {
        update(r.id, { status: "loading", error: undefined });
        try {
          const res = await analyze({ file: r.file!, mass_kg: r.mass });
          update(r.id, { status: "done", result: res });
        } catch (e: any) {
          update(r.id, { status: "error", error: e.message || String(e) });
        }
      }),
    );
  };

  const done = riders.filter((r) => r.status === "done" && r.result);
  const running = riders.some((r) => r.status === "loading");

  // Rankings
  const bestAero = [...done].sort((a, b) => a.result!.cda - b.result!.cda)[0];
  const bestRolling = [...done].sort((a, b) => a.result!.crr - b.result!.crr)[0];
  // Composite efficiency score: lower CdA + lower Crr at a reference speed 40 km/h, 80 kg
  const drag = (r: RiderEntry) => {
    const v = 11.11; // 40 km/h in m/s
    return 0.5 * r.result!.cda * 1.2 * v * v + r.result!.crr * r.mass * 9.80665;
  };
  const mostEfficient = [...done].sort((a, b) => drag(a) - drag(b))[0];

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-text"
      >
        ← Mode analyse unique
      </button>

      <div>
        <h2 className="text-xl font-bold">Comparaison multi-cyclistes</h2>
        <p className="text-sm text-muted mt-1">
          Ajoutez une sortie par cycliste (formats différents acceptés). AeroProfile
          analyse chaque fichier séparément et produit un classement.
        </p>
      </div>

      <div className="space-y-3">
        {riders.map((r, i) => (
          <RiderRow
            key={r.id}
            rider={r}
            index={i}
            onUpdate={(patch) => update(r.id, patch)}
            onRemove={riders.length > 2 ? () => remove(r.id) : undefined}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={add}
          className="px-4 py-2 border border-border rounded hover:border-muted text-sm"
        >
          + Ajouter un cycliste
        </button>
        <button
          onClick={runAll}
          disabled={
            running ||
            riders.filter((r) => r.file && r.mass > 0).length < 2
          }
          className="px-5 py-2 bg-teal hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded flex items-center gap-2"
        >
          {running ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Analyse…
            </>
          ) : (
            "Comparer"
          )}
        </button>
      </div>

      {done.length >= 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RankCard
              icon={<Wind className="text-teal" size={18} />}
              title="Meilleur aéro"
              tooltip="Cycliste avec le CdA le plus bas — celui qui offre le moins de résistance à l'air."
              winner={bestAero!}
              metric={`CdA = ${bestAero!.result!.cda.toFixed(3)} m²`}
            />
            <RankCard
              icon={<Activity className="text-teal" size={18} />}
              title="Meilleur rendement roulement"
              tooltip="Cycliste avec le Crr le plus bas — pneus/revêtement offrant le moins de résistance au roulement."
              winner={bestRolling!}
              metric={`Crr = ${bestRolling!.result!.crr.toFixed(4)}`}
            />
            <RankCard
              icon={<Trophy className="text-teal" size={18} />}
              title="Ensemble le plus efficient"
              tooltip="Force de traînée totale (aéro + roulement) estimée à 40 km/h sur le plat, avec le poids saisi. Plus c'est bas, moins il faut de watts pour rouler vite."
              winner={mostEfficient!}
              metric={`${drag(mostEfficient!).toFixed(1)} N @ 40 km/h`}
            />
          </div>

          <div className="bg-panel border border-border rounded-lg p-4 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3">Tableau comparatif</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase border-b border-border">
                  <th className="text-left py-2 font-normal">Cycliste</th>
                  <th className="text-right font-normal">Masse</th>
                  <th className="text-right font-normal">CdA</th>
                  <th className="text-right font-normal">Crr</th>
                  <th className="text-right font-normal">
                    Traînée @ 40 km/h
                    <InfoTooltip text="Force totale (aéro+roulement) en Newtons à 40 km/h sur le plat, avec la masse saisie." />
                  </th>
                  <th className="text-right font-normal">
                    W/kg
                    <InfoTooltip text="Puissance moyenne divisée par la masse. Indicateur d'intensité/forme, pas d'aéro." />
                  </th>
                  <th className="text-right font-normal">R²</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {done.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2">{r.name}</td>
                    <td className="text-right">{r.mass.toFixed(1)} kg</td>
                    <td className="text-right text-teal">
                      {r.result!.cda.toFixed(3)}
                    </td>
                    <td className="text-right text-teal">
                      {r.result!.crr.toFixed(4)}
                    </td>
                    <td className="text-right">{drag(r).toFixed(1)} N</td>
                    <td className="text-right">
                      {(r.result!.avg_power_w / r.mass).toFixed(2)}
                    </td>
                    <td
                      className={`text-right ${
                        r.result!.r_squared < 0.3 ? "text-coral" : ""
                      }`}
                    >
                      {r.result!.r_squared.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Positions estimées</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {done.map((r) => (
                <div key={r.id} className="bg-panel border border-border rounded-lg p-3">
                  <PositionSchematic
                    cda={r.result!.cda}
                    label={r.name}
                    size={220}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RankCard({
  icon,
  title,
  tooltip,
  winner,
  metric,
}: {
  icon: React.ReactNode;
  title: string;
  tooltip: string;
  winner: RiderEntry;
  metric: string;
}) {
  return (
    <div className="bg-panel border border-teal rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted">
        {icon} {title}
        <InfoTooltip text={tooltip} />
      </div>
      <div className="text-lg font-semibold mt-2">{winner.name}</div>
      <div className="text-sm text-teal font-mono mt-1">{metric}</div>
    </div>
  );
}

function RiderRow({
  rider,
  index,
  onUpdate,
  onRemove,
}: {
  rider: RiderEntry;
  index: number;
  onUpdate: (p: Partial<RiderEntry>) => void;
  onRemove?: () => void;
}) {
  const format = rider.file
    ? rider.file.name.split(".").pop()?.toUpperCase()
    : null;
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
        {onRemove && (
          <button onClick={onRemove} className="text-muted hover:text-coral">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px] gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".fit,.gpx,.tcx"
            className="hidden"
            onChange={(e) => onUpdate({ file: e.target.files?.[0] || null })}
          />
          <div className="border border-dashed border-border rounded px-3 py-2 hover:border-muted flex items-center gap-2 text-sm">
            <Upload size={14} className="text-muted" />
            {rider.file ? (
              <span className="truncate font-mono text-xs">
                {rider.file.name}{" "}
                <span className="text-teal">({format})</span>
              </span>
            ) : (
              <span className="text-muted">
                Déposez un fichier .FIT / .GPX / .TCX
              </span>
            )}
          </div>
        </label>
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
        <div>
          <label className="block text-xs text-muted mb-1">Statut</label>
          <div className="text-sm h-[30px] flex items-center">
            {rider.status === "loading" && (
              <span className="flex items-center gap-1 text-info">
                <Loader2 className="animate-spin" size={14} /> Analyse
              </span>
            )}
            {rider.status === "done" && (
              <span className="text-teal">
                CdA {rider.result!.cda.toFixed(3)}
              </span>
            )}
            {rider.status === "error" && (
              <span className="text-coral text-xs">{rider.error}</span>
            )}
            {rider.status === "idle" && <span className="text-muted">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
