import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function YawAngle() {
  return (
    <Article title="L'angle de yaw : pourquoi le vent de côté change votre CdA">
      <P>
        Quand vous roulez, l'air ne vient pas toujours pile de face. S'il y a
        du vent latéral, l'air apparent arrive en biais — c'est l'angle de
        yaw (<Tex>{String.raw`\beta`}</Tex>). Et un cycliste n'offre pas la
        même résistance à l'air selon que le flux vient de face ou de côté.
      </P>

      <Section title="Définition et calcul du yaw">
        <P>
          Le yaw est l'angle entre votre direction de déplacement et la
          direction du <strong>vent apparent</strong>, c'est-à-dire la
          combinaison vectorielle de votre vitesse sol et du vent
          météorologique réel.
        </P>
        <P>
          On décompose le vent réel en deux composantes par rapport à votre
          direction de route (bearing GPS) :
        </P>
        <Formula>{String.raw`V_{\text{long}} = V_{\text{sol}} + V_{\text{vent}} \cdot \cos(\theta_{\text{vent}} - \theta_{\text{bearing}})`}</Formula>
        <Formula>{String.raw`V_{\text{lat}} = V_{\text{vent}} \cdot \sin(\theta_{\text{vent}} - \theta_{\text{bearing}})`}</Formula>
        <P>
          L'angle de yaw est alors :
        </P>
        <Formula>{String.raw`\beta = \arctan\!\left(\frac{|V_{\text{lat}}|}{|V_{\text{long}}|}\right)`}</Formula>
        <P>
          Et la vitesse de l'air apparent (celle qui génère la traînée) est la
          norme du vecteur résultant :
        </P>
        <Formula>{String.raw`V_{\text{air}} = \sqrt{V_{\text{long}}^2 + V_{\text{lat}}^2}`}</Formula>

        <P>
          Quelques exemples concrets
          à <Tex>{String.raw`V_{\text{sol}} = 30 \;\text{km/h}`}</Tex> avec un
          vent de 10 km/h :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Direction du vent</th>
                <th className="py-2 text-right">Yaw (<Tex>{String.raw`\beta`}</Tex>)</th>
                <th className="py-2 text-right"><Tex>{String.raw`V_{\text{air}}`}</Tex></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Vent de face pur</td><td className="text-right">0°</td><td className="text-right">40 km/h</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Vent à 45°</td><td className="text-right">~4°</td><td className="text-right">~38 km/h</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Vent latéral pur (90°)</td><td className="text-right">~10°</td><td className="text-right">~32 km/h</td></tr>
              <tr><td className="py-1.5 font-sans">Vent de dos pur</td><td className="text-right">0°</td><td className="text-right">20 km/h</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Impact sur le CdA">
        <P>
          Les mesures en soufflerie (Crouch, Burton et al. 2014 ; Barry et al.
          2015) montrent que le <Tex>{String.raw`C_dA`}</Tex> augmente avec le
          yaw, de façon approximativement quadratique. AeroProfile utilise le
          modèle suivant :
        </P>
        <Formula>{String.raw`C_dA_{\text{eff}} = C_dA_0 \times \bigl(1 + k \cdot \beta^2\bigr)`}</Formula>
        <P>
          où <Tex>{String.raw`C_dA_0`}</Tex> est votre{" "}
          <Tex>{String.raw`C_dA`}</Tex> en air calme (yaw = 0°),{" "}
          <Tex>{String.raw`\beta`}</Tex> l'angle de yaw en degrés,
          et <Tex>{String.raw`k`}</Tex> un coefficient calibré sur données
          soufflerie :
        </P>
        <Formula>{String.raw`k = 5 \times 10^{-4} \;\text{deg}^{-2}`}</Formula>

        <P>Numériquement, voici l'effet à différents angles :</P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Yaw (<Tex>{String.raw`\beta`}</Tex>)</th>
                <th className="py-2 text-right">Facteur multiplicatif</th>
                <th className="py-2 text-right">Augmentation du <Tex>{String.raw`C_dA`}</Tex></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td>0°</td><td className="text-right">1.000</td><td className="text-right text-muted">+0%</td></tr>
              <tr className="border-b border-border/30"><td>5°</td><td className="text-right">1.013</td><td className="text-right text-muted">+1.3%</td></tr>
              <tr className="border-b border-border/30"><td>10°</td><td className="text-right">1.050</td><td className="text-right text-muted">+5.0%</td></tr>
              <tr className="border-b border-border/30"><td>15°</td><td className="text-right">1.113</td><td className="text-right text-muted">+11.3%</td></tr>
              <tr><td>20°</td><td className="text-right">1.200</td><td className="text-right text-muted">+20.0%</td></tr>
            </tbody>
          </table>
        </div>
        <P>
          En pratique, le yaw moyen sur une sortie route est de 5-10° selon
          les conditions de vent, ce qui correspond à +1% à +5%
          de <Tex>{String.raw`C_dA`}</Tex> effectif par rapport
          au <Tex>{String.raw`C_dA`}</Tex> en air calme.
        </P>
      </Section>

      <Section title="Pourquoi le yaw augmente le CdA">
        <P>
          Plusieurs mécanismes physiques expliquent cette augmentation :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Surface frontale asymétrique</strong> — Le corps du cycliste
            vu de côté expose plus de surface qu'en face (bras, jambes, torse
            asymétriques). La surface frontale effective augmente
            avec <Tex>{String.raw`\beta`}</Tex>.
          </li>
          <li>
            <strong>Décollement asymétrique</strong> — L'écoulement d'air se
            sépare de façon asymétrique, créant plus de turbulences dans le
            sillage et une zone de dépression plus large derrière le cycliste.
          </li>
          <li>
            <strong>Effet voile des roues</strong> — Les roues à profil haut
            agissent comme des voiles : elles ajoutent de la traînée latérale
            qui se projette partiellement dans la direction du mouvement.
          </li>
          <li>
            <strong>Perturbations du casque et des bidons</strong> — Le casque,
            le cadre et les bidons créent des perturbations différentes selon
            l'angle d'incidence.
          </li>
        </ul>
      </Section>

      <Section title="Ce que fait AeroProfile">
        <P>
          <strong>Sans la correction yaw</strong> : le solveur estime
          un <Tex>{String.raw`C_dA`}</Tex> "moyen" qui mélange votre aéro
          intrinsèque et l'effet du vent latéral. Si la sortie est venteuse
          avec beaucoup de crosswind,
          le <Tex>{String.raw`C_dA`}</Tex> reporté est gonflé.
        </P>
        <P>
          <strong>Avec la correction yaw</strong> : à chaque point, le modèle
          calcule <Tex>{String.raw`\beta`}</Tex> depuis le vent (réel ou
          estimé) et le bearing GPS, puis applique le facteur multiplicatif :
        </P>
        <Formula>{String.raw`C_dA_{\text{eff}}(t) = C_dA_0 \times \bigl(1 + k \cdot \beta(t)^2\bigr)`}</Formula>
        <P>
          Le solveur estime <Tex>{String.raw`C_dA_0`}</Tex> — votre{" "}
          <Tex>{String.raw`C_dA`}</Tex> en air calme, indépendant du vent du
          jour. C'est une propriété de votre <em>position</em> et de
          votre <em>équipement</em>, pas des conditions météo.
        </P>
        <Note>
          Dans le wind-inverse solver, le yaw est recalculé à chaque itération
          car le vent lui-même est estimé conjointement. Vent
          change → <Tex>{String.raw`\beta`}</Tex>{" "}
          change → <Tex>{String.raw`C_dA_{\text{eff}}`}</Tex>{" "}
          change → résidu change. Le solveur converge vers un
          triplet <Tex>{String.raw`(C_dA_0,\; C_{rr},\; \vec{V}_{\text{vent}})`}</Tex>{" "}
          cohérent.
        </Note>
      </Section>

      <Section title="Implications pratiques">
        <P>
          Quelques conséquences directes de la correction yaw :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Comparabilité</strong> — Deux sorties faites par des jours
            de vent différents donneront
            un <Tex>{String.raw`C_dA_0`}</Tex> comparable, contrairement
            au <Tex>{String.raw`C_dA`}</Tex> brut.
          </li>
          <li>
            <strong>Test A/B fiable</strong> — Vous pouvez comparer deux
            positions ou deux équipements même si le vent n'était pas
            identique entre les tests.
          </li>
          <li>
            <strong>Cohérence soufflerie</strong> — Le{" "}
            <Tex>{String.raw`C_dA_0`}</Tex> reporté est ce que vous mesureriez
            en soufflerie à 0° de yaw.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
