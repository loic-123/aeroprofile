import { lazy, Suspense } from "react";
import type { AnalysisResult, BikeType } from "../types";
import AnomalyAlerts from "./AnomalyAlerts";
import ReferenceTable from "./ReferenceTable";
import WhatIfSimulator from "./WhatIfSimulator";
import FilterSummary from "./FilterSummary";
// MapView pulls in maplibre-gl (~200 KB gzipped). Lazy-load so the
// critical dashboard render doesn't pay for it on users who never
// scroll to the map area.
const MapView = lazy(() => import("./MapView"));
import { ResultsHeader } from "./dashboard/ResultsHeader";
import { ResultsHero } from "./dashboard/ResultsHero";
import { ResultsSecondaryStats } from "./dashboard/ResultsSecondaryStats";
import { ResultsDiagnostics } from "./dashboard/ResultsDiagnostics";
import { ResultsGradientBreakdown } from "./dashboard/ResultsGradientBreakdown";
import { ResultsDerivedMetrics } from "./dashboard/ResultsDerivedMetrics";
import { ResultsCharts } from "./dashboard/ResultsCharts";

interface Props {
  result: AnalysisResult;
  massKg?: number;
  bikeType?: BikeType;
  positionIdx?: number;
  /** Callback to re-run the analysis with a user-supplied wind. Wired by
   *  the parent (App/IntervalsPage) that still has the original file and
   *  analysis options. Absent = hide the "Corriger le vent" button. */
  onReanalyzeWithWind?: (manual_wind_ms: number, manual_wind_dir_deg: number) => void;
}

/**
 * Orchestrator that composes the dashboard from six focused
 * sub-components under components/dashboard/. Reading order follows
 * an importance gradient:
 *
 *   1. Header       — ride metadata + solver badge
 *   2. Hero         — CdA + position (the screenshot-worthy block)
 *   3. Diagnostics  — unreliable / badFit / power-meter / wind-sens
 *   4. Secondary    — Crr, RMSE, ρ, wind (4-up row)
 *   5. Breakdown    — CdA by gradient regime + derived watts table
 *   6. Anomalies    — AnomalyAlerts + FilterSummary
 *   7. Exploration  — ReferenceTable + WhatIfSimulator
 *   8. Charts       — the 8 analytical plots
 *
 * This replaces the previous 657-line monolith; everything that was
 * here moved to one of the specialised files listed above.
 */
export default function ResultsDashboard({ result, massKg, bikeType, positionIdx, onReanalyzeWithWind }: Props) {
  const badFit = result.r_squared < 0.3;
  const unreliable = result.r_squared < 0;

  const hasRoute = result.profile?.lat?.length > 0 && result.profile?.lon?.length > 0;

  return (
    <div className="space-y-6">
      <ResultsHeader result={result} />
      {hasRoute && !unreliable ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <ResultsHero result={result} unreliable={unreliable} bikeType={bikeType} positionIdx={positionIdx} />
          <div className="min-h-[340px] lg:min-h-0">
            <Suspense
              fallback={
                <div className="h-full min-h-[340px] bg-panel border border-border rounded-lg animate-pulse" />
              }
            >
              <MapView profile={result.profile} />
            </Suspense>
          </div>
        </div>
      ) : (
        <ResultsHero result={result} unreliable={unreliable} bikeType={bikeType} positionIdx={positionIdx} />
      )}
      <ResultsDiagnostics result={result} unreliable={unreliable} badFit={badFit} onReanalyzeWithWind={onReanalyzeWithWind} />
      <ResultsSecondaryStats result={result} unreliable={unreliable} />
      {!unreliable && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultsGradientBreakdown result={result} />
          <ResultsDerivedMetrics result={result} massKg={massKg} />
        </div>
      )}
      {unreliable && <ResultsGradientBreakdown result={result} />}

      <AnomalyAlerts anomalies={result.anomalies} />
      <FilterSummary result={result} />

      {!unreliable && <ReferenceTable cda={result.cda} crr={result.crr} />}
      {!unreliable && <WhatIfSimulator result={result} />}

      <ResultsCharts result={result} />
    </div>
  );
}
