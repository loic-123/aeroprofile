import { Article, Section, Formula, Tex, Note, P } from "../../components/BlogLayout";

export default function PowerEquation() {
  return (
    <Article title="L'équation de puissance en cyclisme : Martin et al. (1998)">
      <P>
        Tout le calcul d'AeroProfile repose sur une seule équation physique,
        publiée en 1998 par Martin, Milliken, Cobb, McFadden et Coggan. Cette
        équation relie la puissance que vous produisez aux pédales aux forces
        qui s'opposent à votre avancement. Elle a été validée en laboratoire
        avec un coefficient de détermination R² = 0.97 et une erreur standard
        de seulement 2.7 W sur piste.
      </P>

      <Section title="L'idée fondamentale">
        <P>
          Quand vous pédalez, votre capteur de puissance mesure combien d'énergie
          par seconde vous transmettez à la route. Cette énergie sert à vaincre
          cinq sources de résistance :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li><strong>La traînée aérodynamique</strong> — l'air qui freine votre avancement</li>
          <li><strong>Le roulement</strong> — la déformation des pneus sur l'asphalte</li>
          <li><strong>La gravité</strong> — monter coûte de l'énergie, descendre en rend</li>
          <li><strong>L'accélération</strong> — changer de vitesse coûte de l'énergie cinétique</li>
          <li><strong>Les roulements de roues</strong> — friction dans les moyeux</li>
        </ul>
      </Section>

      <Section title="L'équation complète">
        <Formula>
          {String.raw`P_{\text{mesuré}} \times \eta = P_{\text{aéro}} + P_{\text{roulement}} + P_{\text{gravité}} + P_{\text{accél}} + P_{\text{roulements}}`}
        </Formula>
        <P>Où chaque terme se développe :</P>
        <Formula>
          {String.raw`P_{\text{aéro}} = \frac{1}{2} \cdot C_d A \cdot \rho \cdot V_{\text{air}}^2 \cdot V_{\text{sol}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{roulement}} = C_{rr} \cdot m \cdot g \cdot \cos(\theta) \cdot V_{\text{sol}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{gravité}} = m \cdot g \cdot \sin(\theta) \cdot V_{\text{sol}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{accél}} = (m + I_{\text{eff}}) \cdot a \cdot V_{\text{sol}} \quad \text{où } I_{\text{eff}} = 0.14 \text{ kg}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{roulements}} = V \cdot (91 + 8.7 \cdot V) \times 10^{-3} \quad \text{(Dahn et al.)}`}
        </Formula>
      </Section>

      <Section title="Chaque variable expliquée">
        <P>
          <strong><Tex>{String.raw`\eta`}</Tex> (eta) = 0.977</strong> — le rendement de la transmission (chaîne, dérailleur).
          Sur 100 W aux pédales, 97.7 W arrivent à la roue. Les 2.3% restants
          sont perdus en friction dans la chaîne. AeroProfile utilise un <Tex>{String.raw`\eta`}</Tex> variable
          avec la puissance (Spicer et al. 2001) :
        </P>
        <Formula>
          {String.raw`\eta(P) = 0.977 + 0.00003 \times (P - 150), \quad \text{clipé à } [0.95,\; 0.99]`}
        </Formula>
        <P>
          À basse puissance, la chaîne est moins tendue → plus de friction relative.
          À haute puissance, le rendement monte légèrement.
        </P>
        <P>
          <strong><Tex>{String.raw`C_d A`}</Tex></strong> — le coefficient de traînée aérodynamique × la
          surface frontale (en m²). C'est <strong>ce qu'on cherche</strong>. Plus il est bas,
          moins vous offrez de résistance à l'air.
        </P>
        <P>
          <strong><Tex>{String.raw`\rho`}</Tex> (rho)</strong> — la densité de l'air en kg/m³. Varie avec
          l'altitude (~1.22 au niveau de la mer, ~1.05 à 1500 m), la température
          et l'humidité. AeroProfile la calcule pour chaque point GPS via :
        </P>
        <Formula>
          {String.raw`\rho = \frac{P_{\text{dry}}}{R_d \cdot T} + \frac{P_{\text{vapor}}}{R_v \cdot T}`}
        </Formula>
        <P>
          où <Tex>{String.raw`P_{\text{dry}}`}</Tex> est la pression partielle de l'air sec, <Tex>{String.raw`P_{\text{vapor}}`}</Tex> la
          pression de vapeur d'eau, <Tex>{String.raw`R_d = 287.05`}</Tex> et <Tex>{String.raw`R_v = 461.5`}</Tex> J/(kg·K).
        </P>
        <P>
          <strong><Tex>{String.raw`V_{\text{air}}`}</Tex></strong> — votre vitesse par rapport à l'air, pas par
          rapport au sol. Si vous roulez à 30 km/h avec un vent de face de
          10 km/h, votre <Tex>{String.raw`V_{\text{air}} = 40`}</Tex> km/h mais votre <Tex>{String.raw`V_{\text{sol}} = 30`}</Tex> km/h.
        </P>
        <P>
          <strong><Tex>{String.raw`C_{rr}`}</Tex></strong> — le coefficient de résistance au roulement.
          Dépend de vos pneus, de leur pression, et du revêtement. Typiquement
          0.003 à 0.005 sur route lisse.
        </P>
        <P>
          <strong>m</strong> — la masse totale cycliste + vélo en kg.
        </P>
        <P>
          <strong><Tex>{String.raw`g = 9.80665`}</Tex> m/s²</strong> — l'accélération de la pesanteur.
        </P>
        <P>
          <strong><Tex>{String.raw`\theta`}</Tex> (theta)</strong> — l'angle de la pente.
          5% de pente = <Tex>{String.raw`\arctan(0.05) \approx 2.86°`}</Tex>.
        </P>
        <P>
          <strong>a</strong> — votre accélération en m/s². Positif quand vous
          accélérez, négatif quand vous ralentissez.
        </P>
        <P>
          <strong>0.14 kg</strong> — la masse effective des roues due à leur
          moment d'inertie. Une roue qui tourne a plus d'inertie qu'une masse
          ponctuelle — il faut fournir de l'énergie supplémentaire pour
          l'accélérer : <Tex>{String.raw`I_{\text{eff}} = I / r^2 \approx 0.14`}</Tex> kg (Martin 1998).
        </P>
      </Section>

      <Section title="Un point critique : V_air² × V_sol, pas V_air³">
        <P>
          La force aérodynamique est proportionnelle à <Tex>{String.raw`V_{\text{air}}^2`}</Tex>. Mais la
          puissance = force × vitesse, et la vitesse pertinente ici est <Tex>{String.raw`V_{\text{sol}}`}</Tex> (c'est
          la vitesse à laquelle le vélo avance). D'où :
        </P>
        <Formula>
          {String.raw`P_{\text{aéro}} = F_{\text{drag}} \times V_{\text{sol}} = \left(\frac{1}{2} C_d A \cdot \rho \cdot V_{\text{air}}^2\right) \times V_{\text{sol}}`}
        </Formula>
        <Note>
          C'est une erreur classique de mettre <Tex>{String.raw`V_{\text{air}}^3`}</Tex> dans l'équation de
          puissance. Si vous avez un vent de face de 20 km/h, <Tex>{String.raw`V_{\text{air}}^3`}</Tex> surestime
          la puissance de ~20% par rapport à <Tex>{String.raw`V_{\text{air}}^2 \times V_{\text{sol}}`}</Tex>.
        </Note>
      </Section>

      <Section title="Le lissage de la puissance (5 secondes)">
        <P>
          Martin et al. recommandent de lisser la puissance sur la durée d'un
          coup de pédale (~1 s) pour éliminer les oscillations de couple. AeroProfile
          va plus loin avec une <strong>moyenne mobile centrée de 5 secondes</strong>.
          Ceci est cohérent avec l'hypothèse de quasi-stationnarité du modèle :
          le modèle prédit la puissance "à l'équilibre" pour une vitesse et une
          pente données, pas la puissance instantanée en plein sprint ou en
          micro-accélération.
        </P>
      </Section>

      <Section title="Comment AeroProfile utilise cette équation">
        <P>
          On connaît tout sauf <Tex>{String.raw`C_d A`}</Tex> et <Tex>{String.raw`C_{rr}`}</Tex> : la puissance est mesurée par votre
          capteur, la vitesse par le GPS, l'altitude par le baromètre, le vent
          par l'API météo, la densité de l'air par le calcul. Le solveur ajuste
          <Tex>{String.raw`C_d A`}</Tex> et <Tex>{String.raw`C_{rr}`}</Tex> jusqu'à ce que l'équation prédise au mieux la puissance
          mesurée :
        </P>
        <Formula>
          {String.raw`\min_{C_d A,\, C_{rr}} \sum_{i=1}^{N} \left( P_{\text{modèle}}(i) - P_{\text{mesuré}}(i) \right)^2`}
        </Formula>
      </Section>

      <Section title="Référence">
        <P>
          Martin JC, Milliken DL, Cobb JE, McFadden KL, Coggan AR. (1998).
          "Validation of a Mathematical Model for Road Cycling Power."
          <em> Journal of Applied Biomechanics</em>, 14(3), 276–291.
        </P>
        <P>
          Validé en laboratoire avec R² = 0.97 et une erreur de 2.7 W
          sur un vélodrome en conditions contrôlées.
        </P>
      </Section>
    </Article>
  );
}
