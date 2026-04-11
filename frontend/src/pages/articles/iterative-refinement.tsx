import { Article, Section, Formula, Tex, Note, Warning, P } from "../../components/BlogLayout";

export default function IterativeRefinement() {
  return (
    <Article title="Raffinement itératif hybride : n'utiliser que les points o\u00f9 le mod\u00e8le fonctionne">
      <P>
        Quand vous regardez le graphe "Altitude r\u00e9elle vs virtuelle", les
        deux courbes sont souvent proches au d\u00e9but puis divergent sur certains
        segments. Ces segments de divergence sont ceux o\u00f9 le mod\u00e8le physique
        est faux — mauvais vent, drafting non d\u00e9tect\u00e9, freinage invisible,
        ou tout autre facteur non mod\u00e9lis\u00e9.
      </P>
      <P>
        L'id\u00e9e est simple : <strong>si le mod\u00e8le se trompe visiblement
        quelque part, autant ne pas utiliser ces points pour estimer le CdA</strong>.
        On ne garde que les segments o\u00f9 mod\u00e8le et r\u00e9alit\u00e9 sont d'accord.
        Mais d\u00e9tecter "o\u00f9 le mod\u00e8le se trompe" n'est pas trivial : un \u00e9cart
        absolu seul ne suffit pas, et un taux de d\u00e9rive seul non plus.
        AeroProfile utilise une <strong>approche hybride \u00e0 deux crit\u00e8res</strong> qui
        combine les deux signaux pour une d\u00e9tection robuste.
      </P>

      <Section title="Le probl\u00e8me de la circularit\u00e9">
        <P>
          Pour calculer l'altitude virtuelle, il faut conna\u00eetre{" "}
          <Tex>{String.raw`C_dA`}</Tex> et <Tex>{String.raw`C_{rr}`}</Tex>.
          Mais pour conna\u00eetre <Tex>{String.raw`C_dA`}</Tex> et{" "}
          <Tex>{String.raw`C_{rr}`}</Tex>, il faut r\u00e9soudre le mod\u00e8le. C'est
          l'\u0153uf et la poule. On ne peut pas exclure les "mauvais points"
          avant d'avoir un premier r\u00e9sultat.
        </P>
        <P>
          La solution : une <strong>approche en deux passes</strong>. La passe 1
          r\u00e9sout le mod\u00e8le sur tous les points valides. Puis on identifie les
          zones de divergence avec les r\u00e9sultats de cette passe. La passe 2
          re-r\u00e9sout en excluant ces zones.
        </P>
      </Section>

      <Section title="Passe 1 : estimation initiale">
        <P>
          On r\u00e9sout <Tex>{String.raw`C_dA`}</Tex> et{" "}
          <Tex>{String.raw`C_{rr}`}</Tex> sur tous les points valides (apr\u00e8s les
          filtres de vitesse, puissance, acc\u00e9l\u00e9ration, etc.). On obtient une
          premi\u00e8re estimation :
        </P>
        <Formula>
          {String.raw`\text{Passe 1} : \quad (C_dA_1,\; C_{rr,1}) = \arg\min \sum_i \left( P_{\text{mod\`ele}}(i) - P_{\text{mesur\`e}}(i) \right)^2`}
        </Formula>
        <P>
          Avec ces valeurs, on calcule l'altitude virtuelle (VE) sur tout le
          parcours. La d\u00e9rive entre altitude virtuelle et altitude r\u00e9elle r\u00e9v\u00e8le
          les zones o\u00f9 le mod\u00e8le est en d\u00e9faut :
        </P>
        <Formula>
          {String.raw`\text{d\`erive}(t) = \text{alt}_{\text{virtuelle}}(t) - \text{alt}_{\text{r\`eelle}}(t)`}
        </Formula>
      </Section>

      <Section title="Lissage avant diff\u00e9renciation">
        <P>
          Avant de calculer la d\u00e9riv\u00e9e de la d\u00e9rive, on applique un{" "}
          <strong>lissage par moyenne mobile de 30 secondes</strong> sur le
          signal de d\u00e9rive brut. C'est essentiel pour \u00e9viter l'amplification
          du bruit lors de la diff\u00e9renciation.
        </P>
        <Formula>
          {String.raw`\text{d\`erive}_{\text{liss\`ee}}(t) = \frac{1}{30} \sum_{\tau = t-15}^{t+15} \text{d\`erive}(\tau)`}
        </Formula>
        <P>
          Sans ce lissage, la d\u00e9riv\u00e9e num\u00e9rique{" "}
          <Tex>{String.raw`\Delta \text{d\`erive} / \Delta t`}</Tex> est
          domin\u00e9e par le bruit GPS et le bruit altim\u00e9trique, ce qui produirait
          des faux positifs partout. Le lissage pr\u00e9alable agit comme un filtre
          passe-bas : il \u00e9limine les fluctuations rapides (bruit) et ne conserve
          que les tendances significatives (vraie divergence du mod\u00e8le).
        </P>
      </Section>

      <Section title="Crit\u00e8re 1 : taux de d\u00e9rive (divergence active)">
        <P>
          Le premier crit\u00e8re d\u00e9tecte les zones o\u00f9 le mod\u00e8le est en train de
          diverger activement. On calcule la d\u00e9riv\u00e9e temporelle de la d\u00e9rive
          liss\u00e9e, puis on la lisse une seconde fois sur 60 secondes :
        </P>
        <Formula>
          {String.raw`r(t) = \left\langle \left| \frac{d(\text{d\`erive}_{\text{liss\`ee}})}{dt} \right| \right\rangle_{60\text{s}}`}
        </Formula>
        <P>
          Ce taux est compar\u00e9 \u00e0 un seuil adaptatif qui d\u00e9pend du profil de la
          sortie :
        </P>
        <Formula>
          {String.raw`\text{seuil}_{\text{taux}} = \max\!\left(0.10 \;\text{m/s},\;\; \frac{D^{+}}{\text{dur\`ee}} \times 4 \right)`}
        </Formula>
        <P>
          La logique : <Tex>{String.raw`D^{+} / \text{dur\`ee}`}</Tex> est le taux
          moyen de gain d'altitude de la sortie. En le multipliant par 4, on
          fixe un seuil proportionnel \u00e0 la "vitesse verticale" naturelle du
          parcours. Le plancher de 0.10 m/s garantit un seuil minimal pour les
          sorties tr\u00e8s plates.
        </P>
        <P>
          <strong>Ce que \u00e7a attrape :</strong> le drafting (le mod\u00e8le surestime la
          puissance a\u00e9ro, l'altitude virtuelle monte trop vite), les
          changements brusques de vent (la correction vent devient fausse),
          et le freinage invisible (le mod\u00e8le ne sait pas que vous freinez).
          Ces ph\u00e9nom\u00e8nes causent une divergence rapide — le taux de d\u00e9rive
          les d\u00e9tecte imm\u00e9diatement.
        </P>
      </Section>

      <Section title="Critère 2 : dérive détrendée (filet de sécurité)">
        <P>
          Le second critère ne regarde pas la dérive brute mais la dérive
          <strong> après soustraction de sa tendance linéaire</strong>. Pourquoi ?
          Après un épisode de drafting de 2 minutes, la dérive fait un saut
          de +30 m puis reste stable. La dérive brute reste à +30 m pour tout
          le reste de la sortie — un seuil absolu exclurait toute la suite,
          alors que le modèle y fonctionne correctement.
        </P>
        <P>
          En retirant la tendance linéaire (fit par moindres carrés sur la
          dérive lissée), on ne garde que les <strong>écarts locaux</strong> :
        </P>
        <Formula>
          {String.raw`\delta(t) = \left\langle \left| \Delta h_{\text{lissé}}(t) - \text{trend}(t) \right| \right\rangle_{60\text{s}}`}
        </Formula>
        <Formula>
          {String.raw`\text{trend}(t) = a \cdot t + b \quad \text{(régression linéaire sur } \Delta h_{\text{lissé}} \text{)}`}
        </Formula>
        <P>
          Le seuil est proportionnel au dénivelé positif :
        </P>
        <Formula>
          {String.raw`\text{seuil}_{\text{detrend}} = \max\!\left(40 \;\text{m},\;\; D^{+} \times 8\% \right)`}
        </Formula>
        <P>
          <strong>Ce que ça attrape :</strong> les segments où le modèle
          diverge localement de façon anormale, même si la dérive globale est
          constante. Un offset constant (biais CdA, biais vent global) est
          absorbé par la tendance linéaire et ne déclenche pas d'exclusion.
          Seuls les vrais problèmes locaux (drafting, freinage, changement
          de vent brutal) sont détectés.
        </P>
      </Section>

      <Section title="Pourquoi deux critères sont nécessaires">
        <P>
          Ni le taux de dérive seul, ni la dérive détrendée seule ne suffisent :
        </P>
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li>
            <strong>Taux seul :</strong> rate sur les erreurs lentes et
            systématiques. Sur une montée de 40 minutes avec un vent
            légèrement sous-estimé, le taux de dérive reste à 0.05 m/s
            (sous le seuil) mais l'écart détrendé finit par dépasser le
            seuil car la dérive s'écarte de la tendance linéaire locale.
          </li>
          <li>
            <strong>Détrendé seul :</strong> rate sur les problèmes très
            courts et intenses. 20 secondes de drafting causent un taux de
            dérive énorme (0.5 m/s) mais l'écart détrendé peut rester
            faible si la tendance linéaire s'adapte au saut.
          </li>
        </ul>
        <P>
          L'approche hybride combine les deux : un point est exclu si{" "}
          <strong>l'un OU l'autre</strong> des critères dépasse son seuil :
        </P>
        <Formula>
          {String.raw`\text{exclu}(t) = \bigl( r(t) > \text{seuil}_{\text{taux}} \bigr) \;\lor\; \bigl( \delta(t) > \text{seuil}_{\text{detrend}} \bigr)`}
        </Formula>
      </Section>

      <Section title="La r\u00e8gle des 30% : savoir quand ne pas raffiner">
        <P>
          Si plus de 30% des points valides seraient exclus par les crit\u00e8res
          ci-dessus, le raffinement est <strong>enti\u00e8rement annul\u00e9</strong>.
          On conserve le r\u00e9sultat de la passe 1.
        </P>
        <Formula>
          {String.raw`\frac{N_{\text{exclus}}}{N_{\text{valides passe 1}}} > 0.30 \implies \text{pas de passe 2}`}
        </Formula>
        <P>
          L'intuition : si le mod\u00e8le diverge sur plus d'un tiers du parcours,
          le probl\u00e8me n'est pas local — c'est le mod\u00e8le lui-m\u00eame qui est
          globalement inadapt\u00e9 (vent compl\u00e8tement faux, capteur de puissance
          d\u00e9cal\u00e9, masse erron\u00e9e). Dans ce cas, couper 30%+ des donn\u00e9es ne ferait
          que biaiser le r\u00e9sultat en ne gardant que les segments o\u00f9 les erreurs
          se compensent par hasard. Mieux vaut garder toutes les donn\u00e9es et
          accepter l'impr\u00e9cision.
        </P>
        <Warning>
          Sans ce garde-fou, le raffinement pourrait exclure massivement les
          mont\u00e9es et ne garder que les descentes (ou l'inverse), donnant un{" "}
          <Tex>{String.raw`C_dA`}</Tex> biais\u00e9 qui ne repr\u00e9sente qu'une fraction du
          parcours.
        </Warning>
      </Section>

      <Section title="Passe 2 : re-estimation sur les points fiables">
        <P>
          Si les conditions sont remplies (au moins 20 points exclus, au moins
          100 points restants, et moins de 30% d'exclusion), la passe 2
          re-r\u00e9sout le mod\u00e8le sur les points restants :
        </P>
        <Formula>
          {String.raw`\text{Passe 2} : \quad (C_dA_2,\; C_{rr,2}) = \arg\min \sum_{i \,\notin\, \text{exclus}} \left( P_{\text{mod\`ele}}(i) - P_{\text{mesur\`e}}(i) \right)^2`}
        </Formula>
        <P>
          L'altitude virtuelle est ensuite recalcul\u00e9e avec les nouveaux
          param\u00e8tres <Tex>{String.raw`(C_dA_2,\; C_{rr,2})`}</Tex>. Le graphe
          final affiche en gris les zones exclues, ce qui permet de v\u00e9rifier
          visuellement que les exclusions sont pertinentes.
        </P>
      </Section>

      <Section title="R\u00e9sum\u00e9 de l'algorithme">
        <Formula>
          {String.raw`\boxed{\begin{aligned}
& \textbf{1.}\; \text{R\`esoudre } (C_dA_1,\, C_{rr,1}) \text{ sur tous les points valides} \\
& \textbf{2.}\; \text{Calculer } \text{d\`erive}(t) = \text{alt}_{\text{virt}}(t) - \text{alt}_{\text{r\`eelle}}(t) \\
& \textbf{3.}\; \text{Lisser la d\`erive (30\,s), puis calculer :} \\
& \qquad r(t) = \left\langle \left| \tfrac{d(\text{d\`erive}_{\text{liss\`ee}})}{dt} \right| \right\rangle_{60\text{s}} \quad \text{vs} \quad \max\!\left(0.10,\; \tfrac{D^{+}}{\text{dur\`ee}} \times 4\right) \\
& \qquad d(t) = \left\langle |\text{d\`erive}_{\text{liss\`ee}}| \right\rangle_{60\text{s}} \quad \text{vs} \quad \max\!\left(80,\; D^{+} \times 0.12\right) \\
& \textbf{4.}\; \text{Exclure si } r(t) > \text{seuil}_{\text{taux}} \;\lor\; d(t) > \text{seuil}_{\text{abs}} \\
& \textbf{5.}\; \text{Si } > 30\%\text{ exclus} \implies \text{garder passe 1} \\
& \textbf{6.}\; \text{Sinon re-r\`esoudre } (C_dA_2,\, C_{rr,2}) \text{ sur les points restants}
\end{aligned}}`}
        </Formula>
      </Section>

      <Section title="Ce que \u00e7a change en pratique">
        <P>
          Sur une sortie plate avec une section en peloton au milieu
          (drafting), la passe 1 donne un <Tex>{String.raw`C_dA`}</Tex> biais\u00e9
          vers le bas. Le crit\u00e8re 1 (taux de d\u00e9rive) d\u00e9tecte la divergence
          rapide pendant le drafting. La passe 2 exclut cette section et
          recalcule — <Tex>{String.raw`C_dA`}</Tex> plus r\u00e9aliste.
        </P>
        <P>
          Sur une sortie de montagne, la descente produit souvent une
          divergence (freinage, vitesse terminale non mod\u00e9lis\u00e9e). Le crit\u00e8re 2
          (d\u00e9rive absolue) attrape l'accumulation d'erreur sur la descente.
          La passe 2 exclut la descente et base le <Tex>{String.raw`C_dA`}</Tex> sur
          les mont\u00e9es et les parties plates — r\u00e9sultat plus stable.
        </P>
        <P>
          Sur une sortie avec un vent qui tourne progressivement (l'API m\u00e9t\u00e9o
          donne un vent horaire, mais le vent r\u00e9el varie au quart d'heure), les
          deux crit\u00e8res se compl\u00e8tent : le taux de d\u00e9rive attrape les
          changements brusques, et la d\u00e9rive absolue attrape l'accumulation
          lente sur les segments o\u00f9 le vent est syst\u00e9matiquement faux.
        </P>
        <Note>
          C'est exactement ce que les praticiens de Golden Cheetah font
          manuellement : ils regardent le graphe VE, identifient les zones
          de divergence, les excluent \u00e0 la main, et relancent le calcul.
          AeroProfile automatise cette \u00e9tape avec une d\u00e9tection hybride qui
          couvre les deux modes de d\u00e9faillance (local et accumul\u00e9).
        </Note>
      </Section>

      <Section title="Quand la passe 2 ne s'active pas">
        <P>
          Trois cas o\u00f9 le raffinement est ignor\u00e9 :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>D\u00e9rive faible partout</strong> : si aucun des deux
            crit\u00e8res ne d\u00e9passe son seuil (ou moins de 20 points exclus), le
            r\u00e9sultat de la passe 1 est d\u00e9j\u00e0 bon.
          </li>
          <li>
            <strong>Trop de points exclus (&gt; 30%)</strong> : le mod\u00e8le est
            globalement faux, le raffinement ne peut pas aider.
          </li>
          <li>
            <strong>Trop peu de points restants (&lt; 100)</strong> : pas assez
            de donn\u00e9es pour une re-estimation fiable.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
