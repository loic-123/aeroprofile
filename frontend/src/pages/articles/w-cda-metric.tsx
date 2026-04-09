import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function WCdaMetric() {
  return (
    <Article title="W/CdA : la métrique des rouleurs (l'analogue du W/kg)">
      <P>
        Tout le monde connaît le <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> — la
        puissance rapportée au poids, qui détermine la vitesse en montée. Mais
        sur le plat, le poids ne compte presque pas. Ce qui compte, c'est
        le <strong><Tex>{String.raw`W\!/\!C_dA`}</Tex></strong> : la puissance
        rapportée à la traînée aérodynamique.
      </P>

      <Section title="La physique">
        <P>
          Sur le plat, à haute vitesse, la puissance sert presque exclusivement
          à vaincre l'air. L'équilibre des forces se simplifie à :
        </P>
        <Formula>{String.raw`P \approx \frac{1}{2} \, C_dA \, \rho \, V^3`}</Formula>
        <P>
          En isolant <Tex>{String.raw`V`}</Tex> :
        </P>
        <Formula>{String.raw`V \approx \left(\frac{2P}{C_dA \cdot \rho}\right)^{\!1/3}`}</Formula>
        <P>
          On peut factoriser
          le <Tex>{String.raw`W\!/\!C_dA`}</Tex> (qui est le ratio puissance
          sur traînée, en <Tex>{String.raw`\text{W/m}^2`}</Tex>) :
        </P>
        <Formula>{String.raw`V \approx \left(\frac{2 \cdot (W\!/\!C_dA)}{\rho}\right)^{\!1/3}`}</Formula>
        <P>
          Plus <Tex>{String.raw`W\!/\!C_dA`}</Tex> est élevé, plus{" "}
          <Tex>{String.raw`V`}</Tex> est élevé. C'est la métrique unique qui
          prédit votre vitesse sur le plat.
        </P>
        <Note>
          La relation est en puissance 1/3 : doubler
          son <Tex>{String.raw`W\!/\!C_dA`}</Tex> n'augmente la vitesse que
          de <Tex>{String.raw`2^{1/3} \approx 26\%`}</Tex>. C'est pourquoi
          les gains marginaux en aéro sont si précieux à haut niveau.
        </Note>
      </Section>

      <Section title="W/CdA vs W/kg : deux mondes différents">
        <P>
          En montée, la gravité domine et la vitesse dépend
          de <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> :
        </P>
        <Formula>{String.raw`V_{\text{montee}} \approx \frac{P}{m \, g \, \sin(\theta)} \propto \frac{W}{\text{kg}}`}</Formula>
        <P>
          Sur le plat, l'aérodynamique domine et la vitesse dépend
          de <Tex>{String.raw`W\!/\!C_dA`}</Tex> :
        </P>
        <Formula>{String.raw`V_{\text{plat}} \approx \left(\frac{2 \cdot W\!/\!C_dA}{\rho}\right)^{\!1/3}`}</Formula>
        <P>
          Un grimpeur léger a un excellent <Tex>{String.raw`W\!/\!\text{kg}`}</Tex>{" "}
          mais peut avoir un <Tex>{String.raw`W\!/\!C_dA`}</Tex> médiocre (peu
          de watts absolus). Un rouleur lourd et puissant peut avoir
          un <Tex>{String.raw`W\!/\!C_dA`}</Tex> excellent malgré
          un <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> modeste.
        </P>
      </Section>

      <Section title="Tableau de correspondance">
        <P>
          Valeurs calculées
          à <Tex>{String.raw`\rho = 1.2 \;\text{kg/m}^3`}</Tex> (niveau de
          la mer, 15°C), sans vent, sur le plat :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2"><Tex>{String.raw`W\!/\!C_dA`}</Tex></th>
                <th className="py-2">Vitesse plat</th>
                <th className="py-2">Profil type</th>
                <th className="py-2 text-muted">Exemple</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td>300</td><td>33.2 km/h</td><td className="font-sans text-muted">Cycliste récréatif</td><td className="font-sans text-muted text-xs">100 W / 0.33</td></tr>
              <tr className="border-b border-border/30"><td>400</td><td>36.5 km/h</td><td className="font-sans text-muted">Bon amateur endurance</td><td className="font-sans text-muted text-xs">140 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>500</td><td>39.3 km/h</td><td className="font-sans text-muted">Amateur compétiteur</td><td className="font-sans text-muted text-xs">175 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>600</td><td>41.7 km/h</td><td className="font-sans text-muted">Coureur régional</td><td className="font-sans text-muted text-xs">210 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>700</td><td>43.9 km/h</td><td className="font-sans text-muted">Rouleur pro continental</td><td className="font-sans text-muted text-xs">210 W / 0.30</td></tr>
              <tr className="border-b border-border/30"><td>900</td><td>47.7 km/h</td><td className="font-sans text-muted">CLM pro</td><td className="font-sans text-muted text-xs">300 W / 0.33 ou 180 W / 0.20</td></tr>
              <tr><td>1200</td><td>52.6 km/h</td><td className="font-sans text-muted">Record de l'heure</td><td className="font-sans text-muted text-xs">400 W / 0.20 (Campenaerts)</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Sensibilité : W vs CdA">
        <P>
          À quel point chaque levier affecte-t-il la vitesse ? On peut
          calculer les élasticités. Puisque{" "}
          <Tex>{String.raw`V \propto P^{1/3} \cdot C_dA^{-1/3}`}</Tex> :
        </P>
        <Formula>{String.raw`\frac{\Delta V}{V} \approx \frac{1}{3} \cdot \frac{\Delta P}{P} \approx -\frac{1}{3} \cdot \frac{\Delta C_dA}{C_dA}`}</Formula>
        <P>
          Les deux leviers ont le même poids relatif (facteur 1/3). Mais en
          pratique :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            Gagner <Tex>{String.raw`+10\%`}</Tex> de puissance demande des
            mois d'entraînement intensif.
          </li>
          <li>
            Réduire son <Tex>{String.raw`C_dA`}</Tex>{" "}
            de <Tex>{String.raw`10\%`}</Tex> est possible en une séance de
            bike-fit (position drops, casque aéro, combinaison).
          </li>
        </ul>
        <P>
          À même pourcentage, le gain aéro est "gratuit" en termes d'effort.
        </P>
      </Section>

      <Section title="Comment améliorer son W/CdA">
        <P>
          Deux leviers :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Augmenter W</strong> — entraînement, FTP, nutrition. Le
            plus dur mais le plus universel.
          </li>
          <li>
            <strong>Diminuer <Tex>{String.raw`C_dA`}</Tex></strong> — position,
            équipement, casque aéro, combinaison. Gains "gratuits" en watts
            équivalents.
          </li>
        </ul>
        <P>
          Exemple concret : un cycliste à 200 W
          et <Tex>{String.raw`C_dA = 0.35`}</Tex>{" "}
          a <Tex>{String.raw`W\!/\!C_dA = 571`}</Tex> → 40.0 km/h. S'il passe
          en drops (<Tex>{String.raw`C_dA = 0.30`}</Tex>) sans gagner un
          watt : <Tex>{String.raw`W\!/\!C_dA = 667`}</Tex> → 43.2 km/h. C'est
          +3.2 km/h gratuits, juste en changeant de position.
        </P>
        <Formula>{String.raw`\Delta V = \left(\frac{2 \times 667}{1.2}\right)^{\!1/3} - \left(\frac{2 \times 571}{1.2}\right)^{\!1/3} = 12.0 - 11.1 = 0.9 \;\text{m/s} \approx 3.2 \;\text{km/h}`}</Formula>
        <Note>
          Le <Tex>{String.raw`W\!/\!C_dA`}</Tex> est affiché dans les modes
          "Analyse" et "Intervals.icu" quand plusieurs sorties sont analysées.
          Il est calculé comme la puissance moyenne pondérée par le temps
          divisé par le <Tex>{String.raw`C_dA`}</Tex> moyen pondéré.
        </Note>
      </Section>

      <Section title="Impact de la densité de l'air">
        <P>
          La densité <Tex>{String.raw`\rho`}</Tex> intervient dans la formule.
          Elle varie avec l'altitude, la température et la pression
          atmosphérique :
        </P>
        <Formula>{String.raw`\rho = \frac{p}{R_{\text{air}} \cdot T} \approx \frac{p}{287.05 \cdot T}`}</Formula>
        <P>
          À altitude élevée (ex. Mexico,
          2250 m, <Tex>{String.raw`\rho \approx 0.98`}</Tex>), la vitesse
          pour un même <Tex>{String.raw`W\!/\!C_dA`}</Tex> est plus élevée
          de <Tex>{String.raw`\sim 7\%`}</Tex> par rapport au niveau de la
          mer. C'est pourquoi les records de l'heure sont souvent tentés en
          altitude.
        </P>
      </Section>
    </Article>
  );
}
