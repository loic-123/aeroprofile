import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function CdaWhatIsIt() {
  return (
    <Article title="CdA : qu'est-ce que c'est et pourquoi c'est important ?">
      <P>
        Le <Tex>{String.raw`C_dA`}</Tex> (prononcé "ce-de-a") est LE chiffre
        qui résume votre profil aérodynamique sur le vélo. Deux cyclistes de
        même puissance mais de <Tex>{String.raw`C_dA`}</Tex> différent n'iront
        pas à la même vitesse sur le plat — et la différence est énorme.
      </P>

      <Section title="Cd x A : deux composantes">
        <P>
          <Tex>{String.raw`C_dA`}</Tex> est le produit de deux grandeurs
          physiques :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong><Tex>{String.raw`C_d`}</Tex></strong> (coefficient de
            traînée) — un nombre sans unité qui décrit comment l'air s'écoule
            autour de vous. Une forme profilée donne
            un <Tex>{String.raw`C_d`}</Tex> bas ; une forme non profilée donne
            un <Tex>{String.raw`C_d`}</Tex> haut. Pour référence, une sphère
            lisse a <Tex>{String.raw`C_d \approx 0.47`}</Tex>, un profil
            d'aile <Tex>{String.raw`C_d \approx 0.04`}</Tex>, et un cycliste
            se situe typiquement autour
            de <Tex>{String.raw`C_d \approx 0.6 \text{--} 0.9`}</Tex>.
          </li>
          <li>
            <strong><Tex>{String.raw`A`}</Tex></strong> (surface frontale,
            en m²) — la surface que vous exposez au vent, vue de face. Plus vous
            êtes grand ou en position droite,
            plus <Tex>{String.raw`A`}</Tex> est grand. Pour un cycliste adulte,{" "}
            <Tex>{String.raw`A`}</Tex> varie
            de <Tex>{String.raw`\sim 0.35 \;\text{m}^2`}</Tex> (position CLM
            agressive) à <Tex>{String.raw`\sim 0.55 \;\text{m}^2`}</Tex>{" "}
            (position droite mains en haut).
          </li>
        </ul>
        <P>
          En pratique, on ne sépare jamais <Tex>{String.raw`C_d`}</Tex>{" "}
          et <Tex>{String.raw`A`}</Tex> : on mesure toujours le
          produit <Tex>{String.raw`C_dA`}</Tex>, en m². C'est ce qu'AeroProfile
          estime. Mathématiquement :
        </P>
        <Formula>{String.raw`C_dA = C_d \times A \quad [\text{m}^2]`}</Formula>
      </Section>

      <Section title="Ordres de grandeur">
        <P>
          Voici les valeurs typiques mesurées en soufflerie (Debraux et al.
          2011, Garcia-Lopez et al. 2008). La colonne "Watts" indique la
          puissance nécessaire pour vaincre la traînée aérodynamique seule
          à 40 km/h :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Position</th>
                <th className="py-2 text-right"><Tex>{String.raw`C_dA`}</Tex> (m²)</th>
                <th className="py-2 text-right">Watts @ 40 km/h</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5">CLM pro (Superman)</td><td className="text-right">0.17 – 0.20</td><td className="text-right text-teal">145 – 170</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">CLM amateur</td><td className="text-right">0.21 – 0.25</td><td className="text-right text-teal">179 – 213</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Route, mains en bas</td><td className="text-right">0.28 – 0.32</td><td className="text-right text-teal">239 – 273</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Route, cocottes</td><td className="text-right">0.32 – 0.38</td><td className="text-right text-teal">273 – 324</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Route, mains en haut</td><td className="text-right">0.38 – 0.45</td><td className="text-right text-teal">324 – 384</td></tr>
              <tr><td className="py-1.5">VTT / ville</td><td className="text-right">0.45 – 0.55</td><td className="text-right text-teal">384 – 469</td></tr>
            </tbody>
          </table>
        </div>
        <Note>
          Ces valeurs correspondent à des conditions d'air calme
          (<Tex>{String.raw`\text{yaw} = 0°`}</Tex>). En conditions réelles
          avec du vent latéral, le <Tex>{String.raw`C_dA`}</Tex> effectif peut
          être 5 à 15% plus élevé (voir l'article sur le yaw).
        </Note>
      </Section>

      <Section title="Pourquoi 0.01 de CdA compte">
        <P>
          La force de traînée aérodynamique
          est <Tex>{String.raw`F_{\text{aero}} = \tfrac{1}{2} \, C_dA \, \rho \, V^2`}</Tex>,
          et la puissance nécessaire pour vaincre cette force
          est <Tex>{String.raw`P_{\text{aero}} = F_{\text{aero}} \times V`}</Tex>,
          soit :
        </P>
        <Formula>{String.raw`P_{\text{aero}} = \frac{1}{2} \, C_dA \, \rho \, V^3`}</Formula>
        <P>
          La puissance croît avec le <strong>cube</strong> de la vitesse. Un
          petit changement de <Tex>{String.raw`C_dA`}</Tex> a un impact
          disproportionné à haute vitesse. À 40 km/h
          (<Tex>{String.raw`V = 11.11 \;\text{m/s}`}</Tex>) avec une masse
          volumique standard <Tex>{String.raw`\rho = 1.2 \;\text{kg/m}^3`}</Tex> :
        </P>
        <Formula>{String.raw`\Delta P = \frac{1}{2} \times \Delta C_dA \times \rho \times V^3 = \frac{1}{2} \times \Delta C_dA \times 1.2 \times 11.11^3 \approx 823 \times \Delta C_dA`}</Formula>
        <P>
          Donc <Tex>{String.raw`\Delta C_dA = 0.01 \;\text{m}^2`}</Tex>{" "}
          correspond à environ <strong>8.2 W</strong> d'économie, soit
          ~0.4 km/h plus vite à même puissance.
        </P>
        <P>
          Sur un contre-la-montre de 40 km, 0.01
          de <Tex>{String.raw`C_dA`}</Tex> représente ~20 secondes. Sur un
          triathlon Ironman (180 km vélo), c'est ~2 minutes.
        </P>
      </Section>

      <Section title="D'où vient la formule physique ?">
        <P>
          Le modèle d'équilibre des forces sur le plat s'écrit :
        </P>
        <Formula>{String.raw`P \cdot \eta = \underbrace{\frac{1}{2} \, C_dA \, \rho \, V_{\text{air}}^2 \cdot V}_{\text{trainee aero}} + \underbrace{C_{rr} \, m \, g \, V}_{\text{resistance roulement}} + \underbrace{m \, g \, \sin(\theta) \, V}_{\text{gravite}} + \underbrace{m \, \frac{dV}{dt} \, V}_{\text{acceleration}}`}</Formula>
        <P>
          où <Tex>{String.raw`\eta`}</Tex> est le rendement de la transmission
          (~0.97), <Tex>{String.raw`C_{rr}`}</Tex> le coefficient de résistance
          au roulement, <Tex>{String.raw`m`}</Tex> la masse totale (cycliste +
          vélo), <Tex>{String.raw`\theta`}</Tex> la pente, et{" "}
          <Tex>{String.raw`V_{\text{air}}`}</Tex> la vitesse de l'air relatif.
          C'est cette équation qu'AeroProfile résout par moindres carrés pour
          estimer <Tex>{String.raw`C_dA`}</Tex>{" "}
          et <Tex>{String.raw`C_{rr}`}</Tex>.
        </P>
      </Section>

      <Section title="Comment améliorer son CdA">
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Position</strong> — le levier le plus puissant. Baisser la
            tête, rentrer les coudes, aplatir le dos. Peut
            valoir <Tex>{String.raw`\Delta C_dA \approx -0.04`}</Tex> à lui
            seul.
          </li>
          <li>
            <strong>Casque aéro</strong>{" "}
            — <Tex>{String.raw`\Delta C_dA \approx -0.01 \text{ a } {-0.02}`}</Tex>{" "}
            vs un casque route ventilé.
          </li>
          <li>
            <strong>Combinaison/vêtements ajustés</strong> — un maillot qui
            flotte peut ajouter <Tex>{String.raw`+0.01 \;\text{m}^2`}</Tex>{" "}
            de <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Roues profilées</strong>{" "}
            — <Tex>{String.raw`\Delta C_dA \approx -0.005 \text{ a } {-0.015}`}</Tex>{" "}
            selon le profil de jante.
          </li>
          <li>
            <strong>Position des mains</strong> — drops vs hoods
            = <Tex>{String.raw`\Delta C_dA \approx -0.04`}</Tex>.
          </li>
        </ul>
      </Section>

      <Section title="W/CdA : la métrique des rouleurs">
        <P>
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> est l'analogue aéro
          du <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> pour les grimpeurs. C'est
          le ratio qui détermine votre vitesse sur le plat. En négligeant le
          roulement et la pente :
        </P>
        <Formula>{String.raw`V_{\text{plat}} \approx \left( \frac{2 \, P}{C_dA \cdot \rho} \right)^{1/3} = \left( \frac{2 \cdot W\!/\!C_dA}{\rho} \right)^{1/3}`}</Formula>
        <P>
          Exemple : 200 W avec <Tex>{String.raw`C_dA = 0.32`}</Tex>{" "}
          et <Tex>{String.raw`\rho = 1.2`}</Tex> :
        </P>
        <Formula>{String.raw`\frac{W}{C_dA} = \frac{200}{0.32} = 625 \qquad \Rightarrow \qquad V = \left(\frac{2 \times 625}{1.2}\right)^{1/3} = 10.09 \;\text{m/s} \approx 36.3 \;\text{km/h}`}</Formula>
      </Section>
    </Article>
  );
}
