import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisResult, BikeType } from "../../types";
import { getHistory } from "../../api/history";
import { getActiveProfile } from "../../api/profiles";
import { conformalIntervalForCda } from "../../lib/conformal";
import { Card, Badge } from "../ui";
import InfoTooltip from "../InfoTooltip";
import PositionSchematic from "../PositionSchematic";
import { PositionDelta } from "../PositionDelta";
import { motion } from "framer-motion";
import { useNumberRoll } from "../../hooks/useNumberRoll";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
  bikeType?: BikeType;
  positionIdx?: number;
}

/**
 * The hero section of the single-ride dashboard. The CdA value IS
 * the headline — 5xl/6xl mono, tabular, animated on mount via the
 * useNumberRoll hook. Hessian + conformal + personal solver bias
 * live right below in a tight <dl> so the reader can drill once
 * they've anchored on the big number.
 *
 * The position silhouette sits on the right and collapses to the
 * top on narrow viewports. Whole card is elevated two steps so it
 * visually stands out from the rest of the dashboard.
 */
export function ResultsHero({ result, unreliable, bikeType, positionIdx }: Props) {
  const { t } = useTranslation();
  const factor = result.prior_adaptive_factor ?? 1.0;
  const showFactor = factor > 1.05;
  const raw = result.cda_raw;
  const showRaw = raw != null && Math.abs(raw - result.cda) > 0.02;
  const outOfRange = result.cda < 0.2 || result.cda > 0.5;

  // Number-roll on the hero only for reliable results. Unreliable
  // shows "—" immediately — no animation on non-values.
  const rolled = useNumberRoll(unreliable ? 0 : result.cda, {
    decimals: 3,
    durationMs: 1400,
  });

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

  const showPositionDelta =
    !unreliable && bikeType != null && positionIdx != null && positionIdx > 0;

  return (
    <div className="space-y-4 h-full flex flex-col">
    <Card elevation={3} className="p-6 md:p-10 overflow-hidden relative flex-1 flex flex-col justify-center">
      {/* Subtle iris radial glow behind the hero number */}
      <div
        className="pointer-events-none absolute -top-20 -left-10 h-[360px] w-[360px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(124 111 222 / 0.16) 0%, rgba(124, 111, 222, 0) 70%)",
        }}
        aria-hidden
      />

      <div className="relative grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary font-semibold">
            CdA
            <InfoTooltip text={t("tooltips.heroCda")} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`num font-bold leading-none tracking-tight text-5xl md:text-7xl ${
              unreliable ? "text-muted" : outOfRange ? "text-danger" : "text-text"
            }`}
          >
            {unreliable ? "—" : rolled}
            <span className="text-xl md:text-2xl text-muted font-normal ml-3">m²</span>
          </motion.div>

          {!unreliable ? (
            <dl className="space-y-1.5 text-xs font-mono max-w-md pt-2">
              <div className="flex items-baseline gap-3">
                <dt className="text-muted w-28 text-[10px] uppercase tracking-wider shrink-0">
                  {t("dashboard.icHessian")}
                </dt>
                <dd className="text-text">
                  [{result.cda_ci_low.toFixed(3)} – {result.cda_ci_high.toFixed(3)}]
                </dd>
              </div>
              {conformal && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-muted w-28 text-[10px] uppercase tracking-wider shrink-0">
                    {t("dashboard.icConformal")}
                  </dt>
                  <dd className="text-accent">
                    [{conformal.low.toFixed(3)} – {conformal.high.toFixed(3)}]
                    <span className="text-muted ml-1.5">n={conformal.n}</span>
                  </dd>
                </div>
              )}
              {personalSolverBias && Math.abs(personalSolverBias.median) > 0.005 && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-muted w-28 text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                    Δ solver
                    <InfoTooltip text={t("tooltips.solverDeltaMedian")} />
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
              {t("dashboard.unreliable")}
            </div>
          )}

          {(showFactor || showRaw) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {showFactor && (
                <Badge tone="warn" size="sm">
                  {t("dashboard.priorReinforced", { factor: factor.toFixed(1) })}
                </Badge>
              )}
              {showRaw && (
                <span className="text-xs text-muted font-mono flex items-center gap-1">
                  {t("dashboard.priorOff")}
                  <span className="text-text">{raw!.toFixed(3)}</span>
                  <InfoTooltip text={t("tooltips.priorOffExplain")} />
                </span>
              )}
            </div>
          )}
        </div>

        {!unreliable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center md:justify-end"
          >
            <div className="relative">
              <PositionSchematic cda={result.cda} size={160} />
              <div className="text-center mt-2 text-[10px] uppercase tracking-widest text-muted font-semibold">
                {t("dashboard.position")}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
    {showPositionDelta && (
      <PositionDelta
        cda={result.cda}
        bikeType={bikeType!}
        positionIdx={positionIdx}
      />
    )}
    </div>
  );
}
