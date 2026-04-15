import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function AggregationMethods() {
  return (
    <Article title="Méthodes d'agrégation multi-rides : inverse-variance vs hiérarchique">
      <P>
        Quand vous analysez plusieurs rides du même cycliste, AeroProfile
        produit <Tex>{String.raw`N`}</Tex> estimations de{" "}
        <Tex>{String.raw`C_dA`}</Tex>, une par ride. La question est : quel
        chiffre afficher comme <em>"CdA moyen du cycliste"</em> ? Une moyenne
        arithmétique simple est sous-optimale (toutes les rides ne se valent
        pas). AeroProfile implémente <strong>deux méthodes</strong>, calculées
        en parallèle, que vous pouvez comparer.
      </P>

      <Section title="Pourquoi ne pas faire une moyenne simple">
        <P>
          Les <Tex>{String.raw`N`}</Tex> rides ne sont pas équivalentes : une
          ride courte dans le vent fort donne un{" "}
          <Tex>{String.raw`C_dA`}</Tex> beaucoup moins fiable qu'une ride longue
          en air calme. Une moyenne arithmétique{" "}
          <Tex>{String.raw`\bar{C}_dA = \frac{1}{N}\sum C_{dA,i}`}</Tex> donne
          le même poids aux deux, ce qui amplifie l'erreur.
        </P>
        <P>
          Pire : <strong>le prior CdA biaise la moyenne</strong>. Si chaque ride
          retourne une estimation MAP tirée vers <Tex>{String.raw`\mu_0`}</Tex>{" "}
          (le centre du prior), ce shrinkage persiste à travers la moyenne.
          Sur des rides bruitées, l'écart entre prior <em>"Aéro drops"</em>
          (0.30) et <em>"Relâchée tops"</em> (0.40) atteignait{" "}
          <Tex>{String.raw`0.044\;\text{m}^2`}</Tex> avec une moyenne simple
          biaisée par les priors. La conclusion : <strong>en multi-rides, le
          prior par ride doit être désactivé</strong>, et la régularisation est
          fournie par l'agrégation elle-même.
        </P>
      </Section>

      <Section title="Méthode A — Agrégation inverse-variance (DerSimonian-Laird, fixed effects)">
        <P>
          C'est l'approche standard en méta-analyse. Chaque
          ride <Tex>{String.raw`i`}</Tex> retourne son
          estimation <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> et son
          écart-type <Tex>{String.raw`\sigma_i`}</Tex>, calculés depuis la
          Hessienne du solveur (matrice d'information de Fisher au point MAP).
          La moyenne agrégée pondère par l'inverse de la variance :
        </P>
        <Formula>{String.raw`\hat{C}_{dA,\text{agg}} = \frac{\sum_i w_i \hat{C}_{dA,i}}{\sum_i w_i}, \quad w_i = \frac{q_i}{\sigma_i^2}`}</Formula>
        <P>
          Le facteur <Tex>{String.raw`q_i`}</Tex> est un coefficient de qualité
          empirique basé sur le nRMSE de la ride (les rides où le modèle ajuste
          moins bien la puissance pèsent moins). Les rides à CI étroit
          (Hessienne piquée) dominent la moyenne ; les rides à CI large
          (données ambiguës) y contribuent peu.
        </P>
        <P>
          L'<strong>intervalle de confiance agrégé</strong> est calculé avec
          une <em>variance pondérée</em> cohérente avec la moyenne :
        </P>
        <Formula>{String.raw`\hat{\sigma}^2_w = \frac{\sum_i w_i \bigl(\hat{C}_{dA,i} - \hat{C}_{dA,\text{agg}}\bigr)^2}{\sum_i w_i}, \quad \text{SE} = \frac{\hat{\sigma}_w}{\sqrt{N}}`}</Formula>
        <P>
          Une version antérieure utilisait une variance <em>non</em> pondérée
          (somme divisée par <Tex>{String.raw`N`}</Tex> au lieu de{" "}
          <Tex>{String.raw`\sum w_i`}</Tex>). Conséquence méthodologique : une
          ride courte de 100 points pesait 0.01× une ride longue de 10 000
          points dans la moyenne mais 1× dans l'IC — ce qui surestimait
          l'incertitude quand les poids étaient très inégaux. La version
          actuelle rend l'IC cohérent avec la moyenne : une ride qui ne pèse
          presque rien dans la moyenne ne pèse presque rien dans l'IC non plus.
        </P>
        <P>
          <strong>Avantages :</strong> rapide (juste une moyenne pondérée
          côté frontend), aucun nouveau solveur côté backend, transparent.
          C'est la méthode <em>par défaut</em> d'AeroProfile.
        </P>
        <P>
          <strong>Limite :</strong> suppose que les <Tex>{String.raw`N`}</Tex>{" "}
          rides échantillonnent <em>la même</em>{" "}
          quantité <Tex>{String.raw`C_dA`}</Tex>. Or le CdA peut légitimement
          varier d'une sortie à l'autre (veste de pluie, position légèrement
          différente, fatigue). Le modèle inverse-variance ne distingue pas
          variance de mesure et variance vraie inter-rides.
        </P>
      </Section>

      <Section title="Méthode B — Meta-analyse random-effects (DerSimonian-Laird)">
        <P>
          La Méthode B traite explicitement la variation inter-rides comme un
          paramètre à estimer. On suppose :
        </P>
        <Formula>{String.raw`C_{dA,i} \sim \mathcal{N}(\mu,\; \tau^2),\quad \hat{C}_{dA,i} \sim \mathcal{N}(C_{dA,i},\; \sigma_i^2)`}</Formula>
        <P>
          où <Tex>{String.raw`\mu`}</Tex> est le CdA "vrai" moyen du
          cycliste, <Tex>{String.raw`\tau`}</Tex> est l'écart-type inter-rides
          (la variance de son CdA d'une sortie à l'autre — fatigue, position
          légèrement différente, veste, etc.), et{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> est l'incertitude de mesure sur
          la <Tex>{String.raw`i`}</Tex>-ème ride (issue de la Hessienne du
          solveur pour cette ride particulière).
        </P>
        <P>
          C'est le modèle classique de la méta-analyse en random-effects,
          attribué à DerSimonian & Laird (1986). La formule fermée pour{" "}
          <Tex>{String.raw`\tau^2`}</Tex> et <Tex>{String.raw`\mu`}</Tex>{" "}
          passe par <em>Cochran's Q</em>, une statistique d'hétérogénéité
          calculée à partir de la moyenne fixed-effect et des poids inverses
          de la variance :
        </P>
        <Formula>{String.raw`w_i^{FE} = \frac{1}{\sigma_i^2},\quad \mu_{FE} = \frac{\sum_i w_i^{FE} \hat{C}_{dA,i}}{\sum_i w_i^{FE}}`}</Formula>
        <Formula>{String.raw`Q = \sum_{i=1}^{N} w_i^{FE}\,(\hat{C}_{dA,i} - \mu_{FE})^2`}</Formula>
        <Formula>{String.raw`\hat{\tau}^2 = \max\!\left(0,\; \frac{Q - (N - 1)}{\sum_i w_i^{FE} - \sum_i (w_i^{FE})^2 / \sum_i w_i^{FE}}\right)`}</Formula>
        <P>
          Une fois <Tex>{String.raw`\hat{\tau}^2`}</Tex> connu, les poids
          random-effects redistribuent le poids entre "incertitude de mesure"
          et "vraie variance inter-rides" :
        </P>
        <Formula>{String.raw`w_i^{RE} = \frac{1}{\sigma_i^2 + \hat{\tau}^2},\quad \hat{\mu} = \frac{\sum_i w_i^{RE} \hat{C}_{dA,i}}{\sum_i w_i^{RE}},\quad \text{SE}(\hat{\mu}) = \frac{1}{\sqrt{\sum_i w_i^{RE}}}`}</Formula>
        <P>
          L'IC95 sur <Tex>{String.raw`\mu`}</Tex> est{" "}
          <Tex>{String.raw`\hat{\mu} \pm 1.96\,\text{SE}(\hat{\mu})`}</Tex>{" "}
          — distribution-free, pas de Hessienne globale, pas d'optimisation
          non-linéaire sur <Tex>{String.raw`\tau`}</Tex>.
        </P>
        <P>
          <strong>Avantages :</strong> forme fermée, rapide, robuste. Chaque
          ride est estimée indépendamment (on réutilise le solveur Chung VE
          single-ride existant), puis la fusion se fait analytiquement.
          L'hétérogénéité est exposée via{" "}
          <Tex>{String.raw`\hat{\tau}`}</Tex> et l'indice{" "}
          <Tex>{String.raw`I^2 = \max(0, (Q - N + 1)/Q)`}</Tex> (0% = rides
          parfaitement cohérentes, 100% = toute la variance est inter-rides).
        </P>
        <Warning>
          <strong>Bug historique corrigé en 2026.</strong> Une version
          antérieure implémentait la Méthode B comme un <em>joint MLE</em>{" "}
          sur <Tex>{String.raw`(\mu, \log\tau, C_{rr}, C_{dA,1}, \ldots, C_{dA,N})`}</Tex>{" "}
          via <code>scipy.optimize.least_squares</code>. La fonction de
          résidus passait <Tex>{String.raw`(C_{dA,i} - \mu) / \tau`}</Tex>{" "}
          qui donne le terme quadratique du log-vraisemblance Gaussien{" "}
          <Tex>{String.raw`\sum_i (C_{dA,i} - \mu)^2 / \tau^2`}</Tex> — mais
          le terme de normalisation <Tex>{String.raw`N \log \tau`}</Tex> du
          vrai négatif log-vraisemblance était absent. Sans ce terme, le
          solveur pouvait rendre le coût arbitrairement petit en augmentant{" "}
          <Tex>{String.raw`\tau`}</Tex>, donc{" "}
          <Tex>{String.raw`\tau^\star = +\infty`}</Tex> et la solution
          atterrissait systématiquement à la borne supérieure. Relever le
          plafond de 0.20 à 0.40 n'a rien changé : le bug était structurel,
          pas une question de bornes. Le passage à DerSimonian-Laird élimine
          entièrement le problème en évitant l'optimisation non-linéaire sur{" "}
          <Tex>{String.raw`\tau`}</Tex>.
        </Warning>
        <P>
          <strong>Gate n≥5.</strong> Méthode B n'est pas disponible sous
          cinq rides valides : le endpoint <code>/analyze-batch</code> renvoie
          une 422 avec un message invitant l'utilisateur à utiliser la
          Méthode A. Même avec DerSimonian-Laird, Cochran's Q sur 2-4 rides
          est trop bruité pour donner un{" "}
          <Tex>{String.raw`\hat{\tau}^2`}</Tex> informatif.
        </P>
      </Section>

      <Section title="Comparaison sur dataset bruité (Laurette, 30 rides)">
        <P>
          Sur 30 rides du même cycliste avec capteur bruité (nRMSE 35–46%),
          on compare l'écart de <Tex>{String.raw`C_dA`}</Tex> agrégé selon le
          prior choisi par l'utilisateur (avant et après les corrections) :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Configuration</th>
                <th className="py-2">Δ CdA (drops vs tops)</th>
                <th className="py-2">Statut</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5">Avant : prior actif + bug du poids RMSE</td>
                <td className="text-coral">0.044 m²</td>
                <td className="font-sans text-coral">Inacceptable</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Après : poids du prior corrigé</td>
                <td>≈ 0.020 m²</td>
                <td className="font-sans text-muted">Encore biaisé (shrinkage)</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Méthode A (inverse-variance, sans prior)</td>
                <td className="text-teal">0.0001 m²</td>
                <td className="font-sans text-teal">440× moins de biais</td>
              </tr>
              <tr>
                <td className="py-1.5">Méthode B (hiérarchique random-effects)</td>
                <td className="text-teal">0.0000 m²</td>
                <td className="font-sans text-teal">Indépendant du prior par construction</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          Les méthodes A et B convergent vers le même chiffre à{" "}
          <Tex>{String.raw`\sim 0.005\;\text{m}^2`}</Tex> près sur la plupart
          des datasets. La Méthode B est utile surtout comme <strong>contrôle
          de cohérence</strong> et pour estimer la variance inter-rides{" "}
          <Tex>{String.raw`\tau`}</Tex> — qui est un signal physique
          intéressant en soi (un cycliste avec <Tex>{String.raw`\tau`}</Tex>{" "}
          élevé a une position moins reproductible).
        </Note>
      </Section>

      <Section title="Quelle méthode utiliser ?">
        <P>
          La Méthode A (inverse-variance) est <strong>activée par défaut</strong>{" "}
          partout (Analyse multi-fichiers, Compare, Intervals.icu). Elle est
          rapide, suffisamment rigoureuse pour le cas général, et son
          interprétation est intuitive.
        </P>
        <P>
          La Méthode B (hiérarchique) tourne <strong>en parallèle</strong>{" "}
          dans tous ces modes <strong>dès qu'il y a au moins 5 rides valides</strong>,
          et son résultat (<Tex>{String.raw`\mu`}</Tex> et{" "}
          <Tex>{String.raw`\tau`}</Tex>) est affiché à côté du résultat A. En
          dessous de ce seuil, la Méthode B est désactivée avec un message
          explicite (voir section précédente). Si les deux méthodes divergent
          de <Tex>{String.raw`> 0.01\;\text{m}^2`}</Tex>, c'est un signal :
          probablement une ride très bruitée tire la moyenne A, ou la
          variation inter-rides est suffisamment grande pour que les deux
          approches donnent des estimations différentes.
        </P>
      </Section>

      <Section title="Références">
        <P>
          DerSimonian R, Laird N. <em>Meta-analysis in clinical trials.</em>{" "}
          Controlled Clinical Trials, 1986. — Le papier fondateur du modèle
          random-effects en méta-analyse.
        </P>
        <P>
          Gelman A, Carlin JB, Stern HS, Dunson DB, Vehtari A, Rubin DB.{" "}
          <em>Bayesian Data Analysis (3e éd.)</em>. CRC Press, 2013. Chapitre
          5 : modèles hiérarchiques. Chapitre 14 : régression et priors.
        </P>
        <P>
          Bishop CM. <em>Pattern Recognition and Machine Learning</em>.
          Springer, 2006. §3.3 sur l'estimation MAP et la régularisation
          bayésienne.
        </P>
      </Section>
    </Article>
  );
}
