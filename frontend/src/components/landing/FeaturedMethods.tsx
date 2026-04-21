import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen } from "lucide-react";

interface Props {
  onGotoArticle: (slug: string) => void;
  onGotoMethodsIndex: () => void;
}

interface Article {
  slug: string;
  titleKey: string;
  blurbKey: string;
  read: string;
  tagKeys: string[];
}

export function FeaturedMethods({ onGotoArticle, onGotoMethodsIndex }: Props) {
  const { t } = useTranslation();
  const featured: Article[] = [
    {
      slug: "wind-correction",
      titleKey: "landing.featuredBlurbs.windCorrectionTitle",
      blurbKey: "landing.featuredBlurbs.windCorrection",
      read: "12 min",
      tagKeys: ["featuredTagPhysics", "featuredTagStats", "featuredTagAdv"],
    },
    {
      slug: "prior-invariance",
      titleKey: "landing.featuredBlurbs.priorInvarianceTitle",
      blurbKey: "landing.featuredBlurbs.priorInvariance",
      read: "8 min",
      tagKeys: ["featuredTagStats", "featuredTagRegTest"],
    },
    {
      slug: "aggregation-methods",
      titleKey: "landing.featuredBlurbs.aggregationTitle",
      blurbKey: "landing.featuredBlurbs.aggregation",
      read: "10 min",
      tagKeys: ["featuredTagMeta", "featuredTagAdv"],
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
      <div className="mb-12 md:mb-16 flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            {t("landing.methodsEyebrow")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
            {t("landing.methodsHeadline")}
          </h2>
          <p className="text-muted-strong mt-4 max-w-lg leading-relaxed">
            {t("landing.methodsLede")}
          </p>
        </div>
        <button
          onClick={onGotoMethodsIndex}
          className="inline-flex items-center gap-2 text-sm text-text hover:text-primary transition-colors"
        >
          {t("landing.seeAll")}
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
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
            className="h-full"
          >
            <button
              onClick={() => onGotoArticle(a.slug)}
              className="group flex flex-col text-left w-full h-full rounded-lg border border-border bg-panel p-6 transition-all duration-base hover:border-primary-border hover:bg-panel-2 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <div className="flex items-center gap-2 text-muted mb-4">
                <BookOpen size={14} aria-hidden />
                <span className="num text-xs">{a.read}</span>
              </div>
              <h3 className="text-lg font-semibold text-text mb-3 tracking-tight leading-snug">
                {t(a.titleKey)}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed mb-4">
                {t(a.blurbKey)}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-auto">
                {a.tagKeys.map((tk) => (
                  <span
                    key={tk}
                    className="text-[10px] uppercase tracking-widest text-muted px-1.5 py-0.5 rounded border border-border/80"
                  >
                    {t(`landing.${tk}`)}
                  </span>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
                {t("landing.featuredRead")}
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
