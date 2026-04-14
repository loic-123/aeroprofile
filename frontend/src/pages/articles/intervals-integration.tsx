import { Article, Section, Formula, Tex, Note, Warning, P } from "../../components/BlogLayout";

export default function IntervalsIntegration() {
  return (
    <Article title="Intégration Intervals.icu : analyser un an de sorties en un clic">
      <P>
        Au lieu de télécharger vos fichiers .FIT un par un, AeroProfile peut
        se connecter directement à votre compte Intervals.icu et analyser
        automatiquement toutes vos sorties sur la période de votre choix.
      </P>

      <Section title="Profils : sauvegarder vos setups">
        <P>
          Avant même de vous connecter, le <strong>ProfilePicker</strong> en
          haut de la page vous permet de sauvegarder tout votre setup dans un{" "}
          <em>profil</em> : clé API Intervals.icu, athlete id, masse, vélo,
          position, Crr, seuil nRMSE et <em>tous</em> les filtres de la ride
          list (plage de dates, distance, D+ max, pente moyenne, durée min,
          exclusion des sorties en groupe).
        </P>
        <P>
          Un profil <strong>"Moi"</strong> est pré-créé avec des valeurs de
          départ sensées (75 kg, route, position aéro drops, Crr auto). Il ne
          peut pas être supprimé mais vous pouvez écraser ses paramètres.
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text text-sm">
          <li><strong>Cliquer sur un chip de profil</strong> → charge ses paramètres dans le formulaire.</li>
          <li><strong>"+ Nouveau"</strong> → crée un nouveau profil à partir des paramètres actuels.</li>
          <li><strong>"Sauvegarder"</strong> → écrit les paramètres actuels dans le profil actif.</li>
          <li><strong>"Recharger"</strong> → revient aux paramètres stockés du profil actif (annule vos tweaks non sauvegardés).</li>
        </ul>
        <Note>
          Le <strong>clé du profil</strong> est aussi utilisée comme{" "}
          <code>athleteKey</code> sur chaque entrée d'historique qu'il produit.
          Cela garantit que la <em>timeline de stabilité</em> et la{" "}
          <em>conformal prediction</em> ne mélangent pas les données de
          plusieurs cyclistes ou de plusieurs setups.
        </Note>
      </Section>

      <Section title="Comment ça marche">
        <P>
          Intervals.icu est une plateforme d'analyse d'entraînement gratuite
          qui synchronise vos activités depuis Garmin, Strava, Wahoo, etc.
          Elle expose une API REST que AeroProfile utilise pour :
        </P>
        <ol className="list-decimal ml-6 space-y-1 text-text">
          <li><strong>Se connecter</strong> avec votre clé API (trouvable dans Settings → Developer Settings)</li>
          <li><strong>Lister</strong> toutes vos activités sur la période choisie</li>
          <li><strong>Filtrer</strong> : garder uniquement les rides vélo, outdoor, avec puissance</li>
          <li><strong>Télécharger</strong> le fichier .FIT de chaque ride retenue</li>
          <li><strong>Analyser</strong> chaque ride avec le pipeline complet (météo, filtrage, solveur)</li>
          <li><strong>Agréger</strong> les résultats en un CdA moyen pondéré</li>
        </ol>
      </Section>

      <Section title="Les 4 niveaux de filtrage">
        <P>
          Chaque activité passe par 4 étapes de sélection, du plus grossier
          au plus fin :
        </P>
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li><strong>Niveau 1 — Automatique (serveur)</strong> : Type = Ride ou GravelRide,
            capteur de puissance requis, outdoor uniquement (exclut Zwift, home trainer)</li>
          <li><strong>Niveau 2 — Sliders utilisateur (temps réel)</strong> : Distance 30–500 km,
            D+ max 2000 m, durée min 60 min</li>
          <li><strong>Niveau 3 — Post-analyse (automatique)</strong> : nRMSE &gt; 45% → ride exclue
            de la moyenne. CdA hors de la plage du type de vélo sélectionné → ride exclue.</li>
          <li><strong>Niveau 4 — Par point dans chaque ride</strong> : 13 filtres (freinage,
            virage, drafting, etc.) + passe 2 itérative (dérive VE hybride)</li>
        </ul>
      </Section>

      <Section title="Type de vélo et bornes CdA">
        <P>
          AeroProfile propose trois types de vélo, chacun avec des bornes
          de CdA réalistes et un prior bayésien adapté. Le type de vélo
          influence à la fois l'estimation (prior + bornes du solveur) et
          l'exclusion des rides dont le CdA tombe hors des bornes :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Type</th>
                <th className="py-2 text-right">CdA min</th>
                <th className="py-2 text-right">CdA max</th>
                <th className="py-2">Positions typiques</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5">Route</td><td className="text-right">0.22</td><td className="text-right">0.50</td><td className="font-sans text-muted">Drops → tops</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">CLM / Triathlon</td><td className="text-right">0.17</td><td className="text-right">0.30</td><td className="font-sans text-muted">Prolongateurs → aéro hoods</td></tr>
              <tr><td className="py-1.5">VTT / Gravel</td><td className="text-right">0.35</td><td className="text-right">0.60</td><td className="font-sans text-muted">Position relevée, pneus larges</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Pourquoi analyser beaucoup de sorties ?">
        <P>
          Une seule sortie donne un CdA avec une incertitude de ±0.03-0.05 m²
          (due au vent, au drafting, à la qualité des données). En analysant
          20, 30 ou 50 sorties, la moyenne pondérée converge vers le "vrai"
          CdA avec une incertitude beaucoup plus faible. La loi des grands
          nombres garantit :
        </P>
        <Formula>
          {String.raw`\text{IC}_{95\%} = \pm 1.96 \times \frac{\sigma_{\text{inter-rides}}}{\sqrt{N}}`}
        </Formula>
        <P>
          Avec <Tex>{String.raw`N = 30`}</Tex> rides et <Tex>{String.raw`\sigma = 0.03`}</Tex> m²,
          l'IC95 tombe à <Tex>{String.raw`\pm 0.011`}</Tex> m² — suffisant pour détecter un changement
          de position ou d'équipement.
        </P>
      </Section>

      <Section title="La pondération par qualité">
        <P>
          Toutes les rides ne se valent pas. AeroProfile pondère chaque ride
          par sa qualité (nRMSE) et son volume de données :
        </P>
        <Formula>
          {String.raw`w_i = N_{\text{valid},i} \times q_i \qquad \text{où } q_i = 3 - 2 \cdot \frac{\text{nRMSE}_i - \text{nRMSE}_{\min}}{\text{nRMSE}_{\max} - \text{nRMSE}_{\min}}`}
        </Formula>
        <Formula>
          {String.raw`\overline{C_dA} = \frac{\sum_i C_dA_i \cdot w_i}{\sum_i w_i}`}
        </Formula>
        <P>
          La meilleure ride (nRMSE le plus bas) a un multiplicateur de 3×,
          la pire retenue a 1×. Les rides catastrophiques (nRMSE &gt; 45%)
          sont exclues entièrement.
        </P>
      </Section>

      <Section title="Le cache local">
        <P>
          Chaque ride analysée est sauvegardée dans le localStorage du
          navigateur (clé = activity_id + masse + Crr). Si vous relancez
          l'analyse avec les mêmes paramètres, les résultats sont chargés
          instantanément sans appel API.
        </P>
        <P>
          Le cache est invalidé si vous changez la masse ou le Crr fixe.
          Vous pouvez aussi le désactiver manuellement via le toggle dans
          les paramètres.
        </P>
      </Section>

      <Section title="Sécurité">
        <P>
          Votre clé API est stockée dans le localStorage de votre navigateur
          — elle ne quitte jamais votre machine sauf pour les requêtes vers
          le backend AeroProfile (proxy CORS). La clé n'est pas stockée
          côté serveur.
        </P>
        <Warning>
          Ne partagez pas votre clé API. Vous pouvez la régénérer à tout
          moment dans Intervals.icu → Settings → Developer Settings.
        </Warning>
      </Section>
    </Article>
  );
}
