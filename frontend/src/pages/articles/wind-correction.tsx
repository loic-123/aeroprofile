import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function WindCorrection() {
  return (
    <Article title="Correction du vent : de l'API météo au wind-inverse">
      <P>
        Le vent est la plus grosse source d'erreur dans le calcul du{" "}
        <Tex>{String.raw`C_dA`}</Tex>. Un écart de 2 m/s entre le vent réel et
        le vent estimé produit environ 50 W d'erreur à 30 km/h — soit ~30 % du
        signal aérodynamique. L'erreur sur la puissance aéro est quadratique
        en <Tex>{String.raw`V_{\text{air}}`}</Tex> : comme{" "}
        <Tex>{String.raw`P_{\text{aéro}} = \tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^3`}</Tex>,
        une petite erreur sur le vent se retrouve amplifiée au cube dans la
        puissance. Voici comment AeroProfile s'attaque à ce problème, couche
        par couche.
      </P>

      <Section title="Couche 1 : les données Open-Meteo">
        <P>
          Open-Meteo fournit gratuitement les données météo historiques de
          n'importe quel jour, n'importe où. Pour chaque sortie, AeroProfile
          récupère heure par heure : vitesse du vent à 10 m (
          <Tex>{String.raw`V_{10}`}</Tex>), direction (convention météo :
          d'où le vent souffle, 0° = Nord), température{" "}
          <Tex>{String.raw`T`}</Tex>, humidité relative{" "}
          <Tex>{String.raw`\phi`}</Tex> et pression atmosphérique{" "}
          <Tex>{String.raw`p`}</Tex>.
        </P>
        <P>
          La masse volumique de l'air est calculée à chaque point via
          l'équation des gaz :
        </P>
        <Formula>{String.raw`\rho = \frac{p - \phi\,p_{\text{sat}}(T)}{R_d\,T} + \frac{\phi\,p_{\text{sat}}(T)}{R_v\,T}`}</Formula>
        <P>
          où <Tex>{String.raw`R_d = 287{,}05\;\text{J/(kg·K)}`}</Tex> est la
          constante de l'air sec,{" "}
          <Tex>{String.raw`R_v = 461{,}5\;\text{J/(kg·K)}`}</Tex> celle de la
          vapeur d'eau, et{" "}
          <Tex>{String.raw`p_{\text{sat}}`}</Tex> la pression de vapeur
          saturante (formule de Magnus).
        </P>
        <P>
          Problème : la résolution spatiale est d'environ 10 km. Le vent dans
          une vallée protégée peut être 3× plus faible qu'en crête, mais
          l'API donne la même valeur pour les deux.
        </P>
      </Section>

      <Section title="Couche 2 : tuilage spatial">
        <P>
          Pour une sortie de 100 km, un seul point météo au centre du parcours
          ne suffit pas. AeroProfile découpe la route en tuiles de 5 km et
          récupère un point météo par tuile (jusqu'à 20 tuiles).
        </P>
        <P>
          Les données sont ensuite interpolées entre tuiles par décomposition
          vectorielle du vent. On transforme le couple{" "}
          <Tex>{String.raw`(V_w,\,\theta_w)`}</Tex> en composantes Est/Nord :
        </P>
        <Formula>{String.raw`\begin{aligned}
u &= -V_w \sin(\theta_w) \quad &\text{(composante Est)} \\
v &= -V_w \cos(\theta_w) \quad &\text{(composante Nord)}
\end{aligned}`}</Formula>
        <P>
          L'interpolation linéaire est appliquée séparément sur{" "}
          <Tex>{String.raw`u`}</Tex> et <Tex>{String.raw`v`}</Tex>, puis on
          recompose :
        </P>
        <Formula>{String.raw`V_w = \sqrt{u^2 + v^2}, \qquad \theta_w = \text{atan2}(-u,\;-v)`}</Formula>
        <Note>
          On ne peut pas interpoler les angles directement ! Si une tuile
          donne un vent à 359° et la suivante à 1°, une interpolation naïve
          donnerait 180° (plein Sud) au lieu de 0° (Nord). La décomposition{" "}
          <Tex>{String.raw`(u,v)`}</Tex> résout ce problème.
        </Note>
      </Section>

      <Section title="Couche 3 : correction de hauteur (profil logarithmique)">
        <P>
          L'API météo donne le vent à 10 mètres de hauteur (standard WMO).
          Un cycliste est à environ 1,3 m du sol, où le vent est freiné par la
          couche limite atmosphérique. En supposant une stabilité neutre
          (pas de gradient thermique vertical significatif), le profil
          logarithmique de vent donne :
        </P>
        <Formula>{String.raw`V(z) = V_{\text{ref}} \cdot \frac{\ln(z / z_0)}{\ln(z_{\text{ref}} / z_0)}`}</Formula>
        <P>
          où <Tex>{String.raw`z_0`}</Tex> est la longueur de rugosité
          aérodynamique du terrain :
        </P>
        <Formula>{String.raw`\begin{array}{lcl}
z_0 = 0{,}03\;\text{m} & \longrightarrow & \text{rase campagne, herbe rase} \\
z_0 = 0{,}10\;\text{m} & \longrightarrow & \text{cultures, haies basses} \\
z_0 = 0{,}25\;\text{m} & \longrightarrow & \text{bocage, haies hautes} \\
z_0 = 0{,}50\;\text{m} & \longrightarrow & \text{zone boisée ou urbaine}
\end{array}`}</Formula>
        <P>
          Exemple numérique pour du terrain dégagé (
          <Tex>{String.raw`z_0 = 0{,}03`}</Tex> m,{" "}
          <Tex>{String.raw`z = 1{,}3`}</Tex> m,{" "}
          <Tex>{String.raw`z_{\text{ref}} = 10`}</Tex> m) :
        </P>
        <Formula>{String.raw`\frac{V_{\text{cycliste}}}{V_{10}} = \frac{\ln(1{,}3\;/\;0{,}03)}{\ln(10\;/\;0{,}03)} = \frac{3{,}77}{5{,}81} \approx 0{,}65`}</Formula>
        <P>
          Résultat : le vent à hauteur du cycliste est environ 65 % du vent à
          10 m en terrain dégagé. En zone urbaine (
          <Tex>{String.raw`z_0 = 0{,}5`}</Tex>), ce ratio tombe à ~0,40. Ce
          facteur de réduction a un impact direct sur{" "}
          <Tex>{String.raw`V_{\text{air}}`}</Tex> et donc sur l'estimation
          du <Tex>{String.raw`C_dA`}</Tex>.
        </P>
      </Section>

      <Section title="Couche 4 : projection du vent sur l'axe de déplacement">
        <P>
          Le vent arrive d'une direction <Tex>{String.raw`\theta_w`}</Tex>{" "}
          (convention météo : d'où il vient, 0° = Nord, sens horaire).
          Le cycliste a un cap <Tex>{String.raw`\psi`}</Tex> (bearing)
          calculé à chaque seconde depuis le GPS. La composante de vent
          de face (headwind) est :
        </P>
        <Formula>{String.raw`V_{\text{hw}} = V_w \cdot \cos\!\big(\theta_w - \psi\big)`}</Formula>
        <P>
          La vitesse de l'air vue par le cycliste est alors :
        </P>
        <Formula>{String.raw`V_{\text{air}} = V_{\text{sol}} + V_{\text{hw}}`}</Formula>
        <P>
          Si <Tex>{String.raw`V_{\text{hw}} > 0`}</Tex>, le vent est de face
          et <Tex>{String.raw`V_{\text{air}} > V_{\text{sol}}`}</Tex>. Si{" "}
          <Tex>{String.raw`V_{\text{hw}} < 0`}</Tex>, le vent est dans le dos
          et <Tex>{String.raw`V_{\text{air}} < V_{\text{sol}}`}</Tex>.
        </P>
        <P>
          La puissance aérodynamique devient :
        </P>
        <Formula>{String.raw`P_{\text{aéro}} = \tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^2\,V_{\text{sol}}`}</Formula>
        <Note>
          On distingue <Tex>{String.raw`V_{\text{air}}^2`}</Tex> (traînée
          ressentie) et <Tex>{String.raw`V_{\text{sol}}`}</Tex> (déplacement
          effectif) car c'est la force aéro multipliée par la vitesse sol qui
          donne la puissance mécanique utile.
        </Note>
      </Section>

      <Section title="Couche 5 : wind-inverse (estimation bayésienne)">
        <P>
          Malgré les couches 1-4, le vent API reste imprécis. La solution
          ultime : estimer le vent directement depuis les données du ride en
          exploitant la physique.
        </P>
        <P>
          L'équation fondamentale du bilan de puissance relie puissance
          mesurée et paramètres inconnus :
        </P>
        <Formula>{String.raw`P_{\text{mes}} = \underbrace{\tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^2\,V_{\text{sol}}}_{\text{traînée aéro}} + \underbrace{C_{rr}\,m\,g\,V_{\text{sol}}}_{\text{résistance roulement}} + \underbrace{m\,g\,\sin(\alpha)\,V_{\text{sol}}}_{\text{gravité}} + \underbrace{m\,a\,V_{\text{sol}}}_{\text{accélération}}`}</Formula>
        <P>
          Quand le cycliste change de direction (boucles, aller-retour,
          virages), il expose son profil aérodynamique au vent sous
          différents angles. Un vent de face augmente la puissance nécessaire ;
          un vent de dos la diminue. En observant ces variations, le solveur
          peut « deviner » la vitesse et la direction du vent.
        </P>
        <P>
          Le solveur minimise par maximum a posteriori (MAP) les résidus
          pondérés, avec des priors gaussiens sur les paramètres :
        </P>
        <Formula>{String.raw`\hat{\boldsymbol{\theta}} = \arg\min_{\boldsymbol{\theta}} \left[ \sum_{i=1}^{N} \frac{\big(P_{\text{mes},i} - P_{\text{mod},i}(\boldsymbol{\theta})\big)^2}{\sigma_P^2} + \sum_{k} \frac{(\theta_k - \mu_k)^2}{\sigma_k^2} \right]`}</Formula>
        <P>
          où <Tex>{String.raw`\boldsymbol{\theta}`}</Tex> regroupe les
          paramètres estimés conjointement :
        </P>
        <Formula>{String.raw`\boldsymbol{\theta} = \big\{\,C_dA,\;\; C_{rr},\;\; V_{w}^{(j)},\;\; \theta_{w}^{(j)}\;\big\}_{j=1}^{J}`}</Formula>
        <P>
          avec <Tex>{String.raw`J`}</Tex> segments temporels de 30 minutes
          chacun. Les priors sont définis ainsi :
        </P>
        <Formula>{String.raw`\begin{aligned}
C_dA &\sim \mathcal{N}\!\left(\mu_{C_dA},\; \sigma_{C_dA}^2\right) \\
C_{rr} &\sim \mathcal{N}\!\left(0{,}0035,\; 0{,}0012^2\right) \\
V_{w}^{(j)} &\sim \mathcal{N}\!\left(V_{w,\text{API}}^{(j)},\; (2\;\text{m/s})^2\right) \\
\theta_{w}^{(j)} &\sim \mathcal{N}\!\left(\theta_{w,\text{API}}^{(j)},\; (30°)^2\right)
\end{aligned}`}</Formula>
        <P>
          Le vent Open-Meteo sert de point de départ (prior gaussien{" "}
          <Tex>{String.raw`\sigma = 2\;\text{m/s}`}</Tex>), pas de vérité
          absolue. Le solveur l'ajuste pour minimiser les résidus de
          puissance.
        </P>
        <P>
          Condition nécessaire : il faut que le cycliste ait changé
          suffisamment de direction (variance de cap{" "}
          <Tex>{String.raw`\text{Var}(\psi) > 0{,}25`}</Tex>). Sur une montée
          de col tout droit pendant 2 h, le vent et le{" "}
          <Tex>{String.raw`C_dA`}</Tex> sont dégénérés — le vent reste alors
          fixé à la valeur API.
        </P>
        <Warning>
          Le wind-inverse ne peut pas distinguer un vent latéral d'un
          changement de <Tex>{String.raw`C_dA`}</Tex> (position sur le vélo).
          Si vous changez de position ET de direction en même temps, le
          solveur ne peut pas séparer les deux effets. C'est une ambiguïté
          fondamentale du modèle.
        </Warning>
      </Section>

      <Section title="Impact mesuré">
        <P>
          Sur nos rides de test, le wind-inverse fait passer le{" "}
          <Tex>{String.raw`R^2`}</Tex> (qualité de reconstruction de la
          puissance) de ~0,50 à ~0,98. En termes de{" "}
          <Tex>{String.raw`C_dA`}</Tex>, l'intervalle de confiance à 95 %
          passe de{" "}
          <Tex>{String.raw`\pm 0{,}04\;\text{m}^2`}</Tex> à{" "}
          <Tex>{String.raw`\pm 0{,}012\;\text{m}^2`}</Tex>. C'est la plus
          grosse amélioration de tout le pipeline.
        </P>
        <P>
          La convergence du <Tex>{String.raw`C_dA`}</Tex> peut être visualisée
          dans le graphique dédié : chaque itération du solveur affine
          simultanément le vent et les coefficients aérodynamiques, jusqu'à
          stabilisation du résidu{" "}
          <Tex>{String.raw`\chi^2`}</Tex>.
        </P>
      </Section>

      <Section title="Couche 4 : prior adaptatif et test de sensibilité (avril 2026)">
        <P>
          Le prior gaussien à{" "}
          <Tex>{String.raw`\sigma = 2\;\text{m/s}`}</Tex> suffit quand
          Open-Meteo est raisonnablement juste. Mais le biais d'ERA5 (la
          réanalyse qui alimente Open-Meteo) est documenté comme{" "}
          <strong>croissant avec la vitesse du vent</strong>, surtout en zones
          côtières et de relief (Jourdier 2020 ; Copernicus ASR 2025).
          AeroProfile utilise donc maintenant un <Tex>{String.raw`\sigma`}</Tex>{" "}
          adaptatif selon l'intensité annoncée par l'API :
        </P>
        <Formula>{String.raw`\sigma_{\text{vent}}(V_{\text{API}}) = \mathrm{clamp}\!\left(2 + 0{,}4\,(V_{\text{API}} - 3),\; 2,\; 5\right)\;\text{m/s}`}</Formula>
        <P>
          À vent faible (<Tex>{String.raw`\leq 3\;\text{m/s}`}</Tex>), le prior
          reste serré (σ = 2). À vent fort (<Tex>{String.raw`\geq 8\;\text{m/s}`}</Tex>),
          le solveur a plus de latitude pour s'éloigner de la valeur API
          (σ = 5), reflétant le fait que c'est là qu'elle est la plus
          suspecte.
        </P>
        <P>
          En parallèle, un <strong>test de sensibilité ±30%</strong> tourne en
          post-traitement : on relance Chung VE avec le vent API multiplié par
          1,30 puis par 0,70 (les bornes plausibles du biais ERA5 en zone
          côtière), et on mesure l'écart sur le{" "}
          <Tex>{String.raw`C_dA`}</Tex>. Le ride est classé :
        </P>
        <Formula>{String.raw`\text{fragility} = \begin{cases}
\text{fragile}  & \text{si } \max|\Delta C_dA| \geq 0{,}05 \text{ et } V_{\text{API}} \geq 4\;\text{m/s} \\
\text{modéré}   & \text{si } \max|\Delta C_dA| \geq 0{,}025 \\
\text{robuste}  & \text{sinon}
\end{cases}`}</Formula>
        <P>
          Le critère hybride (écart ET vent fort) évite le faux positif sur
          les rides plates avec petit vent : un{" "}
          <Tex>{String.raw`C_dA`}</Tex> structurellement sensible au vent
          n'est pas forcément piloté par un mauvais vent API si l'API annonce
          déjà une valeur faible.
        </P>
      </Section>

      <Section title="Couche 5 : vent mesuré saisi par l'utilisateur">
        <P>
          Dernière ligne de défense : quand le drapeau "fragile" s'affiche,
          l'utilisateur peut saisir une vitesse et une direction mesurées
          (station Météo-France, Windy, Weatherflow Tempest, ressenti vélo)
          directement dans l'UI. Le vent saisi est au niveau du cycliste,
          back-converti en valeur 10 m via la loi logarithmique pour rester
          compatible avec le reste du pipeline :
        </P>
        <Formula>{String.raw`V_{10,\text{manuel}} = \frac{V_{\text{rider}}}{\alpha(z_0)},\qquad \alpha(0{,}03) \approx 0{,}65`}</Formula>
        <P>
          Dans ce mode, le prior du solveur est fortement resserré
          (<Tex>{String.raw`\sigma = 0{,}5\;\text{m/s}`}</Tex>) pour ancrer le
          résultat autour de la valeur saisie, tout en laissant marge pour
          des bourrasques locales.
        </P>
        <Note>
          Cette cascade (API → log-law → wind-inverse → prior adaptatif →
          test de sensibilité → saisie manuelle) est volontairement
          progressive : chaque couche gère un cas plus rare que la
          précédente, et aucune n'est imposée. Un cycliste peut toujours
          revenir en arrière (désactiver la saisie manuelle) si le résultat
          le surprend.
        </Note>
      </Section>
    </Article>
  );
}
