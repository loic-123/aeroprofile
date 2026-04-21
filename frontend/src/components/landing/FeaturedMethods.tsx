import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";

interface Props {
  onGotoArticle: (slug: string) => void;
  onGotoMethodsIndex: () => void;
}

interface Article {
  slug: string;
  title: string;
  blurb: string;
  read: string;
  tags: string[];
}

/**
 * Three featured methodology articles on the landing — the intent is
 * to show prospective users that the tool is documented, not just
 * shipped. Each card links straight into the article.
 */
export function FeaturedMethods({ onGotoArticle, onGotoMethodsIndex }: Props) {
  const featured: Article[] = [
    {
      slug: "wind-correction",
      title: "The wind-inverse solver",
      blurb:
        "Why AeroProfile doesn't trust Open-Meteo's wind at face value — and how a Bayesian inverse problem over the wind field doubles R² on rides with heading variety.",
      read: "12 min",
      tags: ["physics", "statistics", "advanced"],
    },
    {
      slug: "prior-invariance",
      title: "The prior-invariance test",
      blurb:
        "If your position prior shifts the aggregate CdA, the tool is broken. How AeroProfile guarantees invariance in CI, with a real 4iiii dataset case study.",
      read: "8 min",
      tags: ["statistics", "regression test"],
    },
    {
      slug: "aggregation-methods",
      title: "Hierarchical aggregation, done right",
      blurb:
        "DerSimonian–Laird random-effects estimator with HKSJ small-sample correction. When to use it, and why 'average all the rides' isn't good enough.",
      read: "10 min",
      tags: ["meta-analysis", "advanced"],
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
      <div className="mb-12 md:mb-16 flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            Methods
          </div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
            14 articles explaining every number.
          </h2>
          <p className="text-muted-strong mt-4 max-w-lg leading-relaxed">
            Every threshold, prior, and solver choice in AeroProfile is
            documented. Here are three favourites.
          </p>
        </div>
        <button
          onClick={onGotoMethodsIndex}
          className="inline-flex items-center gap-2 text-sm text-text hover:text-primary transition-colors"
        >
          See all 14 articles
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {featured.map((a, i) => (
          <motion.article
            key={a.slug}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.06,
            }}
          >
            <button
              onClick={() => onGotoArticle(a.slug)}
              className="group block text-left w-full h-full rounded-lg border border-border bg-panel p-6 transition-all duration-base hover:border-primary-border hover:bg-panel-2 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <div className="flex items-center gap-2 text-muted mb-4">
                <BookOpen size={14} aria-hidden />
                <span className="num text-xs">{a.read}</span>
              </div>
              <h3 className="text-lg font-semibold text-text mb-3 tracking-tight leading-snug">
                {a.title}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed mb-4">
                {a.blurb}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {a.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] uppercase tracking-widest text-muted px-1.5 py-0.5 rounded border border-border/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
                Read
                <ArrowRight
                  size={12}
                  className="transition-transform duration-base group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </button>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
