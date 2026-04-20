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
              <InfoTooltip text="Crr = coefficient de résistance au roulement (sans unité). Dépend des pneus, de la pression, et du revêtement. Typiquement 0.003–0.004 sur pneu route bien gonflé et asphalte lisse, 0.005–0.007 sur route dégradée, 0.007–0.010 en gravel." />
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
              Erreur moyenne
              <InfoTooltip text="Erreur RMSE (root-mean-square) entre la puissance modélisée et la puissance mesurée. Sur une sortie réelle, 15-25 W est typique ; sous 15 W excellent ; au-dessus de 30 W il y a un biais. Le R² complémentaire dépend de la variance de la sortie." />
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
