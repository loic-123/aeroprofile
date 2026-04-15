import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function Solvers() {
  return (
    <Article title="Les 3 solveurs d'AeroProfile : Martin LS, Chung VE, Wind-Inverse">
      <P>
        AeroProfile dispose de trois méthodes pour estimer votre{" "}
        <Tex>{String.raw`C_dA`}</Tex>. Chacune repose sur un modèle physique
        différent et a ses forces et faiblesses. Le pipeline les essaie en
        cascade et retient celle qui donne le meilleur{" "}
        <Tex>{String.raw`R^2`}</Tex>.
      </P>

      <Section title="1. Martin LS (moindres carrés sur la puissance)">
        <P>
          C'est l'approche la plus directe, inspirée du modèle de puissance de
          Martin et al. (1998). Pour chaque seconde de votre sortie, le modèle
          prédit quelle puissance vous auriez dû produire avec un{" "}
          <Tex>{String.raw`C_dA`}</Tex> et <Tex>{String.raw`C_{rr}`}</Tex>{" "}
          candidats. Le solveur ajuste ces deux paramètres pour minimiser la
          somme des écarts au carré entre puissance modélisée et puissance
          mesurée.
        </P>
        <Formula>{String.raw`\min_{C_dA,\, C_{rr}} \sum_{i=1}^{N} \bigl( P_{\text{modele}}(i) - P_{\text{mesure}}(i) \bigr)^2`}</Formula>
        <P>
          La puissance modélisée à chaque instant <Tex>{String.raw`i`}</Tex> est
          la somme de quatre termes :
        </P>
        <Formula>{String.raw`P_{\text{modele}} = \underbrace{\tfrac{1}{2}\,C_dA\,\rho\,V_{\text{air}}^2\,V}_{\text{aerodynamique}} + \underbrace{C_{rr}\,m\,g\,V}_{\text{roulement}} + \underbrace{m\,g\,V\,\text{pente}}_{\text{gravite}} + \underbrace{\tfrac{1}{2}\,m\,\frac{\Delta(V^2)}{\Delta t}}_{\text{acceleration}}`}</Formula>
        <P>
          L'optimisation est résolue via{" "}
          <strong>scipy.optimize.least_squares</strong> avec l'algorithme
          Trust Region Reflective (TRF). AeroProfile lance 3 points de départ
          (stratégie multi-start) pour éviter les minima locaux, avec des bornes
          strictes :
        </P>
        <Formula>{String.raw`C_dA \in [0.15,\; 0.60], \quad C_{rr} \in [0.0015,\; 0.012]`}</Formula>
        <P>
          <strong>Forces</strong> : simple, rapide, et fournit des intervalles de
          confiance directement depuis la matrice jacobienne{" "}
          <Tex>{String.raw`J`}</Tex> du solveur. La covariance est estimée par{" "}
          <Tex>{String.raw`\text{Cov} \approx \sigma^2 (J^\top J)^{-1}`}</Tex>{" "}
          où <Tex>{String.raw`\sigma^2`}</Tex> est la variance résiduelle.
        </P>
        <P>
          <strong>Faiblesses</strong> : très sensible au bruit instantané (GPS,
          puissance, vent). Chaque seconde de données bruitées ajoute un
          résidu carré qui amplifie les outliers. Si le capteur de puissance
          fluctue de <Tex>{String.raw`\pm 20\,\text{W}`}</Tex>, chaque point
          contribue <Tex>{String.raw`20^2 = 400`}</Tex> au coût total. Le{" "}
          <Tex>{String.raw`R^2`}</Tex> est souvent faible sur les sorties
          réelles (<Tex>{String.raw`< 0.5`}</Tex>).
        </P>
      </Section>

      <Section title="2. Chung VE (Virtual Elevation)">
        <P>
          Inventée par Robert Chung, cette méthode est la base d'outils comme
          Golden Cheetah Aerolab. Au lieu de comparer la puissance seconde par
          seconde, on intègre le bilan d'énergie pour reconstruire une
          "altitude virtuelle" et on la compare à l'altitude GPS réelle.
        </P>
        <P>
          À chaque pas de temps <Tex>{String.raw`\Delta t`}</Tex>, on calcule
          les contributions énergétiques :
        </P>
        <Formula>{String.raw`\begin{aligned}
E_{\text{entree}} &= P \cdot \eta \cdot \Delta t \\
E_{\text{aero}} &= \tfrac{1}{2}\,C_dA\,\rho\,V_{\text{air}}^2\,V\,\Delta t \\
E_{\text{roulement}} &= C_{rr}\,m\,g\,V\,\Delta t \\
E_{\text{cinetique}} &= \tfrac{1}{2}\,m\,\bigl(V_i^2 - V_{i-1}^2\bigr)
\end{aligned}`}</Formula>
        <P>
          L'énergie potentielle résiduelle donne la variation d'altitude
          virtuelle :
        </P>
        <Formula>{String.raw`\Delta h_i = \frac{E_{\text{entree}} - E_{\text{aero}} - E_{\text{roulement}} - E_{\text{cinetique}}}{m \cdot g}`}</Formula>
        <Formula>{String.raw`h_{\text{virtuelle}}(t) = \sum_{i=1}^{t} \Delta h_i`}</Formula>
        <P>
          L'objectif est de minimiser l'écart entre altitude virtuelle et
          altitude réelle :
        </P>
        <Formula>{String.raw`\min_{C_dA,\, C_{rr}} \sum_{i=1}^{N} \bigl( h_{\text{virtuelle}}(i) - h_{\text{reelle}}(i) \bigr)^2`}</Formula>
        <P>
          <strong>Pourquoi c'est mieux</strong> : l'intégration temporelle lisse
          naturellement le bruit. Si le capteur de puissance fluctue de{" "}
          <Tex>{String.raw`\pm 20\,\text{W}`}</Tex> à chaque seconde, Martin LS
          voit <Tex>{String.raw`20^2 = 400`}</Tex> de résidu carré à chaque
          point. Chung VE intègre ces fluctuations — elles s'annulent dans la
          somme cumulative — et le résidu d'altitude est beaucoup plus lisse.
          C'est le même principe qu'un filtre passe-bas : l'intégration
          atténue les hautes fréquences.
        </P>
        <P>
          <strong>Limitation</strong> : si la sortie est coupée en morceaux
          par les filtres (descentes exclues, arrêts), l'intégration repart
          de zéro à chaque bloc. On perd la "mémoire" d'altitude entre les
          blocs. AeroProfile gère ça par un alignement per-block : à chaque
          frontière de bloc, l'altitude virtuelle et l'altitude cible sont
          remises à zéro pour éviter toute pénalisation de dérive inter-bloc.
        </P>
      </Section>

      <Section title="3. Wind-Inverse (le plus avancé)">
        <P>
          Le wind-inverse combine le meilleur des deux mondes : l'objectif VE
          de Chung (robuste au bruit) avec une estimation du vent en tant que
          variable libre. Au lieu de croire aveuglément l'API météo, le solveur
          estime lui-même les composantes du vent par segment temporel.
        </P>
        <P>
          Les paramètres estimés conjointement sont :
        </P>
        <Formula>{String.raw`\boldsymbol{\theta} = \bigl(\, C_{dA_0},\; C_{rr},\; u_1, v_1,\; u_2, v_2,\; \ldots,\; u_K, v_K \,\bigr)`}</Formula>
        <P>
          où <Tex>{String.raw`C_{dA_0}`}</Tex> est le{" "}
          <Tex>{String.raw`C_dA`}</Tex> à yaw nul,{" "}
          <Tex>{String.raw`(u_k, v_k)`}</Tex> sont les composantes est-ouest
          et nord-sud du vent pour le segment{" "}
          <Tex>{String.raw`k`}</Tex> (segments de 30 min), soit un total de{" "}
          <Tex>{String.raw`2 + 2K`}</Tex> paramètres. Par exemple, une sortie
          de 2h donne 4 segments et 10 paramètres.
        </P>
        <P>
          Des priors gaussiens régularisent l'estimation pour éviter les
          solutions dégénérées :
        </P>
        <Formula>{String.raw`\begin{aligned}
C_{rr} &\sim \mathcal{N}(0.0035,\; 0.0012^2) \\
C_{dA} &\sim \mathcal{N}(0.30,\; 0.12^2) \\
\text{vent}_k &\sim \mathcal{N}(\text{valeur API}_k,\; 2^2\;\text{m/s})
\end{aligned}`}</Formula>
        <P>
          Le prior sur le vent est centré sur la valeur renvoyée par l'API
          Open-Meteo, avec un écart-type de{" "}
          <Tex>{String.raw`2\,\text{m/s}`}</Tex> qui laisse au solveur la
          liberté de corriger les erreurs de prévision météorologique tout en
          empêchant des valeurs de vent aberrantes.
        </P>
        <P>
          <strong>Condition d'activation</strong> : variance du heading{" "}
          <Tex>{String.raw`> 0.25`}</Tex>. Si vous roulez tout droit (col de
          montagne), le vent et le <Tex>{String.raw`C_dA`}</Tex> sont
          colinéaires et donc indistinguables — le wind-inverse ne s'active
          pas et Chung VE prend le relais avec le vent API.
        </P>
      </Section>

      <Section title="La cascade : comment AeroProfile choisit">
        <P>
          Depuis avril 2026, la cascade a été repensée pour éviter de lancer
          Martin LS sur des sorties où il n'a aucune chance de battre le
          wind-inverse. Sur un dataset réel de 120 sorties, Martin LS sortait
          <strong> R² négatif dans 44% des cas</strong>, gâchant ~200 ms par
          ride avant que le wind-inverse prenne le relais. Le nouveau pipeline
          skip Martin LS dès que le wind-inverse peut s'exprimer :
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>Martin LS</strong> — lancé <em>uniquement</em> si{" "}
            <Tex>{String.raw`\sigma^2_{\text{heading}} < 0.25`}</Tex>. C'est
            le cas des sorties quasi-linéaires (piste, vélodrome, aller sans
            retour) où le wind-inverse n'a pas assez de diversité pour séparer
            le vent du <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Wind-Inverse</strong> — le solveur primaire sur toutes les
            autres sorties. Estime conjointement{" "}
            <Tex>{String.raw`(C_dA, C_{rr}, \text{vent})`}</Tex> par segment
            en minimisant l'erreur de reconstruction d'altitude (Chung VE).
          </li>
          <li>
            <strong>Chung VE</strong> — fallback de dernier recours si aucun
            des solveurs précédents n'a produit un{" "}
            <Tex>{String.raw`R^2 > 0.3`}</Tex>. Garantit qu'une analyse ne
            peut jamais sortir sans résultat.
          </li>
        </ol>
        <P>
          Le solveur retenu est affiché dans le bandeau bleu du dashboard
          ("Méthode : wind_inverse", "Méthode : chung_ve").
        </P>
      </Section>

      <Section title="Contrôle croisé Chung VE (toujours actif)">
        <P>
          Même quand le wind-inverse fournit un résultat propre, <strong>Chung
          VE est exécuté systématiquement</strong> sur la même ride comme
          contrôle indépendant. Contrairement à la cascade de fallback
          ci-dessus, ce second run n'est jamais affecté à la place du wind :
          il sert uniquement à exposer le delta entre les deux estimations.
        </P>
        <P>
          La métrique est simple :{" "}
          <Tex>{String.raw`\Delta = |C_{dA,\text{wind}} - C_{dA,\text{chung}}|`}</Tex>.
          Les deux solveurs utilisent la même fonction objectif (erreur de
          reconstruction d'altitude) donc ce delta est dans les mêmes unités
          et comparable directement. Les seuils de classification :
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text text-sm">
          <li>
            <strong>high</strong> — <Tex>{String.raw`|\Delta| < 0.02`}</Tex>.
            Les deux solveurs convergent à 2 cm² près malgré des traitements
            du vent radicalement différents (wind-inverse fitte le vent,
            Chung utilise l'API brute). L'estimation est robuste.
          </li>
          <li>
            <strong>medium</strong> —{" "}
            <Tex>{String.raw`0.02 \leq |\Delta| < 0.05`}</Tex>. Léger
            désaccord, souvent dû à une erreur systématique d'Open-Meteo sur
            la zone (sous-estimation du vent de face typique en Bretagne,
            surestimation en Provence selon la direction dominante).
          </li>
          <li>
            <strong>low</strong> — <Tex>{String.raw`|\Delta| \geq 0.05`}</Tex>.
            Désaccord fort — la ride est très sensible au traitement du vent.
            Typiquement une ride unidirectionnelle (vent très fort, heading
            variance élevée) où le wind-inverse fitte un champ de vent peu
            contraint.
          </li>
          <li>
            <strong>unknown</strong> — un ou plusieurs solveurs (wind MAP,
            chung MAP, wind raw, chung raw) sont collés à{" "}
            <Tex>{String.raw`0.005\;\text{m}^2`}</Tex> d'une borne physique.
            Dans ce cas, le delta entre les deux solveurs peut sembler
            minuscule alors qu'en réalité ils sont tous les deux scotchés
            contre le mur — leur "accord" est un artefact de la borne, pas
            un signal que l'estimation est robuste. L'utilisation en priorité
            des valeurs <em>hors prior</em> (pass 0) permet de détecter ces
            cas : si même sans le prior le solveur ne bouge pas de la borne,
            c'est que les données forcent le résultat contre la contrainte
            physique.
          </li>
          <li>
            <strong>solvers_pegged</strong> (une classe à part) — quand{" "}
            <em>les deux</em> solveurs (le principal et le Chung cross-check)
            sont à moins de <Tex>{String.raw`0.010\;\text{m}^2`}</Tex> d'une
            borne physique <em>après</em> la passe 2 VE, la ride est
            classée <code>solvers_pegged</code> et{" "}
            <strong>exclue de l'agrégat</strong>. Deux solveurs indépendants
            qui convergent tous deux à la borne signifient que le modèle
            physique ne trouve pas de CdA cohérent pour cette sortie — les
            causes typiques sont un vent réel très différent d'Open-Meteo,
            une position très éloignée du prior, ou une combinaison vent +
            biais capteur. Aucun solveur isolé ne peut démêler ces causes,
            donc on refuse explicitement d'afficher une valeur.
          </li>
        </ul>
        <P>
          Le delta et la classification sont exposés en tant que badge sur
          chaque chip de ride et stockés dans l'historique. L'utilisateur
          peut activer un filtre &laquo; accord solveurs ≥ medium/high
          &raquo; dans l'interface Intervals pour exclure les rides en
          désaccord de l'agrégat. Par défaut, le filtre est désactivé : le
          badge est informatif, pas coercitif.
        </P>
        <P>
          Un indicateur complémentaire &laquo; biais solveur perso &raquo;
          calcule la médiane de{" "}
          <Tex>{String.raw`C_{dA,\text{chung}} - C_{dA,\text{wind}}`}</Tex>{" "}
          sur les rides passées propres de l'utilisateur. Cette valeur
          structure l'incertitude personnelle : si ton Open-Meteo est
          systématiquement faux dans une direction, la médiane sera non nulle
          et tu verras &laquo; Δ solveur perso : +0.020 &raquo; en dessous de
          l'IC Hessien.
        </P>
      </Section>

      <Section title="Prior adaptatif : trois passes par solveur">
        <P>
          Chaque solveur de la cascade est lancé en réalité{" "}
          <strong>jusqu'à trois fois</strong> sur la même sortie :
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>Pass 0 — MLE conditionnel</strong> (poids du prior{" "}
            <em>CdA</em> seul = 0). Donne{" "}
            <Tex>{String.raw`\widehat{C_dA}_{\text{hors prior}}`}</Tex> qu'on
            affiche dans l'UI quand le prior CdA a significativement tiré
            l'estimation (écart &gt; 0.02 m²). <strong>Important</strong> : le
            prior vent (vers Open-Meteo) et le prior Crr restent actifs à leur
            poids de base. Les désactiver aussi rendrait le problème
            sous-déterminé — wind_inverse a ~150 paramètres vent libres. Donc
            ce &laquo; MLE &raquo; n'est pas un MLE pur : c'est un MLE
            conditionnel où seule la contrainte CdA est relâchée.
          </li>
          <li>
            <strong>Pass 1 — prior de base</strong> avec{" "}
            <Tex>{String.raw`w = 0.3\sqrt{N}`}</Tex> (formule Gelman BDA3 ch.14).
            C'est le pass principal, fournit le point estimé publié dans l'API.
          </li>
          <li>
            <strong>Pass 2 — prior renforcé</strong> si{" "}
            <Tex>{String.raw`\sigma_{\text{Hess}} / \sigma_{\text{prior}} > 1`}</Tex>.
            Le poids du prior est alors multiplié par ce ratio, ce qui
            correspond à un shrinkage adaptatif type James-Stein : quand la
            vraisemblance est plate (données peu informatives), on laisse le
            prior dominer proportionnellement à son avantage informationnel.
            <strong> Le ratio est capé à 3.0</strong> — au-delà, la ride est
            effectivement non-identifiable et doit être marquée comme telle
            par le quality gate, pas rescapée par un prior qui écraserait 10×
            les données.
          </li>
        </ol>
        <P>
          Les intervalles de confiance sont calculés via l'approximation de
          Laplace sur la Hessienne <em>complète</em> — c'est-à-dire en
          incluant les lignes de résidus prior dans le Jacobien{" "}
          <Tex>{String.raw`J`}</Tex>, puis{" "}
          <Tex>{String.raw`\Sigma = \hat{s}^2 (J^\top J)^{-1}`}</Tex>. La
          raison : en pass 2, le prior pèse lourd ; la Hessienne postérieure
          est la somme de la Hessienne data et de la Hessienne prior. Exclure
          les lignes prior donnerait une courbure sous-estimée, donc un{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> surestimé, ce qui
          déclencherait des pass 2 superflues.
        </P>
        <P>
          L'idée derrière le pass 2 vient du fait qu'un prior fixe à{" "}
          <Tex>{String.raw`0.3\sqrt{N}`}</Tex> pèse proportionnellement moins
          que les données quand N est grand — parfait sur une sortie nette,
          problématique sur une sortie bruitée où on voudrait que le prior
          l'emporte. Le ratio{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}} / \sigma_{\text{prior}}`}</Tex>{" "}
          mesure exactement cette informativité : s'il est grand, les données
          ne distinguent pas bien le CdA, il faut faire confiance au prior.
        </P>
        <P>
          Après la cascade, une <strong>passe 2 itérative</strong> compare
          l'altitude virtuelle à l'altitude réelle via une approche hybride à
          deux critères. Le but est d'exclure les segments où le modèle
          diverge significativement, puis de relancer le solveur sur les
          points restants.
        </P>
        <P>
          <strong>Critère 1 — Taux de dérive</strong> : on calcule la dérivée
          temporelle de la dérive (lissée sur 30 s) entre altitude virtuelle
          et altitude réelle :
        </P>
        <Formula>{String.raw`\text{drift}(t) = h_{\text{virtuelle}}(t) - h_{\text{reelle}}(t)`}</Formula>
        <Formula>{String.raw`\text{drift\_rate}(t) = \left|\frac{d}{dt}\,\overline{\text{drift}}_{30s}(t)\right|`}</Formula>
        <P>
          Le seuil est adaptatif, basé sur le dénivelé positif normalisé par
          la durée :
        </P>
        <Formula>{String.raw`\text{seuil\_rate} = \max\!\bigl(0.10,\; 4 \times D^+ / T\bigr) \quad [\text{m/s}]`}</Formula>
        <P>
          <strong>Critère 2 — Dérive absolue (filet de sécurité)</strong> :
          même avec un taux de dérive faible, une longue accumulation peut
          indiquer un biais systématique. On exclut aussi les points où la
          dérive absolue lissée dépasse un seuil proportionnel au{" "}
          <Tex>{String.raw`D^+`}</Tex> total :
        </P>
        <Formula>{String.raw`|\overline{\text{drift}}_{60s}(t)| > \text{seuil\_abs}`}</Formula>
        <P>
          Les deux masques sont combinés (<Tex>{String.raw`\texttt{AND}`}</Tex>
          ) avec le filtre existant. Un <strong>cap de 30%</strong> empêche
          de retirer trop de points : si plus de 30% des points valides
          échouent au test VE, le modèle est globalement mauvais et le
          raffinement est annulé — on conserve le résultat de passe 1 tel
          quel.
        </P>
        <Formula>{String.raw`\frac{N_{\text{exclus par VE}}}{N_{\text{valides passe 1}}} > 0.30 \;\Rightarrow\; \text{pas de passe 2}`}</Formula>
        <P>
          Si le nombre de points exclus est significatif (
          <Tex>{String.raw`> 20`}</Tex>) et qu'il reste au moins 100 points
          valides, le meilleur solveur de passe 1 est relancé sur le jeu
          de données filtré. Le résultat est ensuite soumis à <strong>deux
          garde-fous d'acceptation</strong> avant de remplacer celui de passe 1 :
        </P>
        <ol className="list-decimal ml-6 space-y-1 text-text text-sm">
          <li>
            <strong>Pas de nouveau bound hit</strong> — si passe 1 n'était pas
            à la borne physique et passe 2 arrive à moins de 0.005 m² d'une
            borne, le résultat est rejeté. Retirer des points n'est pas censé
            faire dégénérer l'estimation.
          </li>
          <li>
            <strong>Pas de régression R²</strong> — si{" "}
            <Tex>{String.raw`R^2_{\text{passe 2}} < R^2_{\text{passe 1}} - 0.05`}</Tex>,
            le résultat est rejeté. Un sous-ensemble de points informatifs
            doit donner un fit aussi bon ou meilleur, pas pire.
          </li>
        </ol>
        <P>
          L'article dédié <em>Raffinement itératif hybride</em> détaille le
          bug historique que ces garde-fous corrigent (acceptation silencieuse
          d'un résultat &laquo; pile sur la borne &raquo;), la fréquence réelle
          de la passe 2 dans les runs de production (55–70% des rides) et les
          logs traçables produits pour le diagnostic a posteriori.
        </P>
      </Section>

      <Section title="Priors bayésiens : le filet de sécurité">
        <P>
          Tous les solveurs utilisent des priors gaussiens faibles sur{" "}
          <Tex>{String.raw`C_dA`}</Tex> et <Tex>{String.raw`C_{rr}`}</Tex>. Un
          prior est un "a priori" probabiliste : avant de voir les données, on
          exprime une croyance douce sur les valeurs plausibles du paramètre.
          Formellement, le coût augmente d'un terme de pénalité :
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{total}} = \underbrace{\sum_i r_i^2}_{\text{vraisemblance}} + \underbrace{w \cdot \left(\frac{C_{rr} - \mu_{C_{rr}}}{\sigma_{C_{rr}}}\right)^2}_{\text{prior } C_{rr}} + \underbrace{w \cdot \left(\frac{C_dA - \mu_{C_dA}}{\sigma_{C_dA}}\right)^2}_{\text{prior } C_dA}`}</Formula>
        <P>
          où <Tex>{String.raw`w`}</Tex> est un poids proportionnel à{" "}
          <Tex>{String.raw`\sqrt{N}`}</Tex> et à l'échelle des résidus, de
          sorte que le prior s'adapte automatiquement à la taille du jeu de
          données.
        </P>
        <P>
          Le prior sur <Tex>{String.raw`C_{rr}`}</Tex> est fixe quel que soit le
          type de vélo :
        </P>
        <Formula>{String.raw`C_{rr} \sim \mathcal{N}(0.0035,\; 0.0012^2) \quad \text{(pneu tubeless, asphalte)}`}</Formula>
        <P>
          Le prior sur <Tex>{String.raw`C_dA`}</Tex>, en revanche, <strong>dépend
          du type de vélo sélectionné</strong> par l'utilisateur. Cela permet au
          solveur de converger plus vite vers la bonne zone et d'éviter les
          résultats aberrants pour la discipline :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Type de vélo</th>
                <th className="py-2">Prior <Tex>{String.raw`C_dA`}</Tex></th>
                <th className="py-2">Bornes solveur</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans">Route</td>
                <td><Tex>{String.raw`\mathcal{N}(0.32,\; 0.08^2)`}</Tex></td>
                <td>[0.20, 0.55]</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans">CLM / Triathlon</td>
                <td><Tex>{String.raw`\mathcal{N}(0.22,\; 0.05^2)`}</Tex></td>
                <td>[0.15, 0.35]</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans">VTT / Gravel</td>
                <td><Tex>{String.raw`\mathcal{N}(0.45,\; 0.08^2)`}</Tex></td>
                <td>[0.30, 0.65]</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Quand les données sont bonnes, le prior ne fait presque rien — la
          vraisemblance domine largement. Quand les données sont mauvaises ou
          insuffisantes, il guide le solveur vers les valeurs attendues pour
          la discipline.
        </P>
        <Note>
          Voir l'article détaillé sur les priors bayésiens pour la formulation
          mathématique complète et le calibrage.
        </Note>
      </Section>
    </Article>
  );
}
