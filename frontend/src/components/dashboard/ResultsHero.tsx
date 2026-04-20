import { useMemo } from "react";
import type { AnalysisResult } from "../../types";
import { getHistory } from "../../api/history";
import { getActiveProfile } from "../../api/profiles";
import { conformalIntervalForCda } from "../../lib/conformal";
import { Card, Badge, HairlineUnderline } from "../ui";
import InfoTooltip from "../InfoTooltip";
import PositionSchematic from "../PositionSchematic";
import { motion } from "framer-motion";
import { useNumberRoll } from "../../hooks/useNumberRoll";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
}

/**
 * Editorial hero for a single-ride result.
 *
 * Layout (desktop): copper italic-serif "CdA" eyebrow top-left,
 * followed by a 5xl-6xl mono number that animates from 0 to the
 * result on mount (useNumberRoll), a copper hairline beneath the
 * number (HairlineUnderline), then compact IC95 + conformal IC +
 * personal solver bias lines in mono. Position silhouette sits on
 * the right and collapses to the top on narrow viewports.
 *
 * This block is the screenshot-worthy frame of the whole app — the
 * number-roll + hairline together are the signature gesture of the
 * rebrand.
 */
export function ResultsHero({ result, unreliable }: Props) {
  const factor = result.prior_adaptive_factor ?? 1.0;
  const showFactor = factor > 1.05;
  const raw = result.cda_raw;
  const showRaw = raw != null && Math.abs(raw - result.cda) > 0.02;
  const outOfRange = result.cda < 0.2 || result.cda > 0.5;

  // Number-roll for the hero CdA. Only animates when the result is
  // reliable — for unreliable rides we show "—" directly.
  const rolled = useNumberRoll(unreliable ? 0 : result.cda, {
    decimals: 3,
    durationMs: 900,
  });

  // Conformal interval — distribution-free IC from the user's
  // personal history (falls back silently when n < 30).
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

  // Personal solver bias: median(chung_cda − cda) over the user's
  // clean rides. Exposes systematic wind_inverse vs Chung
  // disagreement on THIS user's dataset.
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
    <Card elevation={2} className="p-6 md:p-10 overflow-hidden relative">
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 items-center">
        <div className="space-y-4">
          {/* Copper italic-serif eyebrow — the editorial signature */}
          <div className="flex items-center gap-3 text-primary">
            <span className="font-serif italic text-3xl md:text-4xl leading-none">
              CdA
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted">
              drag area estimate
            </span>
            <InfoTooltip text="CdA = coefficient de traînée × surface frontale (m²). IC Hessien = intervalle de confiance 95% basé sur la courbure de la vraisemblance au point optimal. IC conforme = intervalle distribution-free avec garantie formelle de couverture 95% sur l'historique du rider." />
          </div>

          {/* Hero number with a hairline underneath it */}
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={`num font-bold leading-none tracking-tight text-5xl md:text-7xl ${
                unreliable
                  ? "text-muted"
                  : outOfRange
                    ? "text-danger"
                    : "text-text"
              }`}
            >
              {unreliable ? "—" : rolled}
              <span className="text-xl md:text-2xl text-muted font-normal ml-2">m²</span>
            </motion.div>
            {!unreliable && (
              <HairlineUnderline width="half" delayMs={700} />
            )}
          </div>

          {!unreliable ? (
            <dl className="space-y-1 text-xs font-mono max-w-md pt-1">
              <div className="flex items-baseline gap-2">
                <dt className="text-muted uppercase tracking-wider text-[10px] w-28 shrink-0">
                  IC Hessien 95%
                </dt>
                <dd className="text-text">
                  [{result.cda_ci_low.toFixed(3)} – {result.cda_ci_high.toFixed(3)}]
                </dd>
              </div>
              {conformal && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted uppercase tracking-wider text-[10px] w-28 shrink-0">
                    IC conforme 95%
                  </dt>
                  <dd className="text-accent">
                    [{conformal.low.toFixed(3)} – {conformal.high.toFixed(3)}]
                    <span className="text-muted ml-1.5">n={conformal.n}</span>
                  </dd>
                </div>
              )}
              {personalSolverBias && Math.abs(personalSolverBias.median) > 0.005 && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted uppercase tracking-wider text-[10px] w-28 shrink-0 flex items-center gap-1">
                    Δ solveur perso
                    <InfoTooltip text="Médiane de (CdA Chung VE − CdA wind_inverse) sur tes rides clean passées. Mesure le désaccord systématique entre les deux solveurs sur TON dataset, qui n'est pas capturé par l'IC Hessien." />
                  </dt>
                  <dd className="text-text">
                    {personalSolverBias.median >= 0 ? "+" : ""}
                    {personalSolverBias.median.toFixed(3)}
                    <span className="text-muted ml-1.5">n={personalSolverBias.n}</span>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="text-sm text-danger font-medium">
              non fiable (R² &lt; 0)
            </div>
          )}

          {(showFactor || showRaw) && (
            <div className="flex items-center gap-2 flex-wrap pt-2">
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

        {/* Position silhouette on the right */}
        {!unreliable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center md:justify-end"
          >
            <div className="relative">
              <PositionSchematic cda={result.cda} size={200} />
              <div className="text-center mt-2 font-serif italic text-primary/80 text-sm">
                position estimée
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
