import { Article, Section, Note, P } from "../../components/BlogLayout";

export default function ChoosePosition() {
  return (
    <Article title="Quelle position choisir dans le formulaire ?">
      <P>
        Le sélecteur <em>Position sur le vélo</em> n'est pas un piège. Il ne
        fixe pas ton CdA — il donne juste au solveur une <em>hypothèse de
        départ</em> pour chercher ta vraie valeur. Voici comment le remplir
        sans stresser, et que faire si tu n'es pas sûr.
      </P>

      <Section title="Ce que fait ce champ">
        <P>
          Le solveur a besoin d'un point de départ et d'une idée de la plage
          probable. Quand tu choisis <em>Aéro (cocottes)</em>, il commence sa
          recherche autour de 0,30 m² et s'attend à une valeur entre 0,24 et
          0,36 environ. Quand tu choisis <em>Très aéro (prolongateurs)</em>,
          il commence vers 0,22 avec une plage plus serrée.
        </P>
        <P>
          Si ta sortie est riche en données (vitesse variée, cap qui change),
          le solveur trouvera ton vrai CdA même si ta position de départ est
          un peu à côté. Si ta sortie est pauvre (col tout droit pendant 2h),
          le solveur se contente d'ajuster autour du prior — c'est à ce
          moment-là que ton choix de position pèse vraiment.
        </P>
      </Section>

      <Section title="Comment choisir ta position">
        <P>
          Regarde où sont tes mains sur le vélo <strong>pendant la majeure
          partie de la sortie</strong>. Pas en contre-la-montre ponctuel, pas
          au départ du col, mais ta posture moyenne quand tu roules à
          allure soutenue.
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1 my-3">
          <li><strong>Prolongateurs (TT) aéro, dos plat</strong> → "Pro (superman)" ou "Aéro prolongateurs".</li>
          <li><strong>Mains en bas du cintre, dos plat</strong> → "Aéro (drops)".</li>
          <li><strong>Mains sur les cocottes, dos moyennement plat</strong> → "Modérée (cocottes)". <em>C'est le cas de la majorité des cyclistes sur route.</em></li>
          <li><strong>Mains sur le haut du cintre, torse redressé</strong> → "Relâchée (tops)".</li>
          <li><strong>Vélo de ville, VTT en balade</strong> → "Relâchée" sur le preset VTT / Gravel.</li>
        </ul>
      </Section>

      <Section title="Et si tu n'es pas sûr du tout ?">
        <P>
          Sélectionne <strong>"Je ne sais pas"</strong> (première option du
          sélecteur). Ça désactive le prior sur le CdA — le solveur cherche
          alors librement, en se basant uniquement sur tes données. Les
          priors sur le vent et le Crr restent actifs pour éviter que le
          solveur diverge.
        </P>
        <Note>
          <strong>Quand "Je ne sais pas" est le bon choix :</strong> sur les
          sorties riches (variété de cap, variété de vitesse, plusieurs
          heures, peu de drafting). Ces conditions donnent au solveur toute
          l'information dont il a besoin, et il trouvera ton CdA sans
          hypothèse de départ. Le CdA affiché à la fin est alors une
          estimation <em>pure données</em>.
        </Note>
        <P>
          <strong>Quand c'est moins recommandé :</strong> sur les sorties
          pauvres (col tout droit, ride courte &lt; 20 min, drafting massif).
          Sans prior, le solveur risque de taper une borne physique
          (0,15 m² ou 0,55 m² sur route) et tu te retrouves avec une
          estimation peu fiable flaguée <code>non_identifiable</code>. Dans
          ces cas, mieux vaut choisir la position la plus proche de ta
          posture réelle.
        </P>
      </Section>

      <Section title="Tu peux changer d'avis après coup">
        <P>
          Si tu as lancé l'analyse avec une position qui ne correspondait
          pas, clique sur <em>Nouvelle analyse</em>, change le sélecteur,
          et relance. Le cache navigateur regénérera le résultat avec le
          bon prior en moins de 10 secondes.
        </P>
        <P>
          Garde en tête que sur une sortie bien informative, changer le
          prior déplace le CdA de moins de 0,005 m² — l'équivalent de la
          marge d'erreur du solveur. C'est seulement sur les sorties
          limites que le choix pèse vraiment.
        </P>
      </Section>

      <Section title="En bref">
        <P>
          Un seul principe à retenir : <strong>le sélecteur aide le
          solveur, il ne le contraint pas</strong>. Choisis la position la
          plus proche de ta vraie posture, ou "Je ne sais pas" si tu
          hésites — dans les deux cas, le solveur ajustera à partir de tes
          données. Pour comprendre en détail comment fonctionne un prior
          bayésien, l'article <em>Priors bayésiens</em> détaille la
          formulation mathématique et les garde-fous.
        </P>
      </Section>
    </Article>
  );
}
