import { Link } from "../components/BlogLayout";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

type Category =
  | "Fundamentals"
  | "Algorithms"
  | "Statistics"
  | "Diagnostics"
  | "Tools";

interface Article {
  slug: string;
  title: string;
  desc: string;
  tags: string[];
  category: Category;
  readMin: number;
  featured?: boolean;
}

const ARTICLES: Article[] = [
  {
    slug: "power-equation",
    title: "L'équation de puissance en cyclisme : Martin et al. (1998)",
    desc: "Comment 4 forces physiques (aéro, roulement, gravité, accélération) déterminent la puissance que vous devez produire. La base de tout.",
    tags: ["physique", "fondamentaux"],
    category: "Fundamentals",
    readMin: 6,
  },
  {
    slug: "cda-what-is-it",
    title: "CdA : qu'est-ce que c'est et pourquoi c'est important ?",
    desc: "Le coefficient de traînée aérodynamique expliqué simplement. Comment il varie selon votre position, votre équipement, et pourquoi 0.01 de CdA fait une vraie différence.",
    tags: ["aéro", "fondamentaux"],
    category: "Fundamentals",
    readMin: 5,
  },
  {
    slug: "wind-correction",
    title: "Correction du vent : de l'API météo au wind-inverse",
    desc: "Le vent est la plus grosse source d'erreur. Comment on le corrige : API Open-Meteo, tuilage spatial, profil logarithmique 10m→1m, et estimation inverse depuis vos données.",
    tags: ["vent", "météo", "avancé"],
    category: "Algorithms",
    readMin: 12,
    featured: true,
  },
  {
    slug: "solvers",
    title: "Les 3 solveurs d'AeroProfile : Martin LS, Chung VE, Wind-Inverse",
    desc: "Pourquoi un seul solveur ne suffit pas, et comment AeroProfile choisit automatiquement la meilleure méthode pour chaque sortie.",
    tags: ["solveur", "algorithme"],
    category: "Algorithms",
    readMin: 10,
  },
  {
    slug: "filters",
    title: "Filtrage des données : comment on sépare le signal du bruit",
    desc: "13 filtres, du freinage au drafting, et pourquoi chaque point exclu rend le résultat plus fiable.",
    tags: ["filtrage", "qualité"],
    category: "Algorithms",
    readMin: 8,
  },
  {
    slug: "iterative-refinement",
    title: "Raffinement itératif : n'utiliser que les points où le modèle fonctionne",
    desc: "Deux passes automatiques : résoudre, identifier les zones de divergence altitude réelle/virtuelle, exclure, re-résoudre. Comme Golden Cheetah, mais automatisé.",
    tags: ["solveur", "avancé"],
    category: "Algorithms",
    readMin: 7,
  },
  {
    slug: "drafting-detection",
    title: "Détection du drafting : quand rouler en groupe fausse le CdA",
    desc: "Pourquoi le CdA apparent chute de 30-40% dans un peloton, comment on le détecte, et ce qu'on peut quand même apprendre.",
    tags: ["drafting", "groupe"],
    category: "Algorithms",
    readMin: 6,
  },
  {
    slug: "yaw-angle",
    title: "L'angle de yaw : pourquoi le vent de côté change votre CdA",
    desc: "Quand le vent arrive en biais, votre traînée augmente. Comment on corrige pour reporter un CdA 'soufflerie'.",
    tags: ["aéro", "avancé"],
    category: "Diagnostics",
    readMin: 6,
  },
  {
    slug: "bayesian-priors",
    title: "Priors bayésiens : comment stabiliser le solveur",
    desc: "Quand les données sont insuffisantes, un prior doux empêche le solveur de diverger. Explication intuitive et mathématique. Inclut le piège du prior en multi-rides.",
    tags: ["statistiques", "avancé"],
    category: "Statistics",
    readMin: 10,
  },
  {
    slug: "aggregation-methods",
    title: "Méthodes d'agrégation multi-rides : inverse-variance vs hiérarchique",
    desc: "Comment AeroProfile combine N rides en un seul CdA représentatif : moyenne pondérée par la précision (méthode A) et méta-analyse hiérarchique DerSimonian–Laird (méthode hiérarchique).",
    tags: ["statistiques", "multi-rides", "avancé"],
    category: "Statistics",
    readMin: 10,
    featured: true,
  },
  {
    slug: "prior-invariance",
    title: "L'invariance au prior : pourquoi votre choix de position ne devrait pas bouger le CdA agrégé",
    desc: "Le test de cohérence le plus puissant en méta-analyse : relancer la même analyse avec deux priors différents. Quand l'invariance casse, c'est presque toujours un bug de convergence - et l'histoire d'un fix sur un dataset 4iiii mono-jambe bruité.",
    tags: ["statistiques", "diagnostic", "avancé"],
    category: "Statistics",
    readMin: 8,
    featured: true,
  },
  {
    slug: "power-meter-quality",
    title: "Le capteur de puissance : la source d'erreur que le solveur ne peut pas corriger",
    desc: "Pourquoi les capteurs mono-jambe (4iiii, Stages left) donnent un CdA 2× plus variable, et comment AeroProfile détecte un biais de calibration indépendamment du solveur.",
    tags: ["capteur", "calibration", "diagnostic"],
    category: "Diagnostics",
    readMin: 7,
  },
  {
    slug: "w-cda-metric",
    title: "W/CdA : la métrique des rouleurs (l'analogue du W/kg)",
    desc: "La puissance rapportée à la traînée aéro détermine votre vitesse sur le plat. Tableau de correspondance W/CdA → km/h.",
    tags: ["aéro", "fondamentaux"],
    category: "Tools",
    readMin: 5,
  },
  {
    slug: "intervals-integration",
    title: "Intégration Intervals.icu : analyser un an de sorties en un clic",
    desc: "Connectez votre compte, filtrez vos rides, et obtenez un CdA moyen pondéré sur des dizaines de sorties. Les 4 niveaux de filtrage expliqués.",
    tags: ["intégration", "workflow"],
    category: "Tools",
    readMin: 4,
  },
];

const CATEGORY_ORDER: Category[] = [
  "Fundamentals",
  "Algorithms",
  "Statistics",
  "Diagnostics",
  "Tools",
];

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  Fundamentals: "The physics and vocabulary every reader should start with.",
  Algorithms: "Solvers, filters, and the pipeline architecture.",
  Statistics: "Priors, meta-analysis, and the regression tests that guard them.",
  Diagnostics: "What to inspect when a number looks wrong.",
  Tools: "Workflows and practical references.",
};

export default function BlogIndex() {
  const featured = ARTICLES.filter((a) => a.featured);
  const byCategory: Record<Category, Article[]> = {
    Fundamentals: [],
    Algorithms: [],
    Statistics: [],
    Diagnostics: [],
    Tools: [],
  };
  for (const a of ARTICLES) byCategory[a.category].push(a);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
          Methods
        </div>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.1] text-text mb-4">
          How AeroProfile calculates your CdA -
          every step, every assumption.
        </h1>
        <p className="text-muted-strong max-w-2xl leading-relaxed">
          14 articles covering the physics, the algorithms, and the
          statistical choices inside the tool. Formulas included,
          explained in plain language.
        </p>
      </div>

      {/* Featured */}
      <section className="mb-16">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-accent font-semibold mb-5">
          <Sparkles size={12} aria-hidden />
          Featured
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {featured.map((a, i) => (
            <FeaturedCard key={a.slug} article={a} index={i} />
          ))}
        </div>
      </section>

      {/* All articles by category */}
      <section>
        <div className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-5">
          All 14 articles
        </div>
        <div className="space-y-10">
          {CATEGORY_ORDER.map((cat) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <header className="mb-4 pb-2 border-b border-border/60">
                <h2 className="text-sm font-semibold text-text tracking-tight">
                  {cat}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {CATEGORY_DESCRIPTIONS[cat]}
                </p>
              </header>
              <ul className="divide-y divide-border/40">
                {byCategory[cat].map((a) => (
                  <li key={a.slug}>
                    <Link slug={a.slug}>
                      <div className="group py-3 flex items-start justify-between gap-6 transition-colors hover:bg-panel/40 -mx-2 px-2 rounded">
                        <div className="min-w-0">
                          <div className="text-sm text-text font-medium leading-snug group-hover:text-primary transition-colors">
                            {a.title}
                          </div>
                          <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
                            {a.desc}
                          </p>
                        </div>
                        <div className="shrink-0 text-[10px] font-mono text-muted whitespace-nowrap pt-1">
                          {a.readMin} min
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeaturedCard({ article: a, index }: { article: Article; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.06,
      }}
      className="h-full"
    >
      <Link slug={a.slug} className="h-full block">
        <article className="group flex h-full flex-col rounded-lg border border-border bg-panel p-5 cursor-pointer transition-all duration-base hover:border-primary-border hover:bg-panel-2 hover:shadow-e2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted mb-4">
            <span>{a.category}</span>
            <span className="font-mono">{a.readMin} min</span>
          </div>
          <h3 className="text-base font-semibold text-text leading-snug mb-2 group-hover:text-primary transition-colors">
            {a.title}
          </h3>
          <p className="text-xs text-muted-strong leading-relaxed line-clamp-3">
            {a.desc}
          </p>
          <div className="flex gap-1.5 mt-auto pt-4 flex-wrap">
            {a.tags.map((t) => (
              <TagPill key={t}>{t}</TagPill>
            ))}
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function TagPill({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-widest text-muted px-1.5 py-0.5 rounded border border-border/80">
      {children}
    </span>
  );
}
