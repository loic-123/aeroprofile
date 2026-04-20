import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function BayesianPriors() {
  return (
    <Article title="Priors bayésiens : comment stabiliser le solveur">
      <P>
        Quand les données sont bonnes (sortie variée, vent faible, capteur
        calibré), le solveur trouve
        le <Tex>{String.raw`C_dA`}</Tex> et
        le <Tex>{String.raw`C_{rr}`}</Tex> sans aide. Mais quand les données
        sont insuffisantes (sortie courte, vent fort mal estimé, drafting),
        le solveur peut "diverger" vers des valeurs absurdes. Les priors
        bayésiens sont un filet de sécurité mathématique.
      </P>

      <Section title="L'intuition : un avis d'expert doux">
        <P>
          Un prior, c'est une croyance initiale. Avant de voir vos données,
          on "croit" que votre <Tex>{String.raw`C_dA`}</Tex> est probablement
          autour de 0.30 (position route typique) et
          votre <Tex>{String.raw`C_{rr}`}</Tex> autour de 0.0035 (pneu route
          tubeless sur asphalte). Plus les données sont abondantes et
          cohérentes, plus le prior s'efface. Plus les données sont bruitées,
          plus le prior pèse.
        </P>
        <P>
          C'est comme demander à un expert : "d'après votre expérience,
          quel <Tex>{String.raw`C_dA`}</Tex> attendez-vous pour un cycliste
          sur route ?" L'expert dit{" "}
          <Tex>{String.raw`0.32 \pm 0.08`}</Tex>. Pour un CLM, il dirait{" "}
          <Tex>{String.raw`0.22 \pm 0.05`}</Tex>. Si vos données disent
          clairement 0.35, on retient 0.35. Si vos données sont contradictoires
          et confuses, on retient quelque chose proche du centre du prior pour
          votre type de vélo.
        </P>
      </Section>

      <Section title="La formulation mathématique">
        <P>
          Le solveur minimise une somme de résidus carrés (approche moindres
          carrés non linéaires). Sans prior, la fonction objectif est
          simplement :
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{data}} = \sum_{i=1}^{N} \bigl( P_{\text{modele}}(i) - P_{\text{mesure}}(i) \bigr)^2`}</Formula>
        <P>
          Un prior gaussien ajoute un terme de pénalité quadratique pour chaque
          paramètre. Cela correspond exactement à l'estimation MAP (Maximum A
          Posteriori) sous hypothèse de priors gaussiens et de bruit gaussien :
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{MAP}} = \sum_{i=1}^{N} \bigl( P_{\text{modele}}(i) - P_{\text{mesure}}(i) \bigr)^2 + w \cdot \left(\frac{C_{rr} - \mu_{C_{rr}}}{\sigma_{C_{rr}}}\right)^{\!2} + w \cdot \left(\frac{C_dA - \mu_{C_dA}}{\sigma_{C_dA}}\right)^{\!2}`}</Formula>
        <P>
          où <Tex>{String.raw`w`}</Tex> est le poids du prior, calibré pour
          qu'il pèse comme environ 3 bons points de données. Le
          terme <Tex>{String.raw`w`}</Tex> est adaptatif : il est proportionné
          à <Tex>{String.raw`\sqrt{N}`}</Tex> et au RMSE des résidus, de sorte
          que le prior pèse relativement moins quand les données sont
          abondantes.
        </P>
        <P>
          Plus le <Tex>{String.raw`C_dA`}</Tex> s'éloigne
          de <Tex>{String.raw`\mu = 0.30`}</Tex>, plus le terme de prior
          pénalise la solution. Mais
          comme <Tex>{String.raw`\sigma = 0.12`}</Tex> est large, la pénalité
          est très faible dans la plage normale (0.20 à 0.45). Elle ne devient
          significative que pour des valeurs extrêmes
          (<Tex>{String.raw`C_dA < 0.15`}</Tex>{" "}
          ou <Tex>{String.raw`C_dA > 0.60`}</Tex>).
        </P>
      </Section>

      <Section title="Pourquoi c'est du MAP">
        <P>
          En inférence bayésienne, le théorème de Bayes donne :
        </P>
        <Formula>{String.raw`p(\theta \mid \text{data}) \propto p(\text{data} \mid \theta) \cdot p(\theta)`}</Formula>
        <P>
          Avec un modèle de bruit
          gaussien, <Tex>{String.raw`-\ln p(\text{data} \mid \theta)`}</Tex>{" "}
          est proportionnel à la somme des résidus carrés. Avec un prior
          gaussien <Tex>{String.raw`\theta \sim \mathcal{N}(\mu, \sigma^2)`}</Tex>,{" "}
          <Tex>{String.raw`-\ln p(\theta)`}</Tex> est proportionnel
          à <Tex>{String.raw`(\theta - \mu)^2 / \sigma^2`}</Tex>. Maximiser
          la postériorale (MAP) revient donc exactement à minimiser{" "}
          <Tex>{String.raw`\mathcal{L}_{\text{MAP}}`}</Tex>. C'est une
          régularisation de Tikhonov avec une interprétation probabiliste.
        </P>
      </Section>

      <Section title="Les priors d'AeroProfile">
        <P>
          Les priors sur <Tex>{String.raw`C_{rr}`}</Tex> et le vent sont fixes :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Paramètre</th>
                <th className="py-2">Distribution</th>
                <th className="py-2">Rôle</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-mono"><Tex>{String.raw`C_{rr}`}</Tex></td>
                <td><Tex>{String.raw`\mathcal{N}(0.0035,\; 0.0012^2)`}</Tex></td>
                <td className="text-muted">Empêche <Tex>{String.raw`C_{rr}`}</Tex> d'absorber les erreurs de vent</td>
              </tr>
              <tr>
                <td className="py-1.5 font-mono">Vent</td>
                <td><Tex>{String.raw`\mathcal{N}(V_{\text{API}},\; 2^2)`}</Tex></td>
                <td className="text-muted">Permet au vent de s'éloigner de l'API de ±4 m/s</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          Le prior <Tex>{String.raw`C_{rr}`}</Tex> a été abaissé
          de <Tex>{String.raw`\mathcal{N}(0.004,\; 0.0015^2)`}</Tex>{" "}
          à <Tex>{String.raw`\mathcal{N}(0.0035,\; 0.0012^2)`}</Tex> pour
          mieux correspondre aux mesures récentes sur pneus tubeless
          (Silca 2023, BRR 2024).
        </Note>
      </Section>

      <Section title="Prior CdA adapté au type de vélo">
        <P>
          Contrairement au <Tex>{String.raw`C_{rr}`}</Tex>, le prior
          sur <Tex>{String.raw`C_dA`}</Tex> <strong>dépend du type de vélo</strong>{" "}
          sélectionné par l'utilisateur. Un cycliste en position CLM a un{" "}
          <Tex>{String.raw`C_dA`}</Tex> attendu très différent d'un vététiste.
          Utiliser le même prior pour les deux serait sous-optimal : trop large
          pour le CLM (où la plage est étroite), trop centré pour le VTT.
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Type de vélo</th>
                <th className="py-2">Prior <Tex>{String.raw`C_dA`}</Tex></th>
                <th className="py-2">Bornes solveur</th>
                <th className="py-2">Positions typiques</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans"><strong>Route</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.32,\; 0.08^2)`}</Tex></td>
                <td>[0.20, 0.55]</td>
                <td className="font-sans text-muted">Drops → tops</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans"><strong>CLM / Triathlon</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.22,\; 0.05^2)`}</Tex></td>
                <td>[0.15, 0.35]</td>
                <td className="font-sans text-muted">Prolongateurs → aéro hoods</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans"><strong>VTT / Gravel</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.45,\; 0.08^2)`}</Tex></td>
                <td>[0.30, 0.65]</td>
                <td className="font-sans text-muted">Position relevée, pneus larges</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Le prior CLM est plus serré (<Tex>{String.raw`\sigma = 0.05`}</Tex>)
          car la plage de <Tex>{String.raw`C_dA`}</Tex> en position aéro est
          étroite (0.17–0.30). Les priors Route et VTT sont plus larges
          (<Tex>{String.raw`\sigma = 0.08`}</Tex>) car les positions varient
          davantage.
        </P>
        <P>
          Ce prior s'applique aux <strong>trois solveurs</strong> (Martin LS,
          Chung VE, Wind-Inverse) et influence aussi les bornes du solveur et
          les points de départ du multi-start. Le résultat : le solveur converge
          plus vite vers la bonne zone et ne donne pas de{" "}
          <Tex>{String.raw`C_dA = 0.50`}</Tex> pour un CLM ni{" "}
          <Tex>{String.raw`C_dA = 0.20`}</Tex> pour un VTT.
        </P>
      </Section>

      <Section title="Sensibilité et poids adaptatif du prior">
        <P>
          Le poids du prior dans la fonction objectif est :
        </P>
        <Formula>{String.raw`w_{\text{eff}} = 0.3 \cdot \sqrt{N} \cdot \max\!\left(1,\; \frac{\sigma_{\text{Hess}}}{\sigma_{\text{prior}}}\right)`}</Formula>
        <P>
          Le facteur adaptatif <Tex>{String.raw`\max(1,\sigma_{\text{Hess}}/\sigma_{\text{prior}})`}</Tex>{" "}
          implémente l'intuition bayésienne standard : quand les données sont
          informatives (<Tex>{String.raw`\sigma_{\text{Hess}} \leq \sigma_{\text{prior}}`}</Tex>),
          le facteur vaut 1 et le prior agit comme un stabilisateur doux. Quand
          les données sont bruitées ou peu informatives{" "}
          (<Tex>{String.raw`\sigma_{\text{Hess}} \gg \sigma_{\text{prior}}`}</Tex>), le
          prior monte proportionnellement pour empêcher le solveur de suivre le
          bruit et de taper les bornes physiques. C'est du shrinkage adaptatif
          façon James–Stein / ridge adaptatif.
        </P>
        <P>
          Le problème du chicken-and-egg — <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex>{" "}
          n'est connu qu'après optimisation — est résolu par une stratégie en
          deux passes :
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li><strong>Pass 1</strong> : solveur avec poids de base <Tex>{String.raw`0.3\sqrt{N}`}</Tex>,
          on extrait <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> de la Hessienne.</li>
          <li><strong>Pass 2</strong> (conditionnelle) : si le ratio dépasse 1,
          on relance le solveur avec le poids renforcé. Sinon on garde le pass 1.</li>
        </ol>
        <P>
          Un <strong>pass 0 supplémentaire</strong> (<Tex>{String.raw`w_{\text{CdA}}=0`}</Tex>)
          est exécuté en amont pour exposer <em>CdA hors prior</em> dans l'UI
          — l'utilisateur voit explicitement comment le prior CdA a déplacé
          l'estimation. Attention à ne pas lire &laquo; MLE pur &raquo; dans ce
          chiffre : le prior vent (tirant le champ de vent fitté vers
          Open-Meteo) et le prior Crr (tirant vers 0.0035) restent actifs à
          leur poids de base. Les désactiver aussi rendrait le problème
          sous-déterminé — wind_inverse a 150+ paramètres vent libres contre
          ~3000 résidus altitude, donc sans régularisation le solveur trouve
          une infinité de (vent, CdA) équivalents et le point retourné devient
          aléatoire. Le pass 0 est donc un <strong>MLE conditionnel</strong> :
          CdA libre, vent et Crr doucement régularisés.
        </P>
        <P>
          Deuxième garde-fou essentiel à la pass 2 : le facteur adaptatif
          est <strong>capé à 3.0</strong>. Si
          <Tex>{String.raw`\sigma_{\text{Hess}}/\sigma_{\text{prior}} > 3`}</Tex>,
          la ride est effectivement non-identifiable et doit être marquée
          comme telle par le quality gate (statut <code>non_identifiable</code>),
          pas &laquo; sauvée &raquo; par un prior qui écrase 10× la
          vraisemblance. Sans ce cap, sur une ride où{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}} \approx 0.5`}</Tex>, le facteur
          monterait à ~6 et le MAP serait essentiellement{" "}
          <Tex>{String.raw`\mu_0`}</Tex> avec{" "}
          <Tex>{String.raw`\pm \epsilon`}</Tex> — donnant l'illusion d'un
          résultat alors que le prior a fait tout le travail.
        </P>
        <Formula>{String.raw`w_{\text{eff,base}} = 0.3 \cdot \sqrt{N}`}</Formula>
        <P>
          Le facteur <Tex>{String.raw`\sqrt{N}`}</Tex> garantit qu'avec
          beaucoup de données, le prior pèse relativement <em>moins</em>
          (la somme des résidus croît en <Tex>{String.raw`N`}</Tex>, le prior
          en <Tex>{String.raw`\sqrt{N}`}</Tex>).
        </P>
        <Warning>
          <strong>Correction d'avril 2026.</strong> L'ancienne formule
          était <Tex>{String.raw`w_{\text{eff}} = 0.3\sqrt{N}\cdot\max(1,\text{RMSE})`}</Tex>{" "}
          : elle <em>multipliait</em> le poids par le RMSE, donc le prior pesait{" "}
          <strong>plus</strong> quand les données étaient bruitées. C'est
          l'inverse du formalisme bayésien standard : avec des données bruitées,
          la vraisemblance est mécaniquement plus plate, et le prior domine
          déjà naturellement la posterieure sans avoir besoin de monter son
          poids. Le facteur RMSE confondait régularisation de Tikhonov (où on
          peut ajuster <Tex>{String.raw`\lambda`}</Tex> librement) et prior
          bayésien (où le poids vient directement
          de <Tex>{String.raw`1/\sigma^2`}</Tex>). Sur 30 rides bruitées de
          notre dataset de test, le bug créait un écart{" "}
          <Tex>{String.raw`\Delta C_dA = 0.044`}</Tex> selon le prior choisi
          par l'utilisateur ; après correction, l'écart tombe à{" "}
          <Tex>{String.raw`\Delta C_dA \approx 0.0001`}</Tex> (440× moins).
          Réf. Gelman BDA3 ch. 14, Bishop PRML §3.3.
        </Warning>
      </Section>

      <Section title="Le piège du prior en multi-rides et sa résolution">
        <P>
          Appliquer un prior par ride pose un problème spécifique au
          multi-rides : <strong>le shrinkage est systématique</strong>. Chaque
          ride <Tex>{String.raw`i`}</Tex> retourne une estimation MAP{" "}
          <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> légèrement tirée vers le
          centre du prior <Tex>{String.raw`\mu_0`}</Tex>. Quand on moyenne{" "}
          <Tex>{String.raw`N`}</Tex> rides, ce biais persiste — aucun théorème
          de grands nombres ne le sauve, car il n'est pas stochastique.
        </P>
        <P>
          Dans une version antérieure, le pipeline <em>désactivait
          complètement</em> le prior CdA dès que plus d'une ride était
          analysée. Cette solution était brutale et cassait deux choses :
          (1) les rides individuelles faiblement contraintes (col tout droit,
          peu de variété de vitesse) tapaient alors les bornes physiques et
          étaient exclues ; (2) le changement de position dans le sélecteur
          n'avait plus aucun effet, ce qui induisait l'utilisateur en erreur.
        </P>
        <P>
          La vraie solution combine deux mécanismes indépendants :
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>Prior adaptatif</strong> avec plafond à 3.0 (décrit
            ci-dessus) : sur les rides bien contraintes, le facteur vaut 1 et
            le shrinkage est négligeable ; sur les rides bruitées, le prior
            monte mais reste borné.
          </li>
          <li>
            <strong>Méthode hiérarchique (DerSimonian–Laird)</strong> : au
            lieu d'estimer chaque ride indépendamment puis de moyenner, on
            estime <Tex>{String.raw`\hat{\tau}^2`}</Tex> en forme fermée à
            partir de Cochran's Q, puis on combine les{" "}
            <Tex>{String.raw`C_{dA,i}`}</Tex> avec les poids random-effects{" "}
            <Tex>{String.raw`w_i = 1/(\sigma_i^2 + \hat{\tau}^2)`}</Tex>. Le
            prior sur <Tex>{String.raw`\mu`}</Tex> est appris depuis les
            données, pas imposé. Voir l'article{" "}
            <em>Méthodes d'agrégation multi-rides</em>.
          </li>
        </ol>
        <P>
          Résultat mesuré sur un dataset test 4iiii (30 rides bruitées) : l'écart
          entre prior &quot;Aéro drops&quot; et prior &quot;Relâchée
          tops&quot; tombe de{" "}
          <Tex>{String.raw`\Delta C_dA = 0.044\;\text{m}^2`}</Tex> à{" "}
          <Tex>{String.raw`\Delta C_dA \approx 0.0001`}</Tex> (440× moins).
        </P>
      </Section>

      <Section title="Impact mesuré et intervalles de confiance">
        <P>
          Sur les rides bien contraintes (variété de vitesses, heading divers),
          le prior déplace le <Tex>{String.raw`C_dA`}</Tex>{" "}
          de <Tex>{String.raw`< 0.005\;\text{m}^2`}</Tex> — invisible. Sur
          les rides mal contraintes (montée de col tout droit pendant 2h), le
          prior peut déplacer le <Tex>{String.raw`C_dA`}</Tex>{" "}
          de <Tex>{String.raw`\sim 0.03\;\text{m}^2`}</Tex> vers{" "}
          <Tex>{String.raw`\mu_0`}</Tex>, ce qui évite un résultat aberrant.
          Quand cet écart dépasse 0.05 m², la ride est marquée{" "}
          <code>prior_dominated</code> et l'utilisateur voit un badge
          d'avertissement.
        </P>
        <P>
          <strong>Les IC sont calculés sur la Hessienne complète</strong> —
          c'est-à-dire avec les lignes de résidus <em>data</em> ET les lignes
          de résidus <em>prior</em>. La Hessienne postérieure est la somme de
          la Hessienne data et de la Hessienne prior, donc l'approximation de
          Laplace exacte nécessite les deux. Une version antérieure excluait
          les lignes prior en pensant que l'IC refléterait alors &laquo;
          l'incertitude des données seules &raquo;, mais c'était une erreur :
          en pass 2 adaptative, le prior pesait lourd mais n'était pas inclus
          dans la courbure, ce qui surestimait{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> et déclenchait des
          pass 2 superflues. La correction (inclusion des lignes prior) donne
          maintenant l'incertitude postérieure correcte.
        </P>
      </Section>

      <Section title="Références">
        <P>
          La formulation est celle du MAP (Maximum A Posteriori), cas
          particulier d'inférence bayésienne avec des priors gaussiens, aussi
          connue sous le nom de régularisation de Tikhonov en optimisation.
          Les valeurs de référence sont issues de Debraux et al. (2011) pour
          le <Tex>{String.raw`C_dA`}</Tex> et Lim, Homan &amp; Dalbert (2011)
          pour l'approche bayésienne appliquée à l'estimation des paramètres
          de performance cycliste.
        </P>
      </Section>
    </Article>
  );
}
