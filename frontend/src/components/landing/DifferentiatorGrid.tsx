import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  Wind,
  Sigma,
  Shield,
  Filter,
  Gauge,
  Activity,
  ArrowRight,
} from "lucide-react";

interface Props {
  onGotoMethod: (slug: string) => void;
}

interface Diff {
  icon: ReactNode;
  key: string;
  slug?: string;
}

export function DifferentiatorGrid({ onGotoMethod }: Props) {
  const { t } = useTranslation();
  const diffs: Diff[] = [
    { icon: <Wind size={18} />, key: "windInverse", slug: "wind-correction" },
    { icon: <Sigma size={18} />, key: "hierarchical", slug: "aggregation-methods" },
    { icon: <Shield size={18} />, key: "priorInvariance", slug: "prior-invariance" },
    { icon: <Filter size={18} />, key: "qualityGates" },
    { icon: <Gauge size={18} />, key: "windSens", slug: "wind-correction" },
    { icon: <Activity size={18} />, key: "pmDrift", slug: "power-meter-quality" },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
      <div className="mb-12 md:mb-16 max-w-2xl">
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
          {t("landing.diffEyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
          {t("landing.diffHeadline")}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {diffs.map((d, i) => (
          <motion.article
            key={d.key}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
              delay: Math.min(i * 0.05, 0.25),
            }}
            className="group relative rounded-lg border border-border bg-panel p-6 transition-colors duration-base hover:border-border-strong hover:bg-panel-2"
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary-subtle border border-primary-border text-primary mb-4">
              {d.icon}
            </div>
            <h3 className="text-base font-semibold text-text mb-2 tracking-tight">
              {t(`landing.diffs.${d.key}.title`)}
            </h3>
            <p className="text-sm text-muted-strong leading-relaxed">
              {t(`landing.diffs.${d.key}.body`)}
            </p>
            {d.slug && (
              <button
                onClick={() => onGotoMethod(d.slug!)}
                className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                {t("landing.methodLink")}
                <ArrowRight
                  size={12}
                  className="transition-transform duration-base group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
