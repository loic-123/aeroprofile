import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function DraftingDetection() {
  return (
    <Article title="Détection du drafting : quand rouler en groupe fausse le CdA">
      <P>
        Le drafting (rouler dans le sillage d'un autre cycliste) est le plus
        gros biais que le modèle rencontre sur les sorties en groupe. Derrière
        un coéquipier, la traînée aérodynamique chute de 30 à 40%. Résultat :
        le CdA apparent est artificiellement bas — ce qui ne reflète pas votre
        position, mais le fait que vous étiez abrité.
      </P>

      <Section title="Pourquoi le drafting biaise le CdA">
        <P>
          Dans le sillage d'un cycliste devant vous, l'air est déjà perturbé :
          la dépression créée derrière lui "aspire" celui qui suit. Votre
          capteur de puissance mesure moins de watts pour la même vitesse.
        </P>
        <P>
          Le modèle physique, lui, ne sait pas que vous êtes dans un sillage.
          Il voit : "ce cycliste produit 120W à 35 km/h sur le plat → son CdA
          doit être très bas". Il attribue la réduction de puissance à un
          CdA faible au lieu de la réduction de vent apparent.
        </P>
        <Formula>
          {"En solo à 35 km/h, CdA = 0.32 :\n" +
           "  P_aéro = 0.5 × 0.32 × 1.2 × 9.72² × 9.72 = 178 W\n\n" +
           "En draft derrière un coéquipier (-35% de drag) :\n" +
           "  P_aéro_réelle = 178 × 0.65 = 116 W\n" +
           "  Le solveur calcule : CdA_apparent = 0.32 × 0.65 = 0.21\n\n" +
           "→ Le cycliste semble avoir un CdA de pro en CLM\n" +
           "   alors qu'il est juste dans la roue de quelqu'un"}
        </Formula>
      </Section>

      <Section title="Comment AeroProfile détecte le drafting">
        <P>
          À chaque point de la sortie, AeroProfile calcule un CdA instantané :
        </P>
        <Formula>
          {"CdA_inst = (P×η - P_roll - P_grav - P_accel) / (0.5 × ρ × V_air² × V)\n\n" +
           "Conditions de détection (les 3 simultanément) :\n" +
           "  1. V > 8 m/s (29 km/h) → vitesse suffisante pour que l'aéro domine\n" +
           "  2. |gradient| < 2% → terrain plat (pas de gravité dominante)\n" +
           "  3. P > 100 W → le cycliste pédale activement\n\n" +
           "Si CdA_inst < 0.12 → physiquement impossible seul\n" +
           "(même un pro en CLM est à 0.17+)\n\n" +
           "PLUS : le bloc de drafting doit durer ≥ 30 secondes.\n" +
           "Un seul point à CdA_inst = 0.10 peut être un artefact.\n" +
           "30 secondes consécutives = certainement dans un sillage."}
        </Formula>
      </Section>

      <Section title="En mode comparaison : détection entre cyclistes">
        <P>
          Quand deux cyclistes roulent ensemble (même sortie, même jour), AeroProfile
          détecte si les résultats sont biaisés par le drafting asymétrique :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>Si les vitesses moyennes sont similaires (±5%)...</li>
          <li>...mais les CdA diffèrent de plus de 15%...</li>
          <li>→ Le cycliste au CdA bas a probablement "sucé la roue" du cycliste au CdA haut</li>
        </ul>
        <P>
          Un bandeau orange nomme explicitement qui a drafté et qui a tiré.
        </P>
      </Section>

      <Section title="Que faire si votre sortie est en groupe ?">
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li>
            <strong>Sortie solo</strong> : le meilleur scénario. Aucun drafting,
            CdA fiable.
          </li>
          <li>
            <strong>Relais égaux</strong> : si les deux cyclistes tirent autant
            l'un que l'autre, les artefacts de drafting se compensent en
            moyenne. Le CdA agrégé sur plusieurs sorties convergera vers la
            bonne valeur.
          </li>
          <li>
            <strong>Un seul tire</strong> : le tireur aura un CdA correct
            (il est dans le vent), le suiveur un CdA sous-estimé. Utilisez
            le CdA du tireur comme référence.
          </li>
          <li>
            <strong>Peloton / cyclosportive</strong> : le CdA est inutilisable.
            AeroProfile le signale avec un nRMSE très élevé et exclut la
            ride de la moyenne.
          </li>
        </ul>
        <Warning>
          Le filtre anti-drafting (CdA_inst &lt; 0.12) est conservateur — il ne
          détecte que le drafting très marqué (30-40% de réduction). Un cycliste
          à 1-2 mètres derrière un autre bénéficie de ~15-20% de réduction,
          ce qui peut passer sous le radar du filtre.
        </Warning>
      </Section>

      <Section title="Références">
        <P>
          Blocken et al. (2018). "Aerodynamic drag in cycling pelotons."
          <em> Journal of Wind Engineering and Industrial Aerodynamics</em>.
          Mesures CFD montrant -27% à -40% de traînée pour le 2ème rider
          selon l'espacement.
        </P>
      </Section>
    </Article>
  );
}
