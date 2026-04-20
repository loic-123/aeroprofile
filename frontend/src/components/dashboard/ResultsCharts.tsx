import type { AnalysisResult } from "../../types";
import { Card } from "../ui";
import InfoTooltip from "../InfoTooltip";
import AltitudeChart from "../AltitudeChart";
import CdARollingChart from "../CdARollingChart";
import PowerDecomposition from "../PowerDecomposition";
import PowerScatter from "../PowerScatter";
import ResidualsHistogram from "../ResidualsHistogram";
import SpeedCdAScatter from "../SpeedCdAScatter";
import MapView from "../MapView";
import WindChart from "../WindChart";
import SpeedPowerChart from "../SpeedPowerChart";
import EnergyPieChart from "../EnergyPieChart";
import AirDensityChart from "../AirDensityChart";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  result: AnalysisResult;
}

function ChartCard({
  title,
  description,
  children,
  index = 0,
}: {
  title: string;
  description: string;
  children: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.04, 0.2) }}
    >
      <Card elevation={1} className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold flex items-center">
            {title}
            <InfoTooltip text={description} />
          </h3>
          <p className="text-xs text-muted mt-0.5 leading-snug">{description}</p>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

/**
 * All eight analytical charts stacked in a reading order that tells
 * a story: first altitude reconstruction (the sanity check), then
 * CdA rolling (is it stable?), then the power decomposition (what
 * does the power go into?), then model-vs-measure scatter + residuals
 * (how well did we fit?), then context (wind, ρ, map).
 *
 * Each chart is wrapped in a motion.div that fades+slides in when
 * scrolled into view — only on first appearance, not on every
 * re-render. prefers-reduced-motion is respected globally.
 */
export function ResultsCharts({ result }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard
        index={0}
        title="Altitude réelle vs virtuelle (méthode Chung)"
        description="Compare l'altitude GPS réelle (vert) à l'altitude « virtuelle » reconstruite en intégrant le bilan d'énergie avec le CdA/Crr estimés. Si les valeurs estimées sont correctes, les deux courbes doivent rester proches. Un écart grandissant indique un biais systématique (capteur, poids, ou vent mal estimé)."
      >
        <AltitudeChart profile={result.profile} />
      </ChartCard>

      <ChartCard
        index={1}
        title="CdA glissant (10 min)"
        description="CdA instantané estimé sur une fenêtre glissante de 10 minutes. Devrait rester relativement stable autour de la ligne horizontale (CdA moyen). Des pics ou chutes correspondent à des changements de position, du drafting, ou des zones où le modèle est peu fiable."
      >
        <CdARollingChart profile={result.profile} cdaMean={result.cda} />
      </ChartCard>

      <ChartCard
        index={2}
        title="Décomposition de la puissance"
        description="Ventile la puissance totale en ses composantes : aéro (force du vent apparent), roulement (frottement pneu/sol) et gravité (montées). Permet de voir quelle force domine à chaque moment et où l'amélioration aéro a le plus d'impact."
      >
        <PowerDecomposition profile={result.profile} />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={3}
          title="P_modèle vs P_mesuré"
          description="Chaque point compare la puissance prédite par le modèle (axe Y) à celle mesurée par le capteur (axe X). Un bon ajustement = points alignés sur la diagonale rouge. Points très dispersés = modèle imprécis sur cette sortie."
        >
          <PowerScatter profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={4}
          title="Distribution des résidus"
          description="Écart entre puissance modèle et puissance mesurée, en watts. Doit être centré sur 0 et en cloche gaussienne. Un décalage systématique (moyenne ≠ 0) suggère un biais : capteur mal calibré, poids faux, ou vent sous/surestimé."
        >
          <ResidualsHistogram profile={result.profile} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={5}
          title="Vitesse vs Puissance"
          description="Relation entre la vitesse au sol et la puissance mesurée. La dispersion vient du gradient, du vent et de l'accélération. Un nuage compact = conditions homogènes. Très dispersé = sortie variée (montagne, vent changeant)."
        >
          <SpeedPowerChart profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={6}
          title="Répartition de l'énergie"
          description="Part de l'énergie totale dépensée contre l'air (aéro), le frottement (roulement), la gravité (montées), et l'accélération. Sur le plat à 30+ km/h, l'aéro domine (~70-80%). En montagne, la gravité prend le dessus."
        >
          <EnergyPieChart profile={result.profile} />
        </ChartCard>
      </div>

      <ChartCard
        index={7}
        title="CdA glissant vs puissance"
        description="Relation entre le CdA instantané et la puissance mesurée. Si une forte corrélation apparaît, cela suggère un biais (capteur ou Crr mal estimé) qui dépend du régime de puissance."
      >
        <SpeedCdAScatter profile={result.profile} />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={8}
          title="Vent le long du parcours"
          description="Vitesse du vent (bleu, en km/h) et direction de provenance (rouge pointillé, en degrés : 0°=Nord, 90°=Est, 180°=Sud, 270°=Ouest) le long du parcours. Montre si le vent est resté constant ou a varié, ce qui impacte directement la qualité du modèle."
        >
          <WindChart profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={9}
          title="Densité de l'air (ρ)"
          description="Variation de la densité de l'air au fil du parcours. ρ baisse avec l'altitude et augmente avec le froid. Même CdA produit moins de traînée à ρ bas (altitude). Sur une sortie de 0 à 1500 m, ρ peut varier de 15% — c'est pourquoi on le calcule par point."
        >
          <AirDensityChart profile={result.profile} />
        </ChartCard>
      </div>

      <ChartCard
        index={10}
        title="Parcours"
        description="Tracé GPS de la sortie sur fond de carte. Sert de contexte visuel pour interpréter les autres graphes."
      >
        <MapView profile={result.profile} />
      </ChartCard>
    </div>
  );
}
