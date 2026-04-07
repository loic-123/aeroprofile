import { Article, Section, Formula, Note, P } from "../../components/BlogLayout";

export default function CdaWhatIsIt() {
  return (
    <Article title="CdA : qu'est-ce que c'est et pourquoi c'est important ?">
      <P>
        Le CdA (prononcé "cé-dé-a") est LE chiffre qui résume votre profil
        aérodynamique sur le vélo. Deux cyclistes de même puissance mais de CdA
        différent n'iront pas à la même vitesse sur le plat — et la différence
        est énorme.
      </P>

      <Section title="Cd × A : deux composantes">
        <P>
          CdA est le produit de deux choses :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Cd</strong> (coefficient de traînée) — un nombre sans unité
            qui décrit comment l'air s'écoule autour de vous. Forme profilée =
            Cd bas. Forme non profilée = Cd haut.
          </li>
          <li>
            <strong>A</strong> (surface frontale, en m²) — la surface que vous
            exposez au vent, vue de face. Plus vous êtes grand ou en position
            droite, plus A est grand.
          </li>
        </ul>
        <P>
          En pratique, on ne sépare jamais Cd et A : on mesure toujours le
          produit CdA, en m². C'est ce qu'AeroProfile estime.
        </P>
      </Section>

      <Section title="Ordres de grandeur">
        <P>Voici les valeurs typiques mesurées en soufflerie (Debraux et al. 2011) :</P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Position</th>
                <th className="py-2 text-right">CdA (m²)</th>
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
      </Section>

      <Section title="Pourquoi 0.01 de CdA compte">
        <P>
          La force aérodynamique croît avec le carré de la vitesse et la
          puissance avec le cube. Un petit changement de CdA a un impact
          disproportionné à haute vitesse :
        </P>
        <Formula>
          {"À 40 km/h, ρ = 1.2 :\n" +
           "ΔP = 0.5 × ΔCDA × 1.2 × 11.11³ = 821 × ΔCDA\n\n" +
           "Donc 0.01 de CdA en moins = 8.2 W de moins\n" +
           "Soit ~0.4 km/h plus vite à même puissance."}
        </Formula>
        <P>
          Sur un contre-la-montre de 40 km, 0.01 de CdA = ~20 secondes.
          Sur un triathlon Ironman (180 km vélo), c'est ~2 minutes.
        </P>
      </Section>

      <Section title="Comment améliorer son CdA">
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li><strong>Position</strong> — le levier le plus puissant. Baisser la tête, rentrer les coudes, aplatir le dos.</li>
          <li><strong>Casque aéro</strong> — -0.01 à -0.02 CdA vs un casque route</li>
          <li><strong>Combinaison/vêtements ajustés</strong> — un maillot qui flotte = +0.01 CdA</li>
          <li><strong>Roues profilées</strong> — -0.005 à -0.015 CdA selon le profil</li>
          <li><strong>Position des mains</strong> — drops vs hoods = -0.04 CdA environ</li>
        </ul>
      </Section>

      <Section title="W/CdA : la métrique des rouleurs">
        <P>
          W/CdA est l'analogue aéro du W/kg pour les grimpeurs. C'est le
          ratio qui détermine votre vitesse sur le plat :
        </P>
        <Formula>
          {"V_plat ≈ (2 × P / (CdA × ρ))^(1/3)\n\n" +
           "Exemple : 200W avec CdA = 0.32, ρ = 1.2\n" +
           "W/CdA = 625\n" +
           "V = (2 × 200 / (0.32 × 1.2))^(1/3) = 10.9 m/s = 39.1 km/h"}
        </Formula>
      </Section>
    </Article>
  );
}
