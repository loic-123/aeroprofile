import type { AnalysisResult } from "../../types";
import { Badge } from "../ui";
import { Route, Mountain, Clock, Zap } from "lucide-react";

interface Props {
  result: AnalysisResult;
}

/**
 * Compact metadata row at the top of the dashboard: source format,
 * ride date, distance, elevation gain, duration, average power, and
 * the solver method used. Replaces the unstructured text block that
 * was the first thing users saw.
 */
export function ResultsHeader({ result }: Props) {
  const hours = Math.floor(result.ride_duration_s / 3600);
  const mins = Math.floor((result.ride_duration_s % 3600) / 60);
  const solverLabel: Record<string, string> = {
    wind_inverse: "Wind-Inverse",
    chung_ve: "Chung VE",
    martin_ls: "Martin LS",
  };

  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-wide">
          {result.source_format.toUpperCase()}
        </span>
        <span aria-hidden>•</span>
        <time className="font-mono">{result.ride_date}</time>
        <span aria-hidden>•</span>
        <Badge tone="neutral" size="sm">
          Solveur : {solverLabel[result.solver_method] ?? result.solver_method}
        </Badge>
      </div>
      <div className="flex items-center gap-x-6 gap-y-1 flex-wrap text-sm font-mono">
        <span className="inline-flex items-center gap-1.5">
          <Route size={14} className="text-muted" aria-hidden />
          {result.ride_distance_km.toFixed(1)} km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mountain size={14} className="text-muted" aria-hidden />
          D+ {Math.round(result.ride_elevation_gain_m)} m
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} className="text-muted" aria-hidden />
          {hours}h{mins.toString().padStart(2, "0")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Zap size={14} className="text-muted" aria-hidden />
          {result.avg_power_w.toFixed(0)} W moy.
        </span>
      </div>
    </header>
  );
}
