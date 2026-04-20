import { useMemo } from "react";
import type { AnalysisResult } from "../../types";
import { getHistory } from "../../api/history";
import { getActiveProfile } from "../../api/profiles";
import { conformalIntervalForCda } from "../../lib/conformal";
import { Card, Badge } from "../ui";
import InfoTooltip from "../InfoTooltip";
import PositionSchematic from "../PositionSchematic";
import { motion } from "framer-motion";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
}

/**
 * The hero section of the dashboard. The CdA value is THE headline —
 * 5xl mono, teal, centred. The position silhouette on the right reads
 * as a 2-second visual summary. Secondary metrics (Hessian CI,
 * conformal CI, personal solver bias, prior-reinforced badge, cda_raw)
 * stack below the number so they don't compete with it.
 *
 * This is the component users will quote/screenshot when sharing
 * their results, so visual weight is intentionally heavy.
 */
export function ResultsHero({ result, unreliable }: Props) {
  const factor = result.prior_adaptive_factor ?? 1.0;
  const showFactor = factor > 1.05;
  const raw = result.cda_raw;
  const showRaw = raw != null && Math.abs(raw - result.cda) > 0.02;

  const outOfRange = result.cda < 0.2 || result.cda > 0.5;

  // Conformal interval — distribution-free IC from the user's history.
  const conformal = useMemo(() => {
    if (unreliable) return null;
    try {
      const hist = getHistory();
      const active = getActiveProfile();
      return conformalIntervalForCda(result.cda, hist, 0.05, {
        athleteKey: active.key,
        sensorLabel: result.power_meter_display ?? undefined,
        bikeKey: result.gear_id ?? undefined,
      });
    } catch {
      return null;
    }
  }, [result.cda, result.power_meter_display, result.gear_id, unreliable]);

  // Personal solver bias: median(chung_cda − cda) on the user's clean
  // rides. Exposes systematic wind_inverse vs Chung disagreement on
  // THIS user's dataset.
  const personalSolverBias = useMemo(() => {
    try {
      const hist = getHistory();
      const active = getActiveProfile();
      const deltas: number[] = [];
      for (const e of hist) {
        if (e.athleteKey && e.athleteKey !== active.key) continue;
        for (const rc of e.rideCdas) {
          if (rc.qualityStatus && rc.qualityStatus !== "ok") continue;
          if (rc.chungCda == null || !Number.isFinite(rc.chungCda)) continue;
          if (rc.biasRatio != null && (rc.biasRatio < 0.9 || rc.biasRatio > 1.1)) continue;
          deltas.push(rc.chungCda - rc.cda);
        }
      }
      if (deltas.length < 5) return null;
      deltas.sort((a, b) => a - b);
      const mid = Math.floor(deltas.length / 2);
      const median =
        deltas.length % 2 === 0 ? (deltas[mid - 1] + deltas[mid]) / 2 : deltas[mid];
      return { median, n: deltas.length };
    } catch {
      return null;
    }
  }, []);

  return (
    <Card elevation={2} className="p-6 md:p-8 overflow-hidden relative">
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 items-center">
        {/* Hero number + caption */}
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted font-medium flex items-center">
              CdA
              <InfoTooltip text="CdA = coefficient de traînée × surface frontale (m²). IC Hessien = intervalle de confiance 95% basé sur la courbure de la vraisemblance au point optimal. IC conforme = intervalle distribution-free avec garantie formelle de couverture 95% sur l'historique du rider." />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`num font-bold leading-none mt-2 text-5xl md:text-6xl ${
                unreliable
                  ? "text-muted"
                  : outOfRange
                    ? "text-danger"
                    : "text-primary"
              }`}
            >
              {unreliable ? "—" : result.cda.toFixed(3)}
              <span className="text-xl md:text-2xl text-muted font-normal ml-2">m²</span>
            </motion.div>
          </div>
          {!unreliable && (
            <div className="space-y-1 text-xs font-mono">
              <div className="text-muted">
                IC Hessien 95%{" "}
                <span className="text-text">
                  [{result.cda_ci_low.toFixed(3)} – {result.cda_ci_high.toFixed(3)}]
                </span>
              </div>
              {conformal && (
                <div className="text-info/90">
                  IC conforme 95%{" "}
                  <span className="text-info">
                    [{conformal.low.toFixed(3)} – {conformal.high.toFixed(3)}]
                  </span>
                  <span className="text-muted ml-1.5">(n={conformal.n})</span>
                </div>
              )}
              {personalSolverBias && Math.abs(personalSolverBias.median) > 0.005 && (
                <div className="text-muted opacity-90 flex items-center gap-1">
                  <span>
                    Δ solveur perso :{" "}
                    <span className="text-text">
                      {personalSolverBias.median >= 0 ? "+" : ""}
                      {personalSolverBias.median.toFixed(3)}
                    </span>
                    <span className="opacity-70"> (n={personalSolverBias.n})</span>
                  </span>
                  <InfoTooltip text="Médiane de (CdA Chung VE − CdA wind_inverse) sur tes rides clean passées. Mesure le désaccord systématique entre les deux solveurs sur TON dataset, qui n'est pas capturé par l'IC Hessien." />
                </div>
              )}
            </div>
          )}
          {unreliable && (
            <div className="text-sm text-danger font-medium">
              non fiable (R² &lt; 0)
            </div>
          )}
          {(showFactor || showRaw) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {showFactor && (
                <Badge tone="warn" size="sm">
                  prior renforcé ×{factor.toFixed(1)}
                </Badge>
              )}
              {showRaw && (
                <span className="text-xs text-muted font-mono flex items-center gap-1">
                  hors prior CdA :{" "}
                  <span className="text-text">{raw!.toFixed(3)}</span>
                  <InfoTooltip text="Estimation obtenue en désactivant le prior sur CdA. Les priors vent et Crr restent actifs pour garder le problème bien posé. Un écart > 0.05 avec la valeur principale déclenche le statut 'prior_dominated'." />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Position silhouette on the right — collapses to top on narrow viewports */}
        {!unreliable && (
          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <PositionSchematic cda={result.cda} size={200} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-muted uppercase tracking-wider font-medium whitespace-nowrap">
                Position estimée
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
