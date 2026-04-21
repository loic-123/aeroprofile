/**
 * Visual breakdown of how many samples were excluded by each filter.
 * Horizontal bars sorted by count, with percentages.
 */

import { useTranslation, Trans } from "react-i18next";
import type { AnalysisResult } from "../types";
import InfoTooltip from "./InfoTooltip";

const FILTER_KEY_MAP: Record<string, string> = {
  filter_stopped: "stopped",
  filter_low_speed: "lowSpeed",
  filter_no_power: "noPower",
  filter_braking: "braking",
  filter_hard_accel: "hardAccel",
  filter_steep_climb: "steepClimb",
  filter_descent: "descent",
  filter_sharp_turn: "sharpTurn",
  filter_negative_v_air: "negativeVAir",
  filter_gps_jump: "gpsJump",
  filter_power_spike: "powerSpike",
  filter_unsteady: "unsteady",
  filter_drafting: "drafting",
  filter_ve_drift: "veDrift",
};

export default function FilterSummary({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const entries = Object.entries(result.filter_summary)
    .map(([key, count]) => ({
      key,
      label: FILTER_KEY_MAP[key] ? t(`filters.labels.${FILTER_KEY_MAP[key]}`) : key.replace("filter_", ""),
      count: count as number,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = result.total_points;
  const valid = result.valid_points;
  const excluded = total - valid;
  const retention = total > 0 ? valid / total : 0;
  const pctValid = (retention * 100).toFixed(1);

  // Retention tier aligned with the `insufficient_data` gate threshold
  // (25%). Below 25% the backend marks the ride as `insufficient_data`;
  // the 60% cutoff comes from empirical observation of clean rides.
  const tier = retention >= 0.60 ? "good" : retention >= 0.25 ? "warn" : "bad";
  const tierColor = tier === "good" ? "text-teal" : tier === "warn" ? "text-warn" : "text-coral";
  const tierLabel = tier === "good" ? t("filters.tierGood") : tier === "warn" ? t("filters.tierModerate") : t("filters.tierInsufficient");

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        {t("filters.title")}
        <InfoTooltip text="Chaque filtre exclut les échantillons où le modèle physique ne s'applique pas (freinage, virages, puissance nulle, etc.). Le solveur ne travaille que sur les points 'valides'. >60% = bon, 25-60% = modéré (interpréter avec prudence), <25% = ride probablement trop filtrée pour être représentative." />
        <span
          className={`ml-auto text-xs font-mono px-2 py-0.5 rounded border border-current/30 ${tierColor}`}
          title={t("filters.retentionTitle")}
        >
          {pctValid}% ({tierLabel})
        </span>
      </h3>
      <p className="text-xs text-muted mb-3">
        <Trans
          i18nKey="filters.usedOutOf"
          values={{ valid: valid.toLocaleString(), total: total.toLocaleString(), excluded: excluded.toLocaleString() }}
          components={{
            kept: <span className="text-teal font-mono" />,
            total: <span className="font-mono" />,
            excl: <span className="font-mono" />,
          }}
        />
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
