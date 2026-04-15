import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function PriorInvariance() {
  return (
    <Article title="L'invariance au prior : pourquoi votre choix de position ne devrait pas bouger le CdA agrégé">
      <P>
        Quand vous lancez une analyse multi-rides, vous choisissez un{" "}
        <em>prior de position</em> (« Aéro drops », « Modérée cocottes »,
        « Relâchée tops »…). Ce prior bayésien aide chaque ride individuelle
        en injectant une information à priori sur le CdA — utile quand les
        données sont bruitées et que le solveur, sans contrainte, partirait
        en vrille.
      </P>
      <P>
        Mais l'agrégat <Tex>{String.raw`\mu`}</Tex> sur N rides{" "}
        <strong>ne devrait pas dépendre</strong> de ce choix. Si vous
        relancez la même analyse avec un prior centré à 0.30 puis avec un
        prior centré à 0.40, l'estimation finale doit être quasi identique.
        L'invariance au prior est un des contrôles de cohérence les plus
        puissants qu'on puisse appliquer à une méta-analyse — et un des
        plus diagnostiques quand elle <em>casse</em>.
      </P>

      <Section title="Pourquoi μ devrait être indépendant du prior choisi">
        <P>
          Le théorème central est simple : avec assez de données par ride,
          la vraisemblance domine le prior. Chaque ride apporte un{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> issu de la Hessienne du fit, et
          si <Tex>{String.raw`\sigma_i`}</Tex> est bien plus petit que la
          largeur du prior <Tex>{String.raw`\sigma_{\text{prior}}`}</Tex>,
          alors le déplacement bayésien est négligeable :
        </P>
        <Formula>{String.raw`\hat{C}_{dA,i}^{\text{post}} \approx \hat{C}_{dA,i}^{\text{MLE}} + \frac{\sigma_i^2}{\sigma_{\text{prior}}^2}\,(C_{dA}^{\text{prior}} - \hat{C}_{dA,i}^{\text{MLE}})`}</Formula>
        <P>
          Le facteur <Tex>{String.raw`\sigma_i^2 / \sigma_{\text{prior}}^2`}</Tex>{" "}
          est typiquement <Tex>{String.raw`\sim 10^{-2}`}</Tex> sur une ride
          bien contrainte. Une variation de prior de{" "}
          <Tex>{String.raw`\Delta C_{dA}^{\text{prior}} = 0.10`}</Tex>{" "}
          bouge alors chaque <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> de
          seulement <Tex>{String.raw`10^{-3}`}</Tex>. Sur 30 rides, le
          déplacement de la moyenne pondérée est <em>encore plus petit</em>{" "}
          parce que les erreurs s'annulent partiellement.
        </P>
        <P>
          C'est pour cette raison qu'AeroProfile expose deux quantités côte
          à côte dans la réponse JSON :
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed my-2">
          <li>
            <code>cda</code> : le résultat post-prior (utilisé pour
            l'agrégation et l'affichage).
          </li>
          <li>
            <code>cda_raw</code> : le résultat <strong>hors prior CdA</strong>{" "}
            — pass 0 du solveur où le prior bayésien sur le CdA est désactivé,
            mais où les priors vent et Crr restent légèrement actifs (voir{" "}
            l'article <em>Priors bayésiens</em> pour le détail). Ce{" "}
            <code>cda_raw</code> doit être <em>strictement identique</em>{" "}
            entre deux runs qui ne diffèrent que par le choix de prior CdA.
          </li>
        </ul>
      </Section>

      <Section title="Le contrôle de cohérence : comparer deux runs">
        <P>
          La meilleure façon de vérifier que le pipeline est invariant est
          de relancer la <em>même</em> analyse avec deux priors différents
          et de comparer ride par ride. AeroProfile fournit{" "}
          <code>scripts/compare_runs.py</code> pour ça :
        </P>
        <pre className="bg-bg/50 border border-border rounded p-3 text-xs font-mono overflow-x-auto my-3">
{`python scripts/compare_runs.py logs/session_prior_030.log logs/session_prior_040.log
                                   --threshold 0.005`}
        </pre>
        <P>
          Le script extrait les lignes <code>ANALYZE</code> de chaque log
          (matching positionnel : on suppose que les deux runs ont traité
          les mêmes fichiers dans le même ordre, ce qui est garanti par{" "}
          <code>/analyze-batch</code>) et imprime un tableau des deltas{" "}
          <Tex>{String.raw`\Delta C_{dA}, \Delta C_{dA}^{\text{raw}}, \Delta \sigma_H, \Delta`}</Tex>{" "}
          facteur de prior, et tout changement de <code>quality_status</code>.
          Le seuil par défaut est <code>0.005 m²</code> — au-delà, c'est
          qu'une ride a changé de manière significative.
        </P>
        <P>
          Sur un dataset propre (Assioma Duo, 50 rides, deux priors espacés
          de 0.10), le résultat attendu est :
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>0 ride</strong> avec <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| > 0.001`}</Tex>{" "}
            (l'invariance théorique est respectée).
          </li>
          <li>
            <strong>0 ride</strong> avec changement de{" "}
            <code>quality_status</code> (le pipeline classe les rides de
            façon déterministe).
          </li>
          <li>
            <Tex>{String.raw`|\Delta \mu| < 0.002\;\text{m}^2`}</Tex> sur
            l'agrégat — invisible à l'œil dans l'UI.
          </li>
        </ul>
      </Section>

      <Section title="Quand l'invariance casse, et ce que ça signifie">
        <P>
          Sur le dataset Laurette (4iiii mono-jambe, 30 rides bruitées),
          le premier run de cohérence en avril 2026 a montré{" "}
          <strong>4 rides sur 30 avec un <code>cda_raw</code> non
          invariant</strong> — alors que par construction il aurait dû
          l'être. Différentiel observé sur ces 4 rides :{" "}
          <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| \in [0.008, 0.024]\;\text{m}^2`}</Tex>.
        </P>
        <Warning>
          <strong>Cause racine identifiée.</strong> Le solveur multi-start
          <code> wind_inverse</code> initialisait son premier essai à{" "}
          <Tex>{String.raw`x_0[0] = C_{dA}^{\text{prior\;mean}}`}</Tex> —
          donc différent entre les deux runs. Combiné à des tolérances{" "}
          <code>least_squares</code> trop lâches{" "}
          (<code>ftol = xtol = gtol = 1e-8</code> par défaut, <em>plus
          lâches que le bruit numérique de la Hessienne sur ces rides
          bruitées</em>), le solveur convergeait vers deux minima locaux
          légèrement différents selon le point de départ. Sur les rides
          informatives, les deux minima coïncident et l'invariance tient ;
          sur les 4 rides où la fonction de coût a plusieurs vallées
          quasi-équivalentes, le solveur tombait dans la plus proche du
          point de départ.
        </Warning>
        <P>
          Le fix tient en deux changements :
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>Initialisation indépendante du prior.</strong> La
            première graine du sweep multi-start est désormais{" "}
            <Tex>{String.raw`x_0[0] = (C_{dA}^{\text{lower}} + C_{dA}^{\text{upper}}) / 2`}</Tex>{" "}
            — le milieu des bornes physiques pour le type de vélo, qui ne
            dépend pas du prior choisi.
          </li>
          <li>
            <strong>Tolérances resserrées.</strong> Passage à{" "}
            <code>ftol = xtol = gtol = 1e-10</code> avec{" "}
            <code>x_scale = "jac"</code>. L'optimiseur converge maintenant
            jusqu'à la précision machine de la Hessienne, ce qui élimine
            le bruit de convergence multi-start.
          </li>
        </ol>
        <P>
          Après le fix, le même test de cohérence sur le dataset Laurette
          donne <strong>0 ride</strong> avec un{" "}
          <code>cda_raw</code> non invariant.
        </P>
      </Section>

      <Section title="Pourquoi cda (post-prior) bouge encore légèrement">
        <P>
          Même avec un solveur parfait, le <code>cda</code>{" "}
          post-prior peut bouger entre deux runs au prior différent — c'est
          attendu et c'est <em>l'objet même du prior</em>. Le shrinkage
          bayésien tire chaque ride vers le centre du prior, donc deux
          priors différents tirent vers des centres différents. La question
          n'est pas « est-ce que <code>cda</code> bouge ? » mais{" "}
          <strong>« est-ce qu'il bouge moins que la largeur du prior ? »</strong>.
        </P>
        <P>
          Le bon ordre de grandeur : pour un prior de largeur{" "}
          <Tex>{String.raw`\sigma_{\text{prior}} = 0.08`}</Tex>, un
          déplacement de <Tex>{String.raw`\mu`}</Tex> de moins de{" "}
          <Tex>{String.raw`0.005\;\text{m}^2`}</Tex> entre deux centres
          espacés de <Tex>{String.raw`0.10`}</Tex> est cohérent avec
          l'attendu. Plus ne l'est pas, et signale un problème dans le
          solveur (cas observé sur Laurette) ou dans le scaling adaptatif
          du prior (un facteur <Tex>{String.raw`\lambda > 3`}</Tex>{" "}
          écrasait l'information de la ride avant le fix de plafonnement).
        </P>
      </Section>

      <Section title="Méthode hiérarchique vs. moyenne pondérée">
        <P>
          La méthode hiérarchique (DerSimonian–Laird) est{" "}
          <strong>par construction indépendante du prior CdA</strong>. Elle
          n'utilise jamais le prior bayésien : chaque ride contribue son{" "}
          <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> et son{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> (extraits du fit), puis la
          combinaison aggregate via les poids random-effects{" "}
          <Tex>{String.raw`w_i = 1/(\sigma_i^2 + \hat{\tau}^2)`}</Tex>.
          Aucun prior n'apparaît dans cette formule.
        </P>
        <P>
          C'est pour ça que la méthode hiérarchique est exposée à côté de
          la méthode A (inverse-variance pondérée par{" "}
          <Tex>{String.raw`n_{\text{points}}`}</Tex>) : elle sert de{" "}
          <strong>contrôle</strong>. Si la méthode A et la méthode
          hiérarchique donnent des chiffres différents de plus de{" "}
          <Tex>{String.raw`0.01\;\text{m}^2`}</Tex>, c'est qu'au moins une
          des deux est tirée par un poids excentré (typiquement une ride au{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> très petit qui domine la
          moyenne hiérarchique). L'UI affiche aussi <code>n_eff</code>{" "}
          pour ce diagnostic : si{" "}
          <Tex>{String.raw`n_{\text{eff}} \ll N`}</Tex>, le résultat
          hiérarchique est dominé par quelques rides — à interpréter avec
          prudence.
        </P>
      </Section>

      <Section title="En pratique : que faut-il vérifier ?">
        <Note>
          <strong>Le test rapide.</strong> Si vous voulez vérifier que
          votre dataset est bien calibré, lancez deux fois la même
          analyse depuis l'UI — une fois avec « Aéro (drops) » et une fois
          avec « Modérée (cocottes) ». Comparez le « CdA moyen » des deux
          runs. S'il diffère de moins de <Tex>{String.raw`0.005\;\text{m}^2`}</Tex>,
          tout va bien. Sinon, regardez la chip qui a un{" "}
          <code>cda_raw</code> différent entre les deux runs (visible dans
          le tooltip d'exclusion) — c'est probablement un problème de
          convergence sur cette ride en particulier.
        </Note>
        <P>
          La méthode hiérarchique reste votre filet de sécurité : son
          <Tex>{String.raw`\mu`}</Tex> ne bouge littéralement <em>jamais</em>{" "}
          avec le prior, par construction. Si la méthode A bouge et que la
          hiérarchique ne bouge pas, vous savez que c'est le shrinkage
          bayésien qui parle, pas le pipeline qui est cassé.
        </P>
      </Section>

      <Section title="Références">
        <P>
          Gelman A, Carlin JB, Stern HS, Dunson DB, Vehtari A, Rubin DB.{" "}
          <em>Bayesian Data Analysis (3e éd.)</em>. CRC Press, 2013.
          Chapitre 2.4 : « Sensitivity to choice of prior distribution ».
        </P>
        <P>
          Branch MA, Coleman TF, Li Y. <em>A subspace, interior, and
          conjugate gradient method for large-scale bound-constrained
          minimization problems</em>. SIAM J. Sci. Comput. 1999. — La
          référence pour <code>scipy.optimize.least_squares</code> en mode
          TRF, et la discussion des tolérances <code>ftol/xtol/gtol</code>.
        </P>
      </Section>
    </Article>
  );
}
