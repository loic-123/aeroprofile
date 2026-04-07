import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function WindCorrection() {
  return (
    <Article title="Correction du vent : de l'API météo au wind-inverse">
      <P>
        Le vent est la plus grosse source d'erreur dans le calcul du CdA. Un
        écart de 2 m/s entre le vent réel et le vent estimé produit ~50W
        d'erreur à 30 km/h — soit ~30% du signal aérodynamique. Voici comment
        AeroProfile s'attaque à ce problème, couche par couche.
      </P>

      <Section title="Couche 1 : les données Open-Meteo">
        <P>
          Open-Meteo fournit gratuitement les données météo historiques de
          n'importe quel jour, n'importe où. Pour chaque sortie, AeroProfile
          récupère heure par heure : vitesse du vent, direction, température,
          humidité, pression atmosphérique.
        </P>
        <P>
          Problème : la résolution spatiale est d'environ 10 km. Le vent dans
          une vallée protégée peut être 3× plus faible qu'en crête, mais
          l'API donne la même valeur pour les deux.
        </P>
      </Section>

      <Section title="Couche 2 : tuilage spatial">
        <P>
          Pour une sortie de 100 km, un seul point météo au centre du parcours
          ne suffit pas. AeroProfile découpe la route en tuiles de 5 km et
          récupère un point météo par tuile (jusqu'à 20 tuiles).
        </P>
        <P>
          Les données sont ensuite interpolées entre tuiles par décomposition
          vectorielle du vent :
        </P>
        <Formula>
          {"u = -V_vent × sin(direction)    [composante Est]\n" +
           "v = -V_vent × cos(direction)    [composante Nord]\n\n" +
           "Interpolation linéaire de u et v séparément,\n" +
           "puis recomposition :\n" +
           "V_vent = √(u² + v²)\n" +
           "direction = atan2(-u, -v)"}
        </Formula>
        <Note>
          On ne peut pas interpoler les angles directement ! Si une tuile
          donne un vent à 359° et la suivante à 1°, une interpolation naïve
          donnerait 180° (plein Sud) au lieu de 0° (Nord). La décomposition
          u/v résout ce problème.
        </Note>
      </Section>

      <Section title="Couche 3 : correction de hauteur (profil logarithmique)">
        <P>
          L'API météo donne le vent à 10 mètres de hauteur (standard WMO).
          Un cycliste est à ~1.3 m du sol, où le vent est freiné par la friction
          avec le terrain. Le profil logarithmique de vent donne :
        </P>
        <Formula>
          {"V(z) = V_ref × ln(z / z₀) / ln(z_ref / z₀)\n\n" +
           "z₀ = rugosité du terrain :\n" +
           "  0.03 m = rase campagne\n" +
           "  0.10 m = cultures, haies\n" +
           "  0.50 m = zone boisée/urbaine\n\n" +
           "Pour z₀ = 0.03, z = 1.3 m, z_ref = 10 m :\n" +
           "V_rider = V_10m × ln(1.3/0.03) / ln(10/0.03)\n" +
           "        = V_10m × 3.77 / 5.81\n" +
           "        = V_10m × 0.65"}
        </Formula>
        <P>
          Résultat : le vent à hauteur du cycliste est environ 65% du vent à
          10 m en terrain dégagé, et encore moins en zone abritée.
        </P>
      </Section>

      <Section title="Couche 4 : V_air = V_sol + composante de vent de face">
        <P>
          Le vent arrive d'une direction donnée (convention météo : d'où il
          vient, 0°=Nord). Le cycliste a un cap (bearing) calculé à chaque
          seconde depuis le GPS. La composante de vent de face est :
        </P>
        <Formula>
          {"headwind = V_vent × cos(direction_vent - bearing_cycliste)\n\n" +
           "V_air = V_sol + headwind\n\n" +
           "Si headwind > 0 → vent de face → V_air > V_sol\n" +
           "Si headwind < 0 → vent de dos → V_air < V_sol"}
        </Formula>
      </Section>

      <Section title="Couche 5 : wind-inverse (la révolution)">
        <P>
          Malgré les couches 1-4, le vent API reste imprécis. La solution
          ultime : estimer le vent DEPUIS les données du ride.
        </P>
        <P>
          Quand le cycliste change de direction (boucles, aller-retour,
          virages), il expose son profil aéro au vent sous différents angles.
          Un vent de face augmente la puissance nécessaire ; un vent de dos
          la diminue. En observant ces variations, le solveur peut
          "deviner" la vitesse et la direction du vent.
        </P>
        <Formula>
          {"Paramètres estimés conjointement :\n" +
           "  - CdA (coefficient aéro)\n" +
           "  - Crr (résistance au roulement)\n" +
           "  - V_vent et dir_vent par segment de 30 min\n\n" +
           "Le vent Open-Meteo sert de point de départ (prior gaussien\n" +
           "σ = 2 m/s), pas de vérité absolue. Le solveur l'ajuste."}
        </Formula>
        <P>
          Condition : il faut que le cycliste ait changé suffisamment de
          direction (heading variance &gt; 0.25). Sur une montée de col
          tout droit pendant 2h, le vent ne peut pas être estimé — il reste
          fixé à la valeur API.
        </P>
        <Warning>
          Le wind-inverse ne peut pas distinguer un vent latéral d'un
          changement de CdA (position). Si vous changez de position ET
          de direction en même temps, le solveur ne peut pas séparer
          les deux effets.
        </Warning>
      </Section>

      <Section title="Impact mesuré">
        <P>
          Sur nos rides de test, le wind-inverse fait passer le R² (qualité
          de reconstruction d'altitude) de ~0.50 à ~0.98. C'est la plus
          grosse amélioration de tout le pipeline.
        </P>
      </Section>
    </Article>
  );
}
