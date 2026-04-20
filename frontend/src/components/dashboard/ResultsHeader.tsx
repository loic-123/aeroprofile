import type { AnalysisResult } from "../../types";
import { Badge } from "../ui";
import { Route, Mountain, Clock, Zap } from "lucide-react";

interface Props {
  result: AnalysisResult;
}

/**
 * Editorial masthead: an italic-serif date eyebrow above a row of
 * mono-formatted key stats. The serif date is what a magazine
 * byline feels like; the stats row is Bloomberg-terminal compact.
 * Together they frame every analysis with a consistent "issue
 * header".
 */
export function ResultsHeader({ result }: Props) {
  const hours = Math.floor(result.ride_duration_s / 3600);
  const mins = Math.floor((result.ride_duration_s % 3600) / 60);
  const solverLabel: Record<string, string> = {
    wind_inverse: "Wind-Inverse",
    chung_ve: "Chung VE",
    martin_ls: "Martin LS",
  };

  // Format the date in a more editorial way: "15 Avril 2026"
  // instead of "2026-04-15".
  const dateLabel = (() => {
    try {
      const d = new Date(result.ride_date);
      return d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return result.ride_date;
    }
  })();

  return (
    <header className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <time className="font-serif italic text-2xl md:text-3xl text-primary/90 leading-none">
          {dateLabel}
        </time>
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted">
          analyse {result.source_format.toUpperCase()}
        </span>
        <Badge tone="neutral" size="sm" className="ml-auto">
          Solveur : {solverLabel[result.solver_method] ?? result.solver_method}
        </Badge>
      </div>
      <div className="flex items-center gap-x-6 gap-y-1.5 flex-wrap text-sm font-mono text-muted">
        <span className="inline-flex items-center gap-1.5 text-text">
          <Route size={14} className="text-muted" aria-hidden />
          {result.ride_distance_km.toFixed(1)} <span className="text-muted">km</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-text">
          <Mountain size={14} className="text-muted" aria-hidden />
          {Math.round(result.ride_elevation_gain_m)} <span className="text-muted">m D+</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-text">
          <Clock size={14} className="text-muted" aria-hidden />
          {hours}<span className="text-muted">h</span>{mins.toString().padStart(2, "0")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-text">
          <Zap size={14} className="text-muted" aria-hidden />
          {result.avg_power_w.toFixed(0)} <span className="text-muted">W moy.</span>
        </span>
      </div>
    </header>
  );
}
