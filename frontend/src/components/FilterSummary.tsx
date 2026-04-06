/**
 * Visual breakdown of how many samples were excluded by each filter.
 * Horizontal bars sorted by count, with percentages.
 */

import type { AnalysisResult } from "../types";
import InfoTooltip from "./InfoTooltip";

const FILTER_LABELS: Record<string, string> = {
  filter_stopped: "Arrêt / très lent",
  filter_low_speed: "Vitesse trop basse (< 3 m/s)",
  filter_no_power: "Puissance trop faible (< 50 W)",
  filter_braking: "Freinage (décel > 0.3 m/s²)",
  filter_hard_accel: "Accélération forte (> 0.3 m/s²)",
  filter_steep_climb: "Montée raide (> 8%)",
  filter_descent: "Descente raide (< -8%)",
  filter_sharp_turn: "Virage serré (yaw > 10°/s)",
  filter_negative_v_air: "V_air négatif (vent arrière > vitesse)",
  filter_gps_jump: "Saut GPS (> 50 m entre 2 pts)",
  filter_power_spike: "Spike de puissance (> 3×NP)",
  filter_unsteady: "Vitesse instable (CV > 15%)",
};

export default function FilterSummary({ result }: { result: AnalysisResult }) {
  const entries = Object.entries(result.filter_summary)
    .map(([key, count]) => ({
      key,
      label: FILTER_LABELS[key] || key.replace("filter_", ""),
      count: count as number,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = result.total_points;
  const valid = result.valid_points;
  const excluded = total - valid;
  const pctValid = total > 0 ? ((valid / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        Filtrage des données
        <InfoTooltip text="Chaque filtre exclut les échantillons où le modèle physique ne s'applique pas (freinage, virages, puissance nulle, etc.). Le solveur ne travaille que sur les points 'valides'. Plus il y a de points valides, plus l'estimation est robuste." />
      </h3>
      <p className="text-xs text-muted mb-3">
        <span className="text-teal font-mono">{valid.toLocaleString()}</span> points
        utilisés sur{" "}
        <span className="font-mono">{total.toLocaleString()}</span> ({pctValid}%)
        — <span className="font-mono">{excluded.toLocaleString()}</span> exclus
      </p>

      <div className="space-y-1.5">
        {entries.map((e) => {
          const pct = total > 0 ? (e.count / total) * 100 : 0;
          return (
            <div key={e.key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted">{e.label}</span>
                <span className="font-mono text-muted">
                  {e.count.toLocaleString()} ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-coral/60 rounded-full"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
