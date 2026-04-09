import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function DraftingDetection() {
  return (
    <Article title="Détection du drafting : quand rouler en groupe fausse le CdA">
      <P>
        Le drafting (rouler dans le sillage d'un autre cycliste) est le plus
        gros biais que le modèle rencontre sur les sorties en groupe. Derrière
        un coéquipier, la traînée aérodynamique chute de 30 à 40%. Résultat :
        le <Tex>{String.raw`C_dA`}</Tex> apparent est artificiellement bas — ce
        qui ne reflète pas votre position, mais le fait que vous étiez abrité.
      </P>

      <Section title="Physique du drafting">
        <P>
          Dans le sillage d'un cycliste devant vous, l'air est déjà perturbé :
          la dépression créée derrière lui "aspire" celui qui suit. Votre
          capteur de puissance mesure moins de watts pour la même vitesse.
        </P>
        <P>
          La réduction de traînée dépend de l'espacement entre les deux
          cyclistes. Blocken et al. (2018) ont mesuré par CFD :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Espacement</th>
                <th className="py-2 text-right">Réduction de traînée</th>
                <th className="py-2 text-right"><Tex>{String.raw`C_dA`}</Tex> apparent</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="font-sans">15 cm (roue dans roue)</td><td className="text-right">-40%</td><td className="text-right"><Tex>{String.raw`0.60 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">0.5 m</td><td className="text-right">-35%</td><td className="text-right"><Tex>{String.raw`0.65 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">1 m</td><td className="text-right">-27%</td><td className="text-right"><Tex>{String.raw`0.73 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">2 m</td><td className="text-right">-18%</td><td className="text-right"><Tex>{String.raw`0.82 \times C_dA_0`}</Tex></td></tr>
              <tr><td className="font-sans">5 m</td><td className="text-right">-5%</td><td className="text-right"><Tex>{String.raw`0.95 \times C_dA_0`}</Tex></td></tr>
            </tbody>
          </table>
        </div>

        <P>
          Le modèle physique, lui, ne sait pas que vous êtes dans un sillage.
          Il voit : "ce cycliste produit 120 W à 35 km/h sur le
          plat → son <Tex>{String.raw`C_dA`}</Tex> doit être très bas". Il
          attribue la réduction de puissance à
          un <Tex>{String.raw`C_dA`}</Tex> faible au lieu de la réduction de
          vent apparent.
        </P>
        <P>
          Quantitativement, à 35 km/h
          (<Tex>{String.raw`V = 9.72 \;\text{m/s}`}</Tex>) avec{" "}
          <Tex>{String.raw`C_dA = 0.32`}</Tex>{" "}
          et <Tex>{String.raw`\rho = 1.2`}</Tex> :
        </P>
        <Formula>{String.raw`P_{\text{aero}} = \frac{1}{2} \times C_dA \times \rho \times V^3 = \frac{1}{2} \times 0.32 \times 1.2 \times 9.72^3 \approx 176 \;\text{W}`}</Formula>
        <P>
          En draft à -35% de traînée :
        </P>
        <Formula>{String.raw`P_{\text{draft}} = 176 \times 0.65 = 114 \;\text{W}`}</Formula>
        <Formula>{String.raw`C_dA_{\text{apparent}} = C_dA \times 0.65 = 0.32 \times 0.65 = 0.208`}</Formula>
        <P>
          Le cycliste semble avoir un <Tex>{String.raw`C_dA`}</Tex> de pro en
          CLM alors qu'il est juste dans la roue de quelqu'un.
        </P>
      </Section>

      <Section title="Comment AeroProfile détecte le drafting">
        <P>
          À chaque point de la sortie, AeroProfile calcule
          un <Tex>{String.raw`C_dA`}</Tex> instantané :
        </P>
        <Formula>{String.raw`C_dA_{\text{inst}} = \frac{P \cdot \eta - P_{\text{roul}} - P_{\text{grav}} - P_{\text{accel}}}{\frac{1}{2} \, \rho \, V_{\text{air}}^2 \cdot V}`}</Formula>
        <P>
          où chaque composante de puissance est calculée à partir du modèle de
          Martin et al. (1998). La détection s'active quand trois conditions
          sont remplies <strong>simultanément</strong> :
        </P>
        <ul className="list-decimal ml-6 space-y-1 text-text">
          <li>
            <Tex>{String.raw`V > 8 \;\text{m/s}`}</Tex> (29 km/h) — vitesse
            suffisante pour que l'aérodynamique domine.
          </li>
          <li>
            <Tex>{String.raw`|\text{gradient}| < 2\%`}</Tex> — terrain plat
            (pas de composante gravitaire dominante qui fausserait le calcul).
          </li>
          <li>
            <Tex>{String.raw`P > 100 \;\text{W}`}</Tex> — le cycliste pédale
            activement (pas en roue libre).
          </li>
        </ul>
        <P>
          Si <Tex>{String.raw`C_dA_{\text{inst}} < 0.12`}</Tex>, la valeur est
          physiquement impossible en solo (même un pro en CLM est
          à <Tex>{String.raw`C_dA \geq 0.17`}</Tex>). Ce point est donc
          marqué comme "en draft".
        </P>
        <P>
          De plus, le bloc de drafting doit durer <strong>au moins 30
          secondes consécutives</strong>. Un seul point
          à <Tex>{String.raw`C_dA_{\text{inst}} = 0.10`}</Tex> peut être un
          artefact (erreur GPS, pic de vent). Mais 30 secondes consécutives
          avec des valeurs aussi basses = certainement dans un sillage.
        </P>
      </Section>

      <Section title="En mode comparaison : détection entre cyclistes">
        <P>
          Quand deux cyclistes roulent ensemble (même sortie, même jour),
          AeroProfile détecte si les résultats sont biaisés par le drafting
          asymétrique :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            Si les vitesses moyennes sont similaires
            (<Tex>{String.raw`\pm 5\%`}</Tex>)...
          </li>
          <li>
            ...mais les <Tex>{String.raw`C_dA`}</Tex> diffèrent de plus de 15%...
          </li>
          <li>
            → Le cycliste au <Tex>{String.raw`C_dA`}</Tex> bas a probablement
            "sucé la roue" du cycliste
            au <Tex>{String.raw`C_dA`}</Tex> haut.
          </li>
        </ul>
        <P>
          Un bandeau orange nomme explicitement qui a drafté et qui a tiré.
        </P>
      </Section>

      <Section title="Modélisation alternative : facteur de sillage">
        <P>
          Une approche plus sophistiquée consiste à modéliser le drafting comme
          un facteur multiplicatif <Tex>{String.raw`\delta`}</Tex> sur la
          traînée aérodynamique :
        </P>
        <Formula>{String.raw`P_{\text{aero,draft}} = \delta \cdot \frac{1}{2} \, C_dA \, \rho \, V_{\text{air}}^2 \cdot V \qquad \text{avec } \delta \in [0.6,\; 1.0]`}</Formula>
        <P>
          Mais sans information sur la position relative des cyclistes dans le
          groupe, <Tex>{String.raw`\delta`}</Tex> est inobservable. AeroProfile
          choisit donc une approche pragmatique : détecter et exclure plutôt
          que modéliser.
        </P>
      </Section>

      <Section title="Que faire si votre sortie est en groupe ?">
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li>
            <strong>Sortie solo</strong> : le meilleur scénario. Aucun drafting,{" "}
            <Tex>{String.raw`C_dA`}</Tex> fiable.
          </li>
          <li>
            <strong>Relais égaux</strong> : si les deux cyclistes tirent autant
            l'un que l'autre, les artefacts de drafting se compensent en
            moyenne. Le <Tex>{String.raw`C_dA`}</Tex> agrégé sur plusieurs
            sorties convergera vers la bonne valeur.
          </li>
          <li>
            <strong>Un seul tire</strong> : le tireur aura
            un <Tex>{String.raw`C_dA`}</Tex> correct (il est dans le vent), le
            suiveur un <Tex>{String.raw`C_dA`}</Tex> sous-estimé. Utilisez
            le <Tex>{String.raw`C_dA`}</Tex> du tireur comme référence.
          </li>
          <li>
            <strong>Peloton / cyclosportive</strong> :{" "}
            le <Tex>{String.raw`C_dA`}</Tex> est inutilisable. AeroProfile le
            signale avec un nRMSE très élevé et exclut la ride de la moyenne.
          </li>
        </ul>
        <Warning>
          Le filtre anti-drafting
          (<Tex>{String.raw`C_dA_{\text{inst}} < 0.12`}</Tex>) est
          conservateur — il ne détecte que le drafting très marqué (30-40% de
          réduction). Un cycliste à 1-2 mètres derrière un autre bénéficie
          de ~15-20% de réduction, ce qui peut passer sous le radar du filtre.
        </Warning>
      </Section>

      <Section title="Références">
        <P>
          Blocken et al. (2018). "Aerodynamic drag in cycling pelotons."{" "}
          <em>Journal of Wind Engineering and Industrial Aerodynamics</em>.
          Mesures CFD montrant -27% à -40% de traînée pour le 2ème rider
          selon l'espacement. Barry et al. (2015) pour les mesures
          expérimentales en soufflerie.
        </P>
      </Section>
    </Article>
  );
}
