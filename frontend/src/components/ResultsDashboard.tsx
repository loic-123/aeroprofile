import type { AnalysisResult } from "../types";
import AnomalyAlerts from "./AnomalyAlerts";
import AltitudeChart from "./AltitudeChart";
import CdARollingChart from "./CdARollingChart";
import PowerDecomposition from "./PowerDecomposition";
import PowerScatter from "./PowerScatter";
import ResidualsHistogram from "./ResidualsHistogram";
import SpeedCdAScatter from "./SpeedCdAScatter";
import MapView from "./MapView";
import InfoTooltip from "./InfoTooltip";
import PositionSchematic from "./PositionSchematic";
import { AlertCircle } from "lucide-react";

interface Props {
  result: AnalysisResult;
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

function DerivedMetrics({ result }: { result: AnalysisResult }) {
  // Power needed to maintain a flat speed of V, no wind, typical mass 75kg
  const rho = result.avg_rho;
  const cda = result.cda;
  const crr = result.crr;
  const mass = 75;
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
        <InfoTooltip text="Watts nécessaires pour maintenir une vitesse donnée sur le plat, sans vent, pour un cycliste de 75 kg avec votre CdA et Crr. Air à densité de votre sortie." />
      </h3>
      <p className="text-xs text-muted mb-3">
        Watts pour rouler sur le plat (75 kg, pas de vent)
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

export default function ResultsDashboard({ result }: Props) {
  const hours = Math.floor(result.ride_duration_s / 3600);
  const mins = Math.floor((result.ride_duration_s % 3600) / 60);
  const badFit = result.r_squared < 0.3;

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

      {badFit && (
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
          value={result.cda.toFixed(3)}
          sub={`IC ${result.cda_ci_low.toFixed(3)} – ${result.cda_ci_high.toFixed(3)} m²`}
          accent={cdaAccent}
          tooltip="CdA = coefficient de traînée × surface frontale (m²). Représente la résistance à l'air. Typiquement 0.28–0.38 sur route mains sur cocottes, 0.22–0.28 en position basse, 0.18–0.22 en CLM. Plus petit = plus aéro. IC = intervalle de confiance à 95%."
        />
        <StatCard
          label="Crr"
          value={result.crr.toFixed(4)}
          sub={
            result.crr_was_fixed
              ? "FIXÉ (sortie sans assez de variété)"
              : `IC ${result.crr_ci_low.toFixed(4)} – ${result.crr_ci_high.toFixed(4)}`
          }
          accent={crrAccent}
          tooltip="Crr = coefficient de résistance au roulement (sans unité). Dépend des pneus, de la pression, et du revêtement. Typiquement 0.003–0.004 sur pneu route bien gonflé et asphalte lisse, 0.005–0.007 sur route dégradée, 0.007–0.010 en gravel."
        />
        <StatCard
          label="R²"
          value={result.r_squared.toFixed(3)}
          sub={
            result.r_squared > 0.7
              ? "excellent"
              : result.r_squared > 0.4
                ? "correct"
                : "faible"
          }
          accent={r2Accent}
          tooltip="R² mesure la qualité de l'ajustement du modèle physique aux données mesurées (0 à 1). > 0.7 = excellent, 0.4–0.7 = correct, < 0.4 = faible. Un R² négatif veut dire que le modèle est moins bon qu'une simple moyenne — signe de bruit important, drafting, ou capteur défectueux."
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
        <DerivedMetrics result={result} />
      </div>

      <AnomalyAlerts anomalies={result.anomalies} />

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

        <ChartSection
          title="CdA glissant vs puissance"
          description="Relation entre le CdA instantané et la puissance mesurée. Si une forte corrélation apparaît, cela suggère un biais (capteur ou Crr mal estimé) qui dépend du régime de puissance."
        >
          <SpeedCdAScatter profile={result.profile} />
        </ChartSection>

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
