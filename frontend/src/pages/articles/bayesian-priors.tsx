import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function BayesianPriors() {
  return (
    <Article title="Priors bayésiens : comment stabiliser le solveur">
      <P>
        Quand les données sont bonnes (sortie variée, vent faible, capteur
        calibré), le solveur trouve le CdA et le Crr sans aide. Mais quand
        les données sont insuffisantes (sortie courte, vent fort mal estimé,
        drafting), le solveur peut "diverger" vers des valeurs absurdes.
        Les priors bayésiens sont un filet de sécurité mathématique.
      </P>

      <Section title="L'intuition : un avis d'expert doux">
        <P>
          Un prior, c'est une croyance initiale. Avant de voir vos données,
          on "croit" que votre CdA est probablement autour de 0.30 (position
          route typique) et votre Crr autour de 0.004 (pneu route asphalte).
          Plus les données sont abondantes et cohérentes, plus le prior
          s'efface. Plus les données sont bruitées, plus le prior pèse.
        </P>
        <P>
          C'est comme demander à un expert : "d'après votre expérience,
          quel CdA attendez-vous pour un cycliste sur route ?" L'expert
          dit "0.30 ± 0.12". Si vos données disent clairement 0.35, on
          retient 0.35. Si vos données sont contradictoires et confuses,
          on retient quelque chose proche de 0.30.
        </P>
      </Section>

      <Section title="La formulation mathématique">
        <P>
          Le solveur minimise une somme de résidus carrés. Un prior gaussien
          ajoute un résidu supplémentaire :
        </P>
        <Formula>
          {"Sans prior :\n" +
           "  minimiser Σᵢ (P_modèle(i) - P_mesuré(i))²\n\n" +
           "Avec priors :\n" +
           "  minimiser Σᵢ (P_modèle(i) - P_mesuré(i))²\n" +
           "           + w_crr × ((Crr - 0.004) / 0.0015)²\n" +
           "           + w_cda × ((CdA - 0.30) / 0.12)²\n\n" +
           "w = poids du prior ≈ 3 (calibré pour que le prior\n" +
           "    pèse comme ~3 bons points de données)"}
        </Formula>
        <P>
          Plus le CdA s'éloigne de 0.30, plus le terme de prior pénalise
          la solution. Mais comme σ = 0.12 est large, la pénalité est très
          faible dans la plage normale (0.20 à 0.45). Elle ne devient
          significative que pour des valeurs extrêmes (CdA = 0.15 ou 0.60).
        </P>
      </Section>

      <Section title="Les trois priors d'AeroProfile">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Paramètre</th>
                <th className="py-2">μ (centre)</th>
                <th className="py-2">σ (largeur)</th>
                <th className="py-2">Rôle</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-mono">CdA</td>
                <td className="font-mono">0.30 m²</td>
                <td className="font-mono">0.12 m²</td>
                <td className="text-muted">Empêche CdA de coller aux bornes 0.15/0.60</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-mono">Crr</td>
                <td className="font-mono">0.004</td>
                <td className="font-mono">0.0015</td>
                <td className="text-muted">Empêche Crr d'absorber les erreurs de vent</td>
              </tr>
              <tr>
                <td className="py-1.5 font-mono">Vent (wind-inverse)</td>
                <td className="font-mono">valeur API</td>
                <td className="font-mono">2 m/s</td>
                <td className="text-muted">Permet au vent de s'éloigner de l'API de ±4 m/s</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Impact mesuré">
        <P>
          Sur les rides bien contraintes (variété de vitesses, heading divers),
          le prior déplace le CdA de &lt; 0.005 m² — invisible.
          Sur les rides mal contraintes (montée de col tout droit pendant 2h),
          le prior peut déplacer le CdA de ~0.03 m² vers 0.30, ce qui évite
          un résultat aberrant.
        </P>
        <P>
          Les IC (intervalles de confiance) sont calculés sur les données
          uniquement, sans le prior — pour que l'incertitude reportée reflète
          la qualité des données, pas la force du prior.
        </P>
      </Section>

      <Section title="Références">
        <P>
          La formulation est celle du MAP (Maximum A Posteriori), cas
          particulier d'inférence bayésienne avec des priors gaussiens.
          Les valeurs de référence sont issues de Debraux et al. (2011) pour
          le CdA et Lim, Homan &amp; Dalbert (2011) pour l'approche bayésienne.
        </P>
      </Section>
    </Article>
  );
}
