import { Article, Section, Formula, Note, Warning, P } from "../../components/BlogLayout";

export default function Solvers() {
  return (
    <Article title="Les 3 solveurs d'AeroProfile : Martin LS, Chung VE, Wind-Inverse">
      <P>
        AeroProfile dispose de trois méthodes pour estimer votre CdA. Chacune
        a ses forces et faiblesses. Le pipeline les essaie en cascade et retient
        celle qui donne le meilleur résultat.
      </P>

      <Section title="1. Martin LS (moindres carrés sur la puissance)">
        <P>
          C'est l'approche la plus directe : pour chaque seconde de votre
          sortie, le modèle prédit quelle puissance vous auriez dû produire
          avec un CdA et Crr candidats. Le solveur ajuste CdA et Crr pour
          minimiser la somme des écarts au carré.
        </P>
        <Formula>
          {"Objectif : minimiser Σᵢ (P_modèle(i) - P_mesuré(i))²\n\n" +
           "Méthode : scipy.optimize.least_squares\n" +
           "  - Trust Region Reflective (TRF)\n" +
           "  - 3 points de départ (multi-start)\n" +
           "  - Bornes : CdA ∈ [0.15, 0.60], Crr ∈ [0.0015, 0.012]"}
        </Formula>
        <P>
          <strong>Forces</strong> : simple, rapide, donne des IC depuis la
          matrice jacobienne.
        </P>
        <P>
          <strong>Faiblesses</strong> : très sensible au bruit instantané (GPS,
          puissance, vent). Chaque seconde de données bruitées ajoute un
          résidu carré → les outliers dominent. R² souvent faible sur les
          sorties réelles (&lt; 0.5).
        </P>
      </Section>

      <Section title="2. Chung VE (Virtual Elevation)">
        <P>
          Inventée par Robert Chung, cette méthode est la base d'outils comme
          Golden Cheetah Aerolab. Au lieu de comparer la puissance seconde par
          seconde, on intègre le bilan d'énergie pour reconstruire une
          "altitude virtuelle" et on la compare à l'altitude GPS réelle.
        </P>
        <Formula>
          {"À chaque seconde :\n" +
           "  E_entrée    = P × η × dt\n" +
           "  E_aéro      = 0.5 × CdA × ρ × V_air² × V × dt\n" +
           "  E_roulement = Crr × m × g × V × dt\n" +
           "  E_cinétique = 0.5 × m × (V² - V_précédent²)\n\n" +
           "  E_potentiel = E_entrée - E_aéro - E_roulement - E_cinétique\n" +
           "  Δh = E_potentiel / (m × g)\n\n" +
           "Altitude virtuelle = Σ Δh\n\n" +
           "Objectif : minimiser Σ (alt_virtuelle - alt_réelle)²"}
        </Formula>
        <P>
          <strong>Pourquoi c'est mieux</strong> : l'intégration lisse le bruit.
          Si le capteur de puissance fluctue de ±20W à chaque seconde, Martin LS
          voit 20² = 400 de résidu carré à chaque point. Chung VE intègre ces
          fluctuations → elles s'annulent dans la somme → le résidu d'altitude
          est beaucoup plus lisse.
        </P>
        <P>
          <strong>Limitation</strong> : si la sortie est coupée en morceaux
          par les filtres (descentes exclues, arrêts), l'intégration repart
          de zéro à chaque bloc. On perd la "mémoire" d'altitude entre les
          blocs. AeroProfile gère ça par un alignement per-block.
        </P>
      </Section>

      <Section title="3. Wind-Inverse (le plus avancé)">
        <P>
          Le wind-inverse combine le meilleur des deux mondes : l'objectif VE
          de Chung (robuste au bruit) avec une estimation du vent en tant que
          variable libre (pas besoin de croire l'API météo).
        </P>
        <Formula>
          {"Paramètres estimés :\n" +
           "  - CdA₀ (CdA à yaw = 0°)\n" +
           "  - Crr\n" +
           "  - u_vent, v_vent par segment de 30 min\n\n" +
           "Nombre de paramètres : 2 + 2 × N_segments\n" +
           "(ex : sortie de 2h → 4 segments → 10 paramètres)\n\n" +
           "Priors gaussiens pour régulariser :\n" +
           "  - Crr ~ N(0.004, 0.0015²)\n" +
           "  - CdA ~ N(0.30, 0.12²)\n" +
           "  - Vent ~ N(valeur_API, 2² m/s)"}
        </Formula>
        <P>
          <strong>Condition</strong> : heading variance &gt; 0.25. Si vous
          roulez tout droit (col de montagne), le vent et le CdA sont
          indistinguables → le wind-inverse ne s'active pas, et Chung VE
          prend le relais avec le vent API.
        </P>
      </Section>

      <Section title="La cascade : comment AeroProfile choisit">
        <P>
          Le pipeline essaie les solveurs dans cet ordre et retient celui
          avec le meilleur R² :
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>Martin LS</strong> (toujours lancé en premier) → mesure
            le R² de base.
          </li>
          <li>
            <strong>Wind-Inverse</strong> si heading_variance &gt; 0.25 →
            si R² meilleur que Martin, on le garde.
          </li>
          <li>
            <strong>Chung VE</strong> si les deux premiers ont R² &lt; 0.3 →
            si R² meilleur, on le garde.
          </li>
        </ol>
        <P>
          Le solveur retenu est affiché dans le bandeau bleu du dashboard
          ("Méthode : wind_inverse", "Méthode : chung_ve").
        </P>
        <P>
          Après la cascade, une <strong>passe 2 itérative</strong> compare
          l'altitude virtuelle à l'altitude réelle. Les segments où le modèle
          diverge fortement (dérive &gt; 10% du D+) sont exclus, et le
          solveur est relancé sur les points restants. Voir l'article dédié
          sur le raffinement itératif.
        </P>
      </Section>

      <Section title="Priors bayésiens : le filet de sécurité">
        <P>
          Tous les solveurs utilisent des priors gaussiens faibles sur CdA
          et Crr. Un prior, c'est un "a priori" : "avant de voir les données,
          je crois que le CdA est probablement autour de 0.30 avec une
          incertitude de 0.12". Quand les données sont bonnes, le prior ne
          fait presque rien. Quand les données sont mauvaises, il empêche
          le solveur de donner des résultats absurdes (CdA = 0.15 ou 0.60).
        </P>
        <Note>
          Voir l'article détaillé sur les priors bayésiens pour la formulation
          mathématique et le calibrage.
        </Note>
      </Section>
    </Article>
  );
}
