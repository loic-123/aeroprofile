import { Article, Section, Formula, Note, P } from "../../components/BlogLayout";

export default function Filters() {
  return (
    <Article title="Filtrage des données : comment on sépare le signal du bruit">
      <P>
        Sur une sortie de 3 heures, vous avez ~10 000 secondes de données.
        Mais seule une fraction est exploitable pour estimer le CdA. Les
        arrêts, freinages, virages serrés, montées raides et passages en
        peloton ne respectent pas les hypothèses du modèle physique. Si on
        les inclut, le solveur essaie de fitter du bruit → résultat faux.
      </P>

      <Section title="Les 13 filtres">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Filtre</th>
                <th className="py-2">Seuil</th>
                <th className="py-2">Pourquoi ?</th>
              </tr>
            </thead>
            <tbody className="text-text">
              <tr className="border-b border-border/30">
                <td className="py-1.5">Arrêt</td>
                <td className="font-mono">V &lt; 1 m/s</td>
                <td className="text-muted">Pas de signal aéro à l'arrêt</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Vitesse basse</td>
                <td className="font-mono">V &lt; 3 m/s</td>
                <td className="text-muted">L'aéro est &lt;10% de la puissance → bruit</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Puissance faible</td>
                <td className="font-mono">P &lt; 50 W</td>
                <td className="text-muted">Roue libre, descente sans pédaler — pas de signal</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Freinage</td>
                <td className="font-mono">a &lt; -0.3 m/s²</td>
                <td className="text-muted">Énergie dissipée dans les freins, pas modélisée</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Forte accélération</td>
                <td className="font-mono">a &gt; 0.3 m/s²</td>
                <td className="text-muted">Le modèle quasi-statique est imprécis</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Montée raide</td>
                <td className="font-mono">gradient &gt; 8%</td>
                <td className="text-muted">Gravité domine, l'aéro est invisible</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Descente raide</td>
                <td className="font-mono">gradient &lt; -8%</td>
                <td className="text-muted">Vitesse terminale, freinage non modélisé</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Virage serré</td>
                <td className="font-mono">yaw_rate &gt; 10°/s</td>
                <td className="text-muted">Pertes de cornering, lean angle</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">V_air négatif</td>
                <td className="font-mono">V_air ≤ 0</td>
                <td className="text-muted">Vent de dos plus fort que la vitesse sol</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Saut GPS</td>
                <td className="font-mono">&gt; 50 m entre 2 pts</td>
                <td className="text-muted">Artefact GPS (tunnel, canyon)</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Spike puissance</td>
                <td className="font-mono">P &gt; 3×NP</td>
                <td className="text-muted">Bug capteur, sprint non représentatif</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Vitesse instable</td>
                <td className="font-mono">CV &gt; 15% (15s)</td>
                <td className="text-muted">Accélérations/freinages répétés</td>
              </tr>
              <tr>
                <td className="py-1.5">Drafting</td>
                <td className="font-mono">CdA_inst &lt; 0.12</td>
                <td className="text-muted">Impossible seul → dans la roue de quelqu'un</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Blocs continus de 30 secondes minimum">
        <P>
          Après le filtrage individuel, on ne garde que les blocs continus
          d'au moins 30 secondes de données valides. Un point isolé valide
          entre deux zones filtrées n'apporte pas assez d'information pour
          contraindre le modèle.
        </P>
      </Section>

      <Section title="Combien de données reste-t-il ?">
        <P>
          Typiquement, 40% à 70% des données passent le filtrage. Sur une
          sortie de 3h (10 800 points), il reste ~5 000 à 7 000 points
          exploitables. C'est largement suffisant — le solveur a besoin
          de quelques centaines de points au minimum.
        </P>
        <P>
          Si moins de 20% des données passent, c'est un signal d'alarme :
          soit la sortie n'est pas adaptée (VTT, peloton), soit il y a un
          problème de capteur.
        </P>
      </Section>

      <Section title="Filtrage post-analyse : raffinement itératif">
        <P>
          Après le solveur, un filtrage supplémentaire compare l'altitude
          virtuelle reconstruite à l'altitude GPS réelle. Les segments où
          le modèle diverge fortement (dérive &gt; 10% du D+ total, minimum
          50m) sont exclus et le solveur est relancé (passe 2). Voir
          l'article "Raffinement itératif" pour les détails.
        </P>
      </Section>

      <Section title="Filtrage multi-rides (mode Intervals / multi-fichiers)">
        <P>
          Quand plusieurs sorties sont analysées, un dernier filtre exclut
          les rides entières dont le nRMSE dépasse 60%. La moyenne CdA est
          pondérée par qualité (les bonnes rides pèsent 3× plus que les
          médiocres).
        </P>
      </Section>

      <Section title="Le lissage pré-filtrage">
        <P>
          Avant tout filtrage, AeroProfile applique deux lissages :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Puissance : moyenne mobile 5 secondes</strong> (Martin 1998).
            Lisse les oscillations de couple pédale-par-pédale que le modèle
            quasi-statique ne peut pas capturer.
          </li>
          <li>
            <strong>Altitude : filtre Savitzky-Golay</strong> (fenêtre 31 points,
            polynôme degré 3). Préserve mieux les ruptures de pente qu'une
            moyenne mobile tout en éliminant le bruit de 0.2m du baromètre.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
