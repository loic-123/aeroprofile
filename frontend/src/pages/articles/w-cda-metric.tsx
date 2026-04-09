import { Article, Section, Formula, Note, P } from "../../components/BlogLayout";

export default function WCdaMetric() {
  return (
    <Article title="W/CdA : la métrique des rouleurs (l'analogue du W/kg)">
      <P>
        Tout le monde connaît le W/kg — la puissance rapportée au poids,
        qui détermine la vitesse en montée. Mais sur le plat, le poids ne
        compte presque pas. Ce qui compte, c'est le <strong>W/CdA</strong> :
        la puissance rapportée à la traînée aérodynamique.
      </P>

      <Section title="La physique">
        <P>
          Sur le plat, à haute vitesse, la puissance sert presque exclusivement
          à vaincre l'air. La vitesse dépend de la puissance ET du CdA :
        </P>
        <Formula>
          {"P ≈ 0.5 × CdA × ρ × V³\n\n" +
           "Donc : V ≈ (2P / (CdA × ρ))^(1/3)\n\n" +
           "En regroupant : V ≈ (2 × W/CdA / ρ)^(1/3)\n\n" +
           "Plus W/CdA est élevé → plus V est élevé."}
        </Formula>
      </Section>

      <Section title="Tableau de correspondance">
        <P>
          Valeurs calculées à ρ = 1.2 kg/m³ (niveau de la mer, 15°C),
          sans vent, sur le plat :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">W/CdA</th>
                <th className="py-2">Vitesse plat</th>
                <th className="py-2">Profil type</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td>300</td><td>33.2 km/h</td><td className="font-sans text-muted">Cycliste récréatif</td></tr>
              <tr className="border-b border-border/30"><td>400</td><td>36.5 km/h</td><td className="font-sans text-muted">Bon amateur endurance</td></tr>
              <tr className="border-b border-border/30"><td>500</td><td>39.3 km/h</td><td className="font-sans text-muted">Amateur compétiteur</td></tr>
              <tr className="border-b border-border/30"><td>600</td><td>41.7 km/h</td><td className="font-sans text-muted">Coureur régional</td></tr>
              <tr className="border-b border-border/30"><td>700</td><td>43.9 km/h</td><td className="font-sans text-muted">Rouleur pro continental</td></tr>
              <tr className="border-b border-border/30"><td>900</td><td>47.7 km/h</td><td className="font-sans text-muted">CLM pro (300W, CdA=0.20)</td></tr>
              <tr><td>1200</td><td>52.6 km/h</td><td className="font-sans text-muted">Record de l'heure</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Comment améliorer son W/CdA">
        <P>
          Deux leviers :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li><strong>Augmenter W</strong> — entraînement, FTP, nutrition. Le plus dur mais le plus universel.</li>
          <li><strong>Diminuer CdA</strong> — position, équipement, casque aéro, combinaison. Gains "gratuits" en watts.</li>
        </ul>
        <P>
          Exemple concret : un cycliste à 200W et CdA=0.35 a W/CdA=571 → 40.0 km/h.
          S'il passe en drops (CdA=0.30) sans gagner un watt : W/CdA=667 → 43.2 km/h.
          C'est +3.2 km/h gratuits, juste en changeant de position.
        </P>
        <Note>
          Le W/CdA est affiché dans les modes "Analyse" et "Intervals.icu"
          quand plusieurs sorties sont analysées. Il est calculé comme la
          puissance moyenne pondérée / CdA moyen pondéré.
        </Note>
      </Section>
    </Article>
  );
}
