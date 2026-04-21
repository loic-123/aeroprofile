import { useTranslation } from "react-i18next";
import type { AnalysisResult } from "../../types";
import { Card, Metric } from "../ui";
import InfoTooltip from "../InfoTooltip";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
}

/**
 * A row of 4 secondary metrics: Crr, RMSE (fit quality), ρ (air
 * density) and wind. All visually smaller than the hero CdA so the
 * eye reads the hero first, then optionally drills into these.
 *
 * Each metric sits in its own minimal card so the grid breathes on
 * wide viewports; on mobile the grid collapses to 2×2.
 */
export function ResultsSecondaryStats({ result, unreliable }: Props) {
  const { t } = useTranslation();
  const crrOutOfRange = result.crr < 0.0025 || result.crr > 0.008;
  const badFit = result.r_squared < 0.3;

  const crrTone = unreliable || crrOutOfRange ? "danger" : "primary";
  const rmseTone = badFit ? "danger" : "info";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              Crr
              <InfoTooltip text={t("tooltips.crrSecondary")} />
            </span>
          }
          value={unreliable ? "—" : result.crr.toFixed(4)}
          tone={crrTone}
          size="md"
          sub={
            unreliable
              ? t("secondary.crrUnreliable")
              : result.crr_was_fixed
                ? t("secondary.crrFixed")
                : t("secondary.crrCi", { low: result.crr_ci_low.toFixed(4), high: result.crr_ci_high.toFixed(4) })
          }
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              {t("secondary.rmseLabel")}
              <InfoTooltip text={t("tooltips.rmseSecondary")} />
            </span>
          }
          value={`±${result.rmse_w.toFixed(0)}`}
          unit="W"
          tone={rmseTone}
          size="md"
          sub={`R² ${result.r_squared.toFixed(2)} • MAE ${result.mae_w.toFixed(0)} W`}
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              {t("secondary.rho")}
              <InfoTooltip text={t("tooltips.rhoSecondary")} />
            </span>
          }
          value={result.avg_rho.toFixed(3)}
          unit="kg/m³"
          size="md"
          sub={t("secondary.rhoSub")}
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              {t("secondary.windMean")}
              <InfoTooltip text={t("tooltips.windSecondary")} />
            </span>
          }
          value={(result.avg_wind_speed_ms * 3.6).toFixed(1)}
          unit="km/h"
          size="md"
          sub={t("secondary.windFrom", { deg: result.avg_wind_dir_deg.toFixed(0) })}
        />
      </Card>
    </div>
  );
}
