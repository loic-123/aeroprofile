import type { AnalysisResult } from "../types";
import AnomalyAlerts from "./AnomalyAlerts";
import AltitudeChart from "./AltitudeChart";
import CdARollingChart from "./CdARollingChart";
import PowerDecomposition from "./PowerDecomposition";
import PowerScatter from "./PowerScatter";
import ResidualsHistogram from "./ResidualsHistogram";
import SpeedCdAScatter from "./SpeedCdAScatter";
import MapView from "./MapView";

interface Props {
  result: AnalysisResult;
}

function StatCard({
  label,
  value,
  sub,
  accent = "text",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "text" | "teal" | "coral" | "info";
}) {
  const colors = {
    text: "text-text",
    teal: "text-teal",
    coral: "text-coral",
    info: "text-info",
  };
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-mono font-semibold mt-1 ${colors[accent]}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1 font-mono">{sub}</div>}
    </div>
  );
}

export default function ResultsDashboard({ result }: Props) {
  const hours = Math.floor(result.ride_duration_s / 3600);
  const mins = Math.floor((result.ride_duration_s % 3600) / 60);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted">
          {result.source_format.toUpperCase()} • {result.ride_date}
        </div>
        <h2 className="text-lg font-mono">
          {result.ride_distance_km.toFixed(1)} km • D+ {Math.round(result.ride_elevation_gain_m)} m •{" "}
          {hours}h{mins.toString().padStart(2, "0")} • {result.avg_power_w.toFixed(0)} W moy
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="CdA"
          value={result.cda.toFixed(3)}
          sub={`IC ${result.cda_ci_low.toFixed(3)} – ${result.cda_ci_high.toFixed(3)}`}
          accent="teal"
        />
        <StatCard
          label="Crr"
          value={result.crr.toFixed(4)}
          sub={
            result.crr_was_fixed
              ? "FIXÉ"
              : `IC ${result.crr_ci_low.toFixed(4)} – ${result.crr_ci_high.toFixed(4)}`
          }
          accent="teal"
        />
        <StatCard label="R²" value={result.r_squared.toFixed(3)} accent="info" />
        <StatCard
          label="ρ moyen"
          value={result.avg_rho.toFixed(3)}
          sub="kg/m³"
        />
        <StatCard
          label="Vent moyen"
          value={`${(result.avg_wind_speed_ms * 3.6).toFixed(1)} km/h`}
          sub={`${result.avg_wind_dir_deg.toFixed(0)}°`}
        />
      </div>

      <AnomalyAlerts anomalies={result.anomalies} />

      <div className="grid grid-cols-1 gap-6">
        <AltitudeChart profile={result.profile} />
        <CdARollingChart profile={result.profile} cdaMean={result.cda} />
        <PowerDecomposition profile={result.profile} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PowerScatter profile={result.profile} />
          <ResidualsHistogram profile={result.profile} />
        </div>
        <SpeedCdAScatter profile={result.profile} />
        <MapView profile={result.profile} />
      </div>
    </div>
  );
}
