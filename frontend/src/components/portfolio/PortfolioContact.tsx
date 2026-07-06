import { useTranslation } from "react-i18next";
import { Github, Linkedin, Mail } from "lucide-react";
import { FadeIn } from "../ui/FadeIn";

export function PortfolioContact() {
  const { t } = useTranslation();
  return (
    <section id="contact" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 scroll-mt-16">
      <FadeIn>
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-4">
          {t("portfolio.contact.eyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-text tracking-tight mb-4">
          {t("portfolio.contact.title")}
        </h2>
        <p className="text-[15px] text-muted-strong leading-relaxed mb-8 max-w-xl">
          {t("portfolio.contact.body")}
        </p>
      </FadeIn>
      <FadeIn delay={100}>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:loic.bouxirot@gmail.com"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 text-sm text-text transition-colors hover:border-primary-border hover:bg-panel-2"
          >
            <Mail size={14} aria-hidden />
            loic.bouxirot@gmail.com
          </a>
          <a
            href="https://github.com/loic-123"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 text-sm text-text transition-colors hover:border-primary-border hover:bg-panel-2"
          >
            <Github size={14} aria-hidden />
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/loïc-bouxirot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2.5 text-sm text-text transition-colors hover:border-primary-border hover:bg-panel-2"
          >
            <Linkedin size={14} aria-hidden />
            LinkedIn
          </a>
        </div>
      </FadeIn>
    </section>
  );
}
