import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function IntervalsIntegration() {
  return (
    <Article title="Intégration Intervals.icu : analyser un an de sorties en un clic">
      <P>
        Au lieu de télécharger vos fichiers .FIT un par un, AeroProfile peut
        se connecter directement à votre compte Intervals.icu et analyser
        automatiquement toutes vos sorties sur la période de votre choix.
      </P>

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
        <Formula>
          {"NIVEAU 1 — Automatique (serveur)\n" +
           "  Type = Ride ou GravelRide (exclut Run, Swim, etc.)\n" +
           "  Capteur de puissance requis\n" +
           "  Outdoor uniquement (exclut Zwift, home trainer)\n\n" +
           "NIVEAU 2 — Sliders utilisateur (temps réel)\n" +
           "  Distance : 30–500 km\n" +
           "  D+ max : 2000 m\n" +
           "  Durée min : 60 min\n\n" +
           "NIVEAU 3 — Post-analyse (automatique)\n" +
           "  nRMSE > 60% → ride exclue de la moyenne\n" +
           "  (modèle n'a pas réussi à fitter)\n\n" +
           "NIVEAU 4 — Par point dans chaque ride\n" +
           "  13 filtres (freinage, virage, drafting, etc.)\n" +
           "  + Passe 2 itérative (dérive VE)"}
        </Formula>
      </Section>

      <Section title="Pourquoi analyser beaucoup de sorties ?">
        <P>
          Une seule sortie donne un CdA avec une incertitude de ±0.03-0.05 m²
          (due au vent, au drafting, à la qualité des données). En analysant
          20, 30 ou 50 sorties, la moyenne pondérée converge vers le "vrai"
          CdA avec une incertitude beaucoup plus faible (±0.01 ou moins).
        </P>
        <P>
          C'est le même principe qu'en statistique : une seule mesure est
          bruitée, mais la moyenne de 50 mesures est stable. Le graphe de
          convergence montre cette stabilisation en temps réel.
        </P>
      </Section>

      <Section title="La pondération par qualité">
        <P>
          Toutes les rides ne se valent pas. Une sortie plate par temps calme
          donne un CdA plus fiable qu'une sortie montagneuse par grand vent.
          AeroProfile pondère chaque ride par sa qualité (inverse du nRMSE) :
        </P>
        <Formula>
          {"poids(ride) = valid_points × qualité\n\n" +
           "qualité = linéaire entre 3.0 (meilleur nRMSE) et 1.0 (pire)\n\n" +
           "CdA_moyen = Σ(CdA_i × poids_i) / Σ(poids_i)\n\n" +
           "IC95 = ±1.96 × écart-type inter-rides / √N"}
        </Formula>
        <P>
          Résultat : les bonnes sorties comptent 3× plus que les médiocres.
          Les sorties catastrophiques (nRMSE &gt; 60%) sont exclues
          entièrement.
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
          — elle ne quitte jamais votre machine. Les requêtes vers
          Intervals.icu passent par le backend AeroProfile (proxy pour
          éviter les restrictions CORS) mais la clé n'est pas stockée
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
