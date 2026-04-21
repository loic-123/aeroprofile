import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

interface Props {
  onGotoAbout: () => void;
}

export function BuilderTeaser({ onGotoAbout }: Props) {
  const { t } = useTranslation();
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border border-border bg-panel p-6 md:p-10 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 md:gap-10 items-center"
      >
        <div className="relative shrink-0 mx-auto md:mx-0">
          <img
            src="/loic.jpg"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/loic.svg";
            }}
            alt="Loïc Bouxirot"
            width={140}
            height={140}
            className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover border border-border-strong shadow-e2"
          />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: "inset 0 0 0 1px rgb(124 111 222 / 0.2)",
            }}
            aria-hidden
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            {t("landing.builderEyebrow")}
          </div>
          <p className="text-xl md:text-2xl font-display text-text leading-snug tracking-tight">
            {t("landing.builderPitch")}
          </p>
          <button
            onClick={onGotoAbout}
            className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
          >
            {t("landing.builderCta")}
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </motion.div>
    </section>
  );
}
