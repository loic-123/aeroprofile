import { useTranslation } from "react-i18next";
import { ArrowDown } from "lucide-react";
import { FadeIn } from "../ui/FadeIn";

export function PortfolioHero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 md:pt-28 pb-12 md:pb-20 text-center">
        <FadeIn>
          <div className="mx-auto mb-8 w-28 h-28 md:w-32 md:h-32">
            <img
              src="/loic.jpg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/loic.svg";
              }}
              alt="Loïc Bouxirot"
              width={128}
              height={128}
              className="w-full h-full rounded-full object-cover border border-border-strong shadow-e2"
            />
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-4">
            {t("portfolio.hero.eyebrow")}
          </div>
          <h1 className="font-display text-4xl md:text-6xl leading-[1.05] text-text tracking-tight">
            {t("portfolio.hero.title")}
          </h1>
        </FadeIn>
        <FadeIn delay={180}>
          <p className="mt-6 text-lg md:text-xl text-muted-strong leading-relaxed max-w-2xl mx-auto">
            {t("portfolio.hero.tagline")}
          </p>
        </FadeIn>
        <FadeIn delay={260}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#projects"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-fg text-sm font-medium transition-colors duration-base hover:bg-primary-hover"
            >
              {t("portfolio.hero.ctaProjects")}
              <ArrowDown size={14} aria-hidden />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border bg-panel text-sm text-text transition-colors duration-base hover:border-primary-border hover:bg-panel-2"
            >
              {t("portfolio.hero.ctaAbout")}
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
