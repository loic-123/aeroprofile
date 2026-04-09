import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function IterativeRefinement() {
  return (
    <Article title="Raffinement itératif : n'utiliser que les points où le modèle fonctionne">
      <P>
        Quand vous regardez le graphe "Altitude réelle vs virtuelle", les
        deux courbes sont souvent proches au début puis divergent sur certains
        segments. Ces segments de divergence sont ceux où le modèle physique
        est faux — mauvais vent, drafting non détecté, freinage invisible,
        ou tout autre facteur non modélisé.
      </P>
      <P>
        L'idée est simple : <strong>si le modèle se trompe visiblement
        quelque part, autant ne pas utiliser ces points pour estimer le CdA</strong>.
        On ne garde que les segments où modèle et réalité sont d'accord.
      </P>

      <Section title="Le problème de la circularité">
        <P>
          Pour calculer l'altitude virtuelle, il faut connaître CdA et Crr.
          Mais pour connaître CdA et Crr, il faut résoudre le modèle. C'est
          l'œuf et la poule. On ne peut pas exclure les "mauvais points"
          avant d'avoir un premier résultat.
        </P>
        <P>
          La solution : une <strong>approche en deux passes</strong>.
        </P>
      </Section>

      <Section title="L'algorithme en deux passes">
        <Formula>
          {"PASSE 1 : résoudre CdA/Crr sur tous les points valides\n" +
           "  → CdA_1, Crr_1\n\n" +
           "Calculer l'altitude virtuelle avec CdA_1, Crr_1\n\n" +
           "Pour chaque point, mesurer la dérive :\n" +
           "  dérive(t) = |altitude_virtuelle(t) - altitude_réelle(t)|\n" +
           "  lissée sur 60 secondes (moyenne mobile)\n\n" +
           "Seuil = max(50 m, 10% du D+ total de la sortie)\n" +
           "  Sortie plate (300 m D+) → seuil = 50 m\n" +
           "  Ventoux (1900 m D+) → seuil = 190 m\n\n" +
           "Exclure les points où dérive > seuil\n\n" +
           "PASSE 2 : re-résoudre CdA/Crr sur les points restants\n" +
           "  → CdA_2, Crr_2 (plus précis)\n\n" +
           "Conditions :\n" +
           "  - Au moins 20 points exclus (sinon pas la peine)\n" +
           "  - Au moins 100 points restants (sinon pas assez de données)"}
        </Formula>
      </Section>

      <Section title="Pourquoi le seuil est proportionnel au D+">
        <P>
          Un seuil fixe (ex: 30m) est trop agressif pour les sorties
          montagneuses. Sur le Ventoux avec 1900m de D+, l'altitude virtuelle
          peut facilement dériver de 50-100m même quand le modèle est
          globalement bon — simplement parce que les petites erreurs
          s'accumulent sur 1900m de dénivelé.
        </P>
        <P>
          En mettant le seuil à 10% du D+, on s'adapte automatiquement :
          on tolère plus de dérive sur les grosses sorties montagneuses
          (où c'est inévitable) et on est plus strict sur les sorties plates
          (où une dérive de 50m est vraiment le signe d'un problème).
        </P>
      </Section>

      <Section title="Ce que ça change en pratique">
        <P>
          Sur une sortie plate avec une section en peloton au milieu
          (drafting), la passe 1 donne un CdA biaisé vers le bas. L'altitude
          virtuelle diverge sur la section peloton. La passe 2 exclut cette
          section et recalcule → CdA plus réaliste.
        </P>
        <P>
          Sur une sortie de montagne, la descente produit souvent une
          divergence (freinage, vitesse terminale non modélisée). La passe 2
          exclut la descente et base le CdA sur les montées et les parties
          plates → résultat plus stable.
        </P>
        <Note>
          C'est exactement ce que les praticiens de Golden Cheetah font
          manuellement : ils regardent le graphe VE, identifient les zones
          de divergence, les excluent à la main, et relancent le calcul.
          AeroProfile automatise cette étape.
        </Note>
      </Section>

      <Section title="Quand la passe 2 ne s'active pas">
        <P>
          Si l'altitude virtuelle est proche de l'altitude réelle partout
          (dérive &lt; seuil sur tous les points), la passe 2 ne s'active
          pas — le résultat de la passe 1 est déjà bon.
        </P>
        <P>
          Si trop de points sont exclus (&lt; 100 restants), la passe 2 ne
          s'active pas non plus — pas assez de données pour une re-estimation
          fiable.
        </P>
      </Section>
    </Article>
  );
}
