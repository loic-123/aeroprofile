import type { AnalysisResult } from "../../types";
import { Card, Metric } from "../ui";
import InfoTooltip from "../InfoTooltip";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
}

/**
 * Row of 4 secondary metrics: Crr, RMSE, ρ, wind. Each sits in a
 * quiet 2-px-radius editorial card; the label is uppercase muted
 * (not serif — serif is reserved for the hero and page-level
 * eyebrows). Tones indicate out-of-range / bad fit.
 */
export function ResultsSecondaryStats({ result, unreliable }: Props) {
  const crrOutOfRange = result.crr < 0.0025 || result.crr > 0.008;
  const badFit = result.r_squared < 0.3;
  const crrTone = unreliable || crrOutOfRange ? "danger" : "neutral";
  const rmseTone = badFit ? "danger" : "neutral";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              Crr
              <InfoTooltip text="Crr = coefficient de résistance au roulement (sans unité). Typiquement 0.003–0.004 sur pneu route bien gonflé, 0.005–0.007 sur route dégradée, 0.007–0.010 en gravel." />
            </span>
          }
          value={unreliable ? "—" : result.crr.toFixed(4)}
          tone={crrTone}
          size="md"
          sub={
            unreliable
              ? "non fiable"
              : result.crr_was_fixed
                ? "FIXÉ (peu de variété)"
                : `IC [${result.crr_ci_low.toFixed(4)} – ${result.crr_ci_high.toFixed(4)}]`
          }
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              RMSE
              <InfoTooltip text="Erreur RMSE (root-mean-square) entre la puissance modélisée et la puissance mesurée. Sur une sortie réelle, 15-25 W est typique ; sous 15 W excellent ; au-dessus de 30 W il y a un biais." />
            </span>
          }
          value={`±${result.rmse_w.toFixed(0)}`}
          unit="W"
          tone={rmseTone}
          size="md"
          sub={`R² ${result.r_squared.toFixed(2)} · MAE ${result.mae_w.toFixed(0)} W`}
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              ρ moyen
              <InfoTooltip text="Densité de l'air moyenne sur la sortie. Varie selon l'altitude, la température et l'humidité. ~1.22 au niveau de la mer à 15°C, ~1.05 à 1500 m." />
            </span>
          }
          value={result.avg_rho.toFixed(3)}
          unit="kg/m³"
          size="md"
          sub="air humide calculé par point"
        />
      </Card>

      <Card elevation={1} className="p-4">
        <Metric
          label={
            <span className="flex items-center">
              Vent moyen
              <InfoTooltip text="Vent moyen sur la sortie, récupéré depuis Open-Meteo. La direction est la provenance (0°=N, 90°=E, 180°=S, 270°=O). Le vent est corrigé à hauteur du cycliste (facteur 0.7)." />
            </span>
          }
          value={(result.avg_wind_speed_ms * 3.6).toFixed(1)}
          unit="km/h"
          size="md"
          sub={`provenance ${result.avg_wind_dir_deg.toFixed(0)}°`}
        />
      </Card>
    </div>
  );
}
