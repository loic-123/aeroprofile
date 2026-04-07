import { Article, Section, Formula, Note, P } from "../../components/BlogLayout";

export default function PowerEquation() {
  return (
    <Article title="L'équation de puissance en cyclisme : Martin et al. (1998)">
      <P>
        Tout le calcul d'AeroProfile repose sur une seule équation physique,
        publiée en 1998 par Martin, Milliken, Cobb, McFadden et Coggan. Cette
        équation relie la puissance que vous produisez aux pédales aux forces
        qui s'opposent à votre avancement.
      </P>

      <Section title="L'idée fondamentale">
        <P>
          Quand vous pédalez, votre capteur de puissance mesure combien d'énergie
          par seconde vous transmettez à la route. Cette énergie sert à vaincre
          4 forces :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li><strong>La traînée aérodynamique</strong> — l'air qui freine votre avancement</li>
          <li><strong>Le roulement</strong> — la déformation des pneus sur l'asphalte</li>
          <li><strong>La gravité</strong> — monter coûte de l'énergie, descendre en rend</li>
          <li><strong>L'accélération</strong> — changer de vitesse coûte de l'énergie cinétique</li>
        </ul>
      </Section>

      <Section title="L'équation complète">
        <Formula>
          {"P_mesuré × η = P_aéro + P_roulement + P_gravité + P_accélération + P_roulements_roues"}
        </Formula>
        <P>Où chaque terme se développe :</P>
        <Formula>
          {"P_aéro     = 0.5 × CdA × ρ × V_air² × V_sol\n" +
           "P_roulement = Crr × m × g × cos(θ) × V_sol\n" +
           "P_gravité   = m × g × sin(θ) × V_sol\n" +
           "P_accélér.  = (m + 0.14) × a × V_sol\n" +
           "P_roulements = V × (91 + 8.7 × V) × 10⁻³"}
        </Formula>
      </Section>

      <Section title="Chaque variable expliquée">
        <P>
          <strong>η (eta) = 0.977</strong> — le rendement de la transmission (chaîne, dérailleur).
          Sur 100W aux pédales, 97.7W arrivent à la roue. Les 2.3% restants
          sont perdus en friction dans la chaîne. AeroProfile utilise un η
          variable avec la puissance (Spicer et al. 2001) : η baisse légèrement
          à basse puissance car la chaîne est moins tendue.
        </P>
        <P>
          <strong>CdA</strong> — le coefficient de traînée aérodynamique × la
          surface frontale (en m²). C'est CE QU'ON CHERCHE. Plus il est bas,
          moins vous offrez de résistance à l'air.
        </P>
        <P>
          <strong>ρ (rho)</strong> — la densité de l'air en kg/m³. Varie avec
          l'altitude (~1.22 au niveau de la mer, ~1.05 à 1500m), la température
          et l'humidité. AeroProfile la calcule pour chaque point GPS.
        </P>
        <P>
          <strong>V_air</strong> — votre vitesse par rapport à l'air, pas par
          rapport au sol. Si vous roulez à 30 km/h avec un vent de face de
          10 km/h, votre V_air = 40 km/h mais votre V_sol = 30 km/h.
        </P>
        <P>
          <strong>Crr</strong> — le coefficient de résistance au roulement.
          Dépend de vos pneus, de leur pression, et du revêtement. Typiquement
          0.003 à 0.005 sur route.
        </P>
        <P>
          <strong>m</strong> — la masse totale cycliste + vélo en kg.
        </P>
        <P>
          <strong>g = 9.80665 m/s²</strong> — l'accélération de la pesanteur.
        </P>
        <P>
          <strong>θ (theta)</strong> — l'angle de la pente. 5% de pente = arctan(0.05) ≈ 2.86°.
        </P>
        <P>
          <strong>a</strong> — votre accélération en m/s². Positif quand vous
          accélérez, négatif quand vous ralentissez.
        </P>
        <P>
          <strong>0.14 kg</strong> — la masse effective des roues due à leur
          moment d'inertie. Une roue qui tourne a plus d'inertie qu'une masse
          ponctuelle — il faut fournir de l'énergie supplémentaire pour
          l'accélérer (Martin 1998).
        </P>
        <P>
          <strong>P_roulements</strong> — les pertes dans les roulements de roues
          (moyeux). Séparées du η car elles sont proportionnelles à la vitesse,
          pas à la puissance. Formule de Dahn et al.
        </P>
      </Section>

      <Section title="Un point critique : V_air² × V_sol, pas V_air³">
        <P>
          La force aérodynamique est proportionnelle à V_air². Mais la
          puissance = force × vitesse, et la vitesse pertinente ici est V_sol
          (c'est la vitesse à laquelle le vélo avance). D'où P_aéro = F × V_sol
          = (0.5 × CdA × ρ × V_air²) × V_sol.
        </P>
        <Note>
          C'est une erreur classique de mettre V_air³ dans l'équation de
          puissance. Si vous avez un vent de face de 20 km/h, V_air³ surestime
          la puissance de ~20% par rapport à V_air² × V_sol.
        </Note>
      </Section>

      <Section title="Comment AeroProfile utilise cette équation">
        <P>
          On connaît tout sauf CdA et Crr : la puissance est mesurée par votre
          capteur, la vitesse par le GPS, l'altitude par le baromètre, le vent
          par l'API météo, la densité de l'air par le calcul. Le solveur ajuste
          CdA et Crr jusqu'à ce que l'équation prédise au mieux la puissance
          mesurée.
        </P>
        <P>
          Concrètement, pour chaque seconde de votre sortie, le modèle prédit
          "avec ces CdA et Crr, à cette vitesse, cette pente, ce vent, vous
          auriez dû produire X watts". Le solveur minimise la somme des
          écarts (X - P_mesuré)² sur toute la sortie.
        </P>
      </Section>

      <Section title="Référence">
        <P>
          Martin JC, Milliken DL, Cobb JE, McFadden KL, Coggan AR. (1998).
          "Validation of a Mathematical Model for Road Cycling Power."
          <em> Journal of Applied Biomechanics</em>, 14(3), 276–291.
        </P>
        <P>
          Validé en laboratoire avec R² = 0.97 et une erreur de 2.7W
          sur un vélodrome en conditions contrôlées.
        </P>
      </Section>
    </Article>
  );
}
