import type { AnalysisResult } from "../types";
import AnomalyAlerts from "./AnomalyAlerts";
import AltitudeChart from "./AltitudeChart";
import CdARollingChart from "./CdARollingChart";
import PowerDecomposition from "./PowerDecomposition";
import PowerScatter from "./PowerScatter";
import ResidualsHistogram from "./ResidualsHistogram";
import SpeedCdAScatter from "./SpeedCdAScatter";
import MapView from "./MapView";
import ReferenceTable from "./ReferenceTable";
import FilterSummary from "./FilterSummary";
import WindChart from "./WindChart";
import SpeedPowerChart from "./SpeedPowerChart";
import EnergyPieChart from "./EnergyPieChart";
import AirDensityChart from "./AirDensityChart";
import InfoTooltip from "./InfoTooltip";
import PositionSchematic from "./PositionSchematic";
import { AlertCircle } from "lucide-react";

interface Props {
  result: AnalysisResult;
  massKg?: number;
}

function StatCard({
  label,
  value,
  sub,
  accent = "text",
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "text" | "teal" | "coral" | "info";
  tooltip?: string;
}) {
  const colors = {
    text: "text-text",
    teal: "text-teal",
    coral: "text-coral",
    info: "text-info",
  };
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-muted uppercase tracking-wide flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className={`text-2xl font-mono font-semibold mt-1 ${colors[accent]}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1 font-mono">{sub}</div>}
    </div>
  );
}

function CdABreakdown({ result }: { result: AnalysisResult }) {
  const { cda_climb, cda_descent, cda_flat } = result;
  if (cda_climb == null && cda_descent == null && cda_flat == null) return null;

  const vals = [cda_climb, cda_descent, cda_flat].filter(
    (v): v is number => v != null,
  );
  const spread = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  const asymmetric = spread > 0.08;

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        CdA par régime de pente
        <InfoTooltip text="CdA recalculé séparément sur les portions montantes (>+2%), descendantes (<−2%) et plates (±2%). Un écart > 0.08 m² entre les trois suggère un biais : vent asymétrique mal capturé, dérive du capteur à haute puissance, ou changement de position entre montée et descente. Ce n'est pas forcément une erreur — les cyclistes se redressent VRAIMENT en montée lente." />
      </h3>
      <p className="text-xs text-muted mb-3">
        Grosse asymétrie = signal de biais (vent, calibration) OU changement
        de position réel entre montée et descente.
      </p>
      <div className="grid grid-cols-3 gap-3 font-mono text-sm">
        <div>
          <div className="text-xs text-muted">Plat (±2%)</div>
          <div className="text-lg">
            {cda_flat != null ? cda_flat.toFixed(3) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Montée (&gt;+2%)</div>
          <div className="text-lg">
            {cda_climb != null ? cda_climb.toFixed(3) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Descente (&lt;−2%)</div>
          <div className="text-lg">
            {cda_descent != null ? cda_descent.toFixed(3) : "—"}
          </div>
        </div>
      </div>
      {asymmetric && (
        <div className="mt-3 text-xs text-orange-400">
          ⚠ Écart de {spread.toFixed(3)} m² entre régimes — vérifiez que le
          vent API est représentatif de la sortie.
        </div>
      )}
    </div>
  );
}

function DerivedMetrics({ result, massKg }: { result: AnalysisResult; massKg?: number }) {
  const rho = result.avg_rho;
  const cda = result.cda;
  const crr = result.crr;
  const mass = massKg || 75;
  const g = 9.80665;

  const powerAt = (kmh: number) => {
    const v = kmh / 3.6;
    const pAero = 0.5 * cda * rho * v * v * v;
    const pRoll = crr * mass * g * v;
    return (pAero + pRoll) / 0.976;
  };

  const speeds = [30, 35, 40, 45];

  // Cost at 40 km/h: fraction from aero
  const v40 = 40 / 3.6;
  const pAero40 = 0.5 * cda * rho * v40 * v40 * v40;
  const pRoll40 = crr * mass * g * v40;
  const aeroShare = (100 * pAero40) / (pAero40 + pRoll40);

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        Métriques dérivées
        <InfoTooltip text={`Watts nécessaires pour maintenir une vitesse donnée sur le plat, sans vent, pour ${mass} kg avec votre CdA et Crr. Air à densité de votre sortie.`} />
      </h3>
      <p className="text-xs text-muted mb-3">
        Watts pour rouler sur le plat ({mass} kg, pas de vent)
      </p>
      <table className="w-full text-sm font-mono">
        <tbody>
          {speeds.map((s) => (
            <tr key={s} className="border-b border-border/40 last:border-0">
              <td className="py-1.5 text-muted">{s} km/h</td>
              <td className="py-1.5 text-right text-teal">
                {powerAt(s).toFixed(0)} W
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-muted mt-3 pt-3 border-t border-border/40">
        À 40 km/h :{" "}
        <span className="text-text font-mono">{aeroShare.toFixed(0)}%</span> de
        la puissance sert à vaincre l'air, le reste le roulement.
        <InfoTooltip text="Part de la puissance qui va dans la traînée aérodynamique (le reste va dans la résistance au roulement). À basse vitesse la roue domine ; à haute vitesse l'air domine (loi en v² pour la force, v³ pour la puissance)." />
      </div>
    </div>
  );
}

function ChartSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        {title}
        <InfoTooltip text={description} />
      </h3>
      <p className="text-xs text-muted mb-2">{description}</p>
      {children}
    </div>
  );
}

export default function ResultsDashboard({ result, massKg }: Props) {
  const hours = Math.floor(result.ride_duration_s / 3600);
  const mins = Math.floor((result.ride_duration_s % 3600) / 60);
  const badFit = result.r_squared < 0.3;
  // R² < 0 means the physical model is worse than a simple mean — the CdA/Crr
  // point estimates are mathematically valid but physically meaningless.
  const unreliable = result.r_squared < 0;

  const cdaAccent: "teal" | "coral" =
    result.cda < 0.2 || result.cda > 0.5 ? "coral" : "teal";
  const crrAccent: "teal" | "coral" =
    result.crr < 0.0025 || result.crr > 0.008 ? "coral" : "teal";
  const r2Accent: "info" | "coral" = badFit ? "coral" : "info";

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

      {result.solver_method === "chung_ve" && (
        <div className="bg-info/10 border border-info rounded-lg p-3 text-sm">
          <div className="font-semibold text-info">
            Méthode : Chung (Virtual Elevation)
          </div>
          <p className="mt-1 text-xs">{result.solver_note}</p>
        </div>
      )}

      <CdABreakdown result={result} />

      {unreliable ? (
        <div className="bg-coral/10 border border-coral rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-coral flex-shrink-0" size={20} />
          <div>
            <div className="font-semibold text-coral">
              CdA et Crr non estimables sur cette sortie (R² = {result.r_squared.toFixed(2)})
            </div>
            <p className="text-sm mt-1">
              Le modèle physique ne s'applique pas à cette sortie : il y a une
              ou plusieurs forces non prises en compte (vent réel très différent
              de la météo API, drafting massif dans un peloton, freins qui
              frottent, capteur défectueux…). <strong>Les valeurs CdA/Crr
              affichées ci-dessous ne sont pas fiables</strong> — le solveur
              a trouvé le "moins mauvais" fit possible, pas une mesure correcte.
            </p>
            <p className="text-sm mt-2">
              Ce que vous pouvez quand même exploiter : le <strong>breakdown
              plat / montée / descente</strong> ci-dessous (qui reste
              qualitativement parlant), et la <strong>direction du biais
              des résidus</strong> dans les alertes (qui indique s'il faut
              chercher un capteur sur- ou sous-calibré).
            </p>
          </div>
        </div>
      ) : badFit && (
        <div className="bg-coral/10 border border-coral rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-coral flex-shrink-0" size={20} />
          <div>
            <div className="font-semibold text-coral">
              Qualité d'ajustement faible (R² = {result.r_squared.toFixed(2)})
            </div>
            <p className="text-sm mt-1">
              Le modèle physique n'explique pas bien cette sortie. Causes probables :
              capteur de puissance mal calibré, altitude GPS très bruitée, beaucoup
              de drafting ou de freinages, ou sortie peu adaptée (vélo à assistance,
              cyclocross, VTT en sous-bois). <strong>Les valeurs CdA et Crr
              ci-dessous sont à prendre avec beaucoup de précaution.</strong>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="CdA"
          value={unreliable ? "—" : result.cda.toFixed(3)}
          sub={
            unreliable
              ? "non fiable (R² < 0)"
              : `IC ${result.cda_ci_low.toFixed(3)} – ${result.cda_ci_high.toFixed(3)} m²`
          }
          accent={unreliable ? "coral" : cdaAccent}
          tooltip="CdA = coefficient de traînée × surface frontale (m²). Représente la résistance à l'air. Typiquement 0.28–0.38 sur route mains sur cocottes, 0.22–0.28 en position basse, 0.18–0.22 en CLM. Plus petit = plus aéro. IC = intervalle de confiance à 95%."
        />
        <StatCard
          label="Crr"
          value={unreliable ? "—" : result.crr.toFixed(4)}
          sub={
            unreliable
              ? "non fiable (R² < 0)"
              : result.crr_was_fixed
                ? "FIXÉ (sortie sans assez de variété)"
                : `IC ${result.crr_ci_low.toFixed(4)} – ${result.crr_ci_high.toFixed(4)}`
          }
          accent={unreliable ? "coral" : crrAccent}
          tooltip="Crr = coefficient de résistance au roulement (sans unité). Dépend des pneus, de la pression, et du revêtement. Typiquement 0.003–0.004 sur pneu route bien gonflé et asphalte lisse, 0.005–0.007 sur route dégradée, 0.007–0.010 en gravel."
        />
        <StatCard
          label="Erreur moyenne"
          value={`±${result.rmse_w.toFixed(0)} W`}
          sub={`R² ${result.r_squared.toFixed(2)} • MAE ${result.mae_w.toFixed(0)} W`}
          accent={r2Accent}
          tooltip="Erreur RMSE (root-mean-square) entre la puissance modélisée et la puissance mesurée. 'Le modèle se trompe en moyenne de ±X watts.' Sur une sortie réelle, 15-25 W est typique ; sous 15 W excellent ; au-dessus de 30 W il y a un biais (vent mal capturé, drafting, capteur mal calibré). Le R² complémentaire dépend de la variance de la sortie et n'est pas toujours informatif."
        />
        <StatCard
          label="ρ moyen"
          value={result.avg_rho.toFixed(3)}
          sub="kg/m³ (air)"
          tooltip="Densité de l'air moyenne sur la sortie. Varie selon l'altitude, la température et l'humidité. ~1.22 au niveau de la mer à 15°C, ~1.05 à 1500 m. Impacte directement le CdA : air moins dense = force aéro réduite."
        />
        <StatCard
          label="Vent moyen"
          value={`${(result.avg_wind_speed_ms * 3.6).toFixed(1)} km/h`}
          sub={`provenance ${result.avg_wind_dir_deg.toFixed(0)}°`}
          tooltip="Vent moyen sur la sortie, récupéré depuis l'API Open-Meteo pour les coordonnées et la date du fichier. La direction est la provenance (0°=Nord, 90°=Est, 180°=Sud, 270°=Ouest) suivant la convention météo. Le vent est corrigé à hauteur du cycliste (facteur 0.7)."
        />
      </div>

      {!unreliable && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-panel border border-border rounded-lg p-4 md:col-span-2">
            <h3 className="text-sm font-semibold mb-1 flex items-center">
              Position estimée
              <InfoTooltip text="Silhouette simplifiée déduite du CdA estimé. Un CdA bas correspond à une position très couchée/aéro ; un CdA élevé à une position droite. C'est une illustration pédagogique, pas une mesure de votre posture réelle." />
            </h3>
            <p className="text-xs text-muted mb-3">
              Silhouette déduite du CdA : plus le CdA est bas, plus le cycliste est couché.
            </p>
            <div className="flex justify-center">
              <PositionSchematic cda={result.cda} size={320} />
            </div>
          </div>
          <DerivedMetrics result={result} massKg={massKg} />
        </div>
      )}

      {!unreliable && <ReferenceTable cda={result.cda} crr={result.crr} />}

      <AnomalyAlerts anomalies={result.anomalies} />

      <FilterSummary result={result} />

      <div className="grid grid-cols-1 gap-6">
        <ChartSection
          title="Altitude réelle vs virtuelle (méthode Chung)"
          description="Compare l'altitude GPS réelle (vert) à l'altitude « virtuelle » reconstruite en intégrant le bilan d'énergie avec le CdA/Crr estimés. Si les valeurs estimées sont correctes, les deux courbes doivent rester proches. Un écart grandissant indique un biais systématique (capteur, poids, ou vent mal estimé)."
        >
          <AltitudeChart profile={result.profile} />
        </ChartSection>

        <ChartSection
          title="CdA glissant (10 min)"
          description="CdA instantané estimé sur une fenêtre glissante de 10 minutes. Devrait rester relativement stable autour de la ligne horizontale (CdA moyen). Des pics ou chutes correspondent à des changements de position, du drafting, ou des zones où le modèle est peu fiable."
        >
          <CdARollingChart profile={result.profile} cdaMean={result.cda} />
        </ChartSection>

        <ChartSection
          title="Décomposition de la puissance"
          description="Ventile la puissance totale en ses composantes : aéro (force du vent apparent), roulement (frottement pneu/sol) et gravité (montées). Permet de voir quelle force domine à chaque moment et où l'amélioration aéro a le plus d'impact."
        >
          <PowerDecomposition profile={result.profile} />
        </ChartSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSection
            title="P_modèle vs P_mesuré"
            description="Chaque point compare la puissance prédite par le modèle (axe Y) à celle mesurée par le capteur (axe X). Un bon ajustement = points alignés sur la diagonale rouge. Points très dispersés = modèle imprécis sur cette sortie."
          >
            <PowerScatter profile={result.profile} />
          </ChartSection>
          <ChartSection
            title="Distribution des résidus"
            description="Écart entre puissance modèle et puissance mesurée, en watts. Doit être centré sur 0 et en cloche gaussienne. Un décalage systématique (moyenne ≠ 0) suggère un biais : capteur mal calibré, poids faux, ou vent sous/surestimé."
          >
            <ResidualsHistogram profile={result.profile} />
          </ChartSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSection
            title="Vitesse vs Puissance"
            description="Relation entre la vitesse au sol et la puissance mesurée. La dispersion vient du gradient, du vent et de l'accélération. Un nuage compact = conditions homogènes. Très dispersé = sortie variée (montagne, vent changeant)."
          >
            <SpeedPowerChart profile={result.profile} />
          </ChartSection>
          <ChartSection
            title="Répartition de l'énergie"
            description="Part de l'énergie totale dépensée contre l'air (aéro), le frottement (roulement), la gravité (montées), et l'accélération. Sur le plat à 30+ km/h, l'aéro domine (~70-80%). En montagne, la gravité prend le dessus."
          >
            <EnergyPieChart profile={result.profile} />
          </ChartSection>
        </div>

        <ChartSection
          title="CdA glissant vs puissance"
          description="Relation entre le CdA instantané et la puissance mesurée. Si une forte corrélation apparaît, cela suggère un biais (capteur ou Crr mal estimé) qui dépend du régime de puissance."
        >
          <SpeedCdAScatter profile={result.profile} />
        </ChartSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSection
            title="Vent le long du parcours"
            description="Vitesse du vent (bleu, en km/h) et direction de provenance (rouge pointillé, en degrés : 0°=Nord, 90°=Est, 180°=Sud, 270°=Ouest) le long du parcours. Montre si le vent est resté constant ou a varié, ce qui impacte directement la qualité du modèle."
          >
            <WindChart profile={result.profile} />
          </ChartSection>
          <ChartSection
            title="Densité de l'air (ρ)"
            description="Variation de la densité de l'air au fil du parcours. ρ baisse avec l'altitude et augmente avec le froid. Même CdA produit moins de traînée à ρ bas (altitude). Sur une sortie de 0 à 1500 m, ρ peut varier de 15% — c'est pourquoi on le calcule par point."
          >
            <AirDensityChart profile={result.profile} />
          </ChartSection>
        </div>

        <ChartSection
          title="Parcours"
          description="Tracé GPS de la sortie sur fond de carte. Sert de contexte visuel pour interpréter les autres graphes."
        >
          <MapView profile={result.profile} />
        </ChartSection>
      </div>
    </div>
  );
}
