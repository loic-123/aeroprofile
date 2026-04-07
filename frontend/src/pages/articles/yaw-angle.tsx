import { Article, Section, Formula, Note, P } from "../../components/BlogLayout";

export default function YawAngle() {
  return (
    <Article title="L'angle de yaw : pourquoi le vent de côté change votre CdA">
      <P>
        Quand vous roulez, l'air ne vient pas toujours pile de face. S'il y a
        du vent latéral, l'air apparent arrive en biais — c'est l'angle de
        yaw. Et un cycliste n'offre pas la même résistance à l'air selon
        que le flux vient de face ou de côté.
      </P>

      <Section title="Comment calculer le yaw">
        <P>
          Le yaw, c'est l'angle entre votre direction de déplacement et la
          direction du vent apparent (la combinaison de votre vitesse et du
          vent réel).
        </P>
        <Formula>
          {"Vent apparent :\n" +
           "  composante longitudinale = V_sol + V_vent × cos(dir_vent - bearing)\n" +
           "  composante latérale = V_vent × sin(dir_vent - bearing)\n\n" +
           "Yaw = arctan(|latérale| / |longitudinale|)\n\n" +
           "Exemples à V_sol = 30 km/h, vent = 10 km/h :\n" +
           "  Vent de face pur  → yaw = 0°\n" +
           "  Vent à 45° de côté → yaw ≈ 4°\n" +
           "  Vent à 90° (latéral pur) → yaw ≈ 10°"}
        </Formula>
      </Section>

      <Section title="Impact sur le CdA">
        <P>
          Les mesures en soufflerie (Crouch, Burton et al. 2014) montrent
          que le CdA augmente avec le yaw, de façon approximativement
          quadratique :
        </P>
        <Formula>
          {"CdA_effectif = CdA₀ × (1 + k × yaw²)\n\n" +
           "k = 0.0005 (calibré sur données soufflerie)\n\n" +
           "  Yaw =  0°  →  CdA = CdA₀ (+0%)\n" +
           "  Yaw =  5°  →  CdA = CdA₀ × 1.013 (+1.3%)\n" +
           "  Yaw = 10°  →  CdA = CdA₀ × 1.050 (+5%)\n" +
           "  Yaw = 15°  →  CdA = CdA₀ × 1.113 (+11%)\n" +
           "  Yaw = 20°  →  CdA = CdA₀ × 1.200 (+20%)"}
        </Formula>
        <P>
          En pratique, le yaw moyen sur une sortie route est de 5-10° selon
          les conditions de vent, ce qui correspond à +1% à +5% de CdA
          effectif par rapport au CdA en air calme.
        </P>
      </Section>

      <Section title="Pourquoi ça augmente le CdA ?">
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>Le corps du cycliste vu de côté expose plus de surface qu'en face (bras, jambes, torse asymétriques)</li>
          <li>L'écoulement d'air se sépare de façon asymétrique → plus de turbulences dans le sillage</li>
          <li>Les roues à profil haut agissent comme des voiles — elles ajoutent de la traînée latérale</li>
          <li>Le casque, le cadre et les bidons créent des perturbations différentes selon l'angle</li>
        </ul>
      </Section>

      <Section title="Ce que fait AeroProfile">
        <P>
          <strong>Sans la correction yaw</strong> : le solveur estime un CdA
          "moyen" qui mélange votre aéro intrinsèque et l'effet du vent
          latéral. Si la sortie est venteuse avec beaucoup de crosswind, le
          CdA reporté est gonflé.
        </P>
        <P>
          <strong>Avec la correction yaw</strong> : à chaque point, le modèle
          calcule le yaw depuis le vent (réel ou estimé) et le bearing GPS,
          puis applique le facteur multiplicatif. Le solveur estime CdA₀ —
          votre CdA en air calme, indépendant du vent du jour.
        </P>
        <P>
          Résultat : le CdA reporté est ce que vous mesureriez en soufflerie
          à 0° de yaw. C'est une propriété de votre position et de votre
          équipement, pas des conditions météo.
        </P>
        <Note>
          Dans le wind-inverse solver, le yaw est recalculé à chaque itération
          car le vent lui-même est estimé. Vent change → yaw change →
          CdA effectif change → résidu change. Le solveur converge vers un
          triplet (CdA₀, Crr, vent) cohérent.
        </Note>
      </Section>
    </Article>
  );
}
