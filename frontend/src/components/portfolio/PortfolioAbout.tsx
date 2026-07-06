import { useTranslation, Trans } from "react-i18next";
import { FadeIn } from "../ui/FadeIn";

/**
 * About section for the landing portfolio. Uses the same bio content
 * as the existing AboutPage (about.p1..p4 i18n keys) — one source of
 * truth for the story. The two-app CTAs live in the ProjectsShowcase
 * above, so this section stays focused on the personal narrative.
 */
export function PortfolioAbout() {
  const { t } = useTranslation();
  return (
    <section id="about" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 scroll-mt-16">
      <FadeIn>
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-4">
          {t("about.eyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-text tracking-tight mb-8">
          {t("about.title")}
        </h2>
      </FadeIn>
      <FadeIn delay={100}>
        <div className="prose prose-invert max-w-none space-y-5 text-[15px] leading-relaxed text-muted-strong">
          {(["about.p1", "about.p2", "about.p3", "about.p4"] as const).map((k, i) => (
            <p key={k} className={i === 3 ? "text-muted" : undefined}>
              <Trans
                i18nKey={k}
                components={{
                  name: <span className="text-text font-medium" />,
                  imperial: <span className="text-text" />,
                  em: <em />,
                }}
              />
            </p>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
