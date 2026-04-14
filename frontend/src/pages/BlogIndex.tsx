import { Link } from "../components/BlogLayout";

const ARTICLES = [
  {
    slug: "power-equation",
    title: "L'équation de puissance en cyclisme : Martin et al. (1998)",
    desc: "Comment 4 forces physiques (aéro, roulement, gravité, accélération) déterminent la puissance que vous devez produire. La base de tout.",
    tags: ["physique", "fondamentaux"],
  },
  {
    slug: "cda-what-is-it",
    title: "CdA : qu'est-ce que c'est et pourquoi c'est important ?",
    desc: "Le coefficient de traînée aérodynamique expliqué simplement. Comment il varie selon votre position, votre équipement, et pourquoi 0.01 de CdA fait une vraie différence.",
    tags: ["aéro", "fondamentaux"],
  },
  {
    slug: "wind-correction",
    title: "Correction du vent : de l'API météo au wind-inverse",
    desc: "Le vent est la plus grosse source d'erreur. Comment on le corrige : API Open-Meteo, tuilage spatial, profil logarithmique 10m→1m, et estimation inverse depuis vos données.",
    tags: ["vent", "météo", "avancé"],
  },
  {
    slug: "solvers",
    title: "Les 3 solveurs d'AeroProfile : Martin LS, Chung VE, Wind-Inverse",
    desc: "Pourquoi un seul solveur ne suffit pas, et comment AeroProfile choisit automatiquement la meilleure méthode pour chaque sortie.",
    tags: ["solveur", "algorithme"],
  },
  {
    slug: "filters",
    title: "Filtrage des données : comment on sépare le signal du bruit",
    desc: "13 filtres, du freinage au drafting, et pourquoi chaque point exclu rend le résultat plus fiable.",
    tags: ["filtrage", "qualité"],
  },
  {
    slug: "yaw-angle",
    title: "L'angle de yaw : pourquoi le vent de côté change votre CdA",
    desc: "Quand le vent arrive en biais, votre traînée augmente. Comment on corrige pour reporter un CdA 'soufflerie'.",
    tags: ["aéro", "avancé"],
  },
  {
    slug: "bayesian-priors",
    title: "Priors bayésiens : comment stabiliser le solveur",
    desc: "Quand les données sont insuffisantes, un prior doux empêche le solveur de diverger. Explication intuitive et mathématique. Inclut le piège du prior en multi-rides.",
    tags: ["statistiques", "avancé"],
  },
  {
    slug: "aggregation-methods",
    title: "Méthodes d'agrégation multi-rides : inverse-variance vs hiérarchique",
    desc: "Comment AeroProfile combine N rides en un seul CdA représentatif : moyenne pondérée par la précision (méthode A) et modèle hiérarchique random-effects (méthode B). Référence DerSimonian-Laird 1986.",
    tags: ["statistiques", "multi-rides", "avancé"],
  },
  {
    slug: "iterative-refinement",
    title: "Raffinement itératif : n'utiliser que les points où le modèle fonctionne",
    desc: "Deux passes automatiques : résoudre, identifier les zones de divergence altitude réelle/virtuelle, exclure, re-résoudre. Comme Golden Cheetah, mais automatisé.",
    tags: ["solveur", "avancé"],
  },
  {
    slug: "w-cda-metric",
    title: "W/CdA : la métrique des rouleurs (l'analogue du W/kg)",
    desc: "La puissance rapportée à la traînée aéro détermine votre vitesse sur le plat. Tableau de correspondance W/CdA → km/h.",
    tags: ["aéro", "fondamentaux"],
  },
  {
    slug: "intervals-integration",
    title: "Intégration Intervals.icu : analyser un an de sorties en un clic",
    desc: "Connectez votre compte, filtrez vos rides, et obtenez un CdA moyen pondéré sur des dizaines de sorties. Les 4 niveaux de filtrage expliqués.",
    tags: ["intégration", "workflow"],
  },
  {
    slug: "drafting-detection",
    title: "Détection du drafting : quand rouler en groupe fausse le CdA",
    desc: "Pourquoi le CdA apparent chute de 30-40% dans un peloton, comment on le détecte, et ce qu'on peut quand même apprendre.",
    tags: ["drafting", "groupe"],
  },
  {
    slug: "power-meter-quality",
    title: "Le capteur de puissance : la source d'erreur que le solveur ne peut pas corriger",
    desc: "Pourquoi les capteurs mono-jambe (4iiii, Stages left) donnent un CdA 2× plus variable, et comment AeroProfile détecte un biais de calibration indépendamment du solveur.",
    tags: ["capteur", "calibration", "diagnostic"],
  },
];

export default function BlogIndex() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Comment AeroProfile calcule votre CdA</h1>
      <p className="text-muted mb-8">
        Série d'articles techniques expliquant chaque étape du pipeline, des
        fondamentaux physiques aux algorithmes avancés. Formules incluses,
        expliquées avec des mots simples.
      </p>
      <div className="space-y-4">
        {ARTICLES.map((a) => (
          <Link key={a.slug} slug={a.slug}>
            <div className="bg-panel border border-border rounded-lg p-5 hover:border-teal transition cursor-pointer">
              <h2 className="text-lg font-semibold">{a.title}</h2>
              <p className="text-sm text-muted mt-1">{a.desc}</p>
              <div className="flex gap-2 mt-3">
                {a.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] bg-teal/10 text-teal px-2 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
