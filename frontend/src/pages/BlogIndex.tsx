import { Link } from "../components/BlogLayout";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

type Category =
  | "Fundamentals"
  | "Algorithms"
  | "Statistics"
  | "Diagnostics"
  | "Tools";

interface Article {
  slug: string;
  tags: string[];
  category: Category;
  readMin: number;
  featured?: boolean;
}

const ARTICLES: Article[] = [
  { slug: "power-equation", tags: ["physique", "fondamentaux"], category: "Fundamentals", readMin: 6 },
  { slug: "cda-what-is-it", tags: ["aéro", "fondamentaux"], category: "Fundamentals", readMin: 5 },
  { slug: "wind-correction", tags: ["vent", "météo", "avancé"], category: "Algorithms", readMin: 12, featured: true },
  { slug: "solvers", tags: ["solveur", "algorithme"], category: "Algorithms", readMin: 10 },
  { slug: "filters", tags: ["filtrage", "qualité"], category: "Algorithms", readMin: 8 },
  { slug: "iterative-refinement", tags: ["solveur", "avancé"], category: "Algorithms", readMin: 7 },
  { slug: "drafting-detection", tags: ["drafting", "groupe"], category: "Algorithms", readMin: 6 },
  { slug: "yaw-angle", tags: ["aéro", "avancé"], category: "Diagnostics", readMin: 6 },
  { slug: "bayesian-priors", tags: ["statistiques", "avancé"], category: "Statistics", readMin: 10 },
  { slug: "aggregation-methods", tags: ["statistiques", "multi-rides", "avancé"], category: "Statistics", readMin: 10, featured: true },
  { slug: "prior-invariance", tags: ["statistiques", "diagnostic", "avancé"], category: "Statistics", readMin: 8, featured: true },
  { slug: "power-meter-quality", tags: ["capteur", "calibration", "diagnostic"], category: "Diagnostics", readMin: 7 },
  { slug: "w-cda-metric", tags: ["aéro", "fondamentaux"], category: "Tools", readMin: 5 },
  { slug: "intervals-integration", tags: ["intégration", "workflow"], category: "Tools", readMin: 4 },
];

const CATEGORY_ORDER: Category[] = [
  "Fundamentals",
  "Algorithms",
  "Statistics",
  "Diagnostics",
  "Tools",
];

export default function BlogIndex() {
  const { t } = useTranslation();
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
          {t("blogIndexHeader.eyebrow")}
        </div>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.1] text-text mb-4">
          {t("blogIndexHeader.title")}
        </h1>
        <p className="text-muted-strong max-w-2xl leading-relaxed">
          {t("blogIndexHeader.lede")}
        </p>
      </div>

      {/* Featured */}
      <section className="mb-16">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-accent font-semibold mb-5">
          <Sparkles size={12} aria-hidden />
          {t("blogIndexHeader.featured")}
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
          {t("blogIndexHeader.all")}
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
                  {t(`blogIndex.categoryDesc.${cat}`)}
                </p>
              </header>
              <ul className="divide-y divide-border/40">
                {byCategory[cat].map((a) => (
                  <li key={a.slug}>
                    <Link slug={a.slug}>
                      <div className="group py-3 flex items-start justify-between gap-6 transition-colors hover:bg-panel/40 -mx-2 px-2 rounded">
                        <div className="min-w-0">
                          <div className="text-sm text-text font-medium leading-snug group-hover:text-primary transition-colors">
                            {t(`blogIndex.articles.${a.slug}.title`)}
                          </div>
                          <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
                            {t(`blogIndex.articles.${a.slug}.desc`)}
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
  const { t } = useTranslation();
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
            {t(`blogIndex.articles.${a.slug}.title`)}
          </h3>
          <p className="text-xs text-muted-strong leading-relaxed line-clamp-3">
            {t(`blogIndex.articles.${a.slug}.desc`)}
          </p>
          <div className="flex gap-1.5 mt-auto pt-4 flex-wrap">
            {a.tags.map((tag) => (
              <TagPill key={tag}>{t(`blogIndex.tags.${tag}`, { defaultValue: tag })}</TagPill>
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
