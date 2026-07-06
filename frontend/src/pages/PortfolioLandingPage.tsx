import { useTranslation } from "react-i18next";
import { Github, Linkedin } from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { PortfolioHero } from "../components/portfolio/PortfolioHero";
import { ProjectsShowcase } from "../components/portfolio/ProjectsShowcase";
import { PortfolioAbout } from "../components/portfolio/PortfolioAbout";
import { PortfolioContact } from "../components/portfolio/PortfolioContact";

/**
 * Root page served at aeroprofile.cc/ when `VITE_LANDING_MODE=1`.
 *
 * Presents Loïc as the person behind the two products (AeroProfile CdA
 * on app.aeroprofile.cc, HRV Analysis on hrv.aeroprofile.cc), reuses
 * the existing aeroprofile design system (iris + lime + Inter + FadeIn)
 * so the visual identity stays coherent across the three surfaces.
 *
 * No navigation state machine here — each section is anchored via id
 * and reachable through hash links from the hero CTAs.
 */
export function PortfolioLandingPage() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <a
            href="#top"
            className="inline-flex items-center gap-2 text-text font-semibold tracking-tight hover:text-primary transition-colors"
          >
            <span className="text-base">Loïc Bouxirot</span>
          </a>
          <div className="flex-1" />
          <LanguageToggle />
          <a
            href="https://github.com/loic-123"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="p-2 rounded text-muted hover:text-text hover:bg-panel transition-colors"
          >
            <Github size={16} aria-hidden />
          </a>
          <a
            href="https://www.linkedin.com/in/loïc-bouxirot"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="p-2 rounded text-muted hover:text-text hover:bg-panel transition-colors"
          >
            <Linkedin size={16} aria-hidden />
          </a>
        </div>
      </header>
      <main id="top" className="flex-1">
        <PortfolioHero />
        <ProjectsShowcase />
        <PortfolioAbout />
        <PortfolioContact />
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        © {year} Loïc Bouxirot · {t("portfolio.footer.tagline")}
      </footer>
    </div>
  );
}
