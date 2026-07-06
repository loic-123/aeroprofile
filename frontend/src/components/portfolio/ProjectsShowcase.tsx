import { useTranslation } from "react-i18next";
import { FadeIn } from "../ui/FadeIn";
import { ProjectCard } from "./ProjectCard";

/**
 * Small SVG "signature accent" for the AeroProfile card — abstract wind
 * streamlines in the iris + lime palette. Purely decorative, no data.
 */
function WindAccent() {
  return (
    <svg
      viewBox="0 0 400 140"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="wind-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C6FDE" stopOpacity="0" />
          <stop offset="50%" stopColor="#7C6FDE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#A3E635" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {[30, 55, 80, 105].map((y, i) => (
        <path
          key={y}
          d={`M0 ${y} Q100 ${y - 10 + i * 4} 200 ${y - 4 + i * 2} T400 ${y - 8 + i * 3}`}
          stroke="url(#wind-grad)"
          strokeWidth="1.5"
          fill="none"
          opacity={0.4 + i * 0.15}
        />
      ))}
    </svg>
  );
}

/**
 * Signature accent for the HRV Analysis card — a small spectral wave
 * evoking heart-rate variability signal. Iris + lime palette.
 */
function HrvAccent() {
  return (
    <svg
      viewBox="0 0 400 140"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="hrv-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#A3E635" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7C6FDE" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d="M0 70 L40 70 L52 40 L64 100 L76 55 L88 85 L100 70 L140 70 L152 20 L164 120 L176 45 L188 90 L200 70 L240 70 L252 45 L264 95 L276 60 L288 80 L300 70 L400 70"
        stroke="url(#hrv-grad)"
        strokeWidth="1.75"
        fill="none"
      />
    </svg>
  );
}

export function ProjectsShowcase() {
  const { t } = useTranslation();
  return (
    <section id="projects" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 scroll-mt-16">
      <FadeIn>
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
          {t("portfolio.projects.eyebrow")}
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-text tracking-tight mb-10 md:mb-14">
          {t("portfolio.projects.title")}
        </h2>
      </FadeIn>
      <FadeIn delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <ProjectCard
            eyebrow={t("portfolio.projects.aeroprofile.eyebrow")}
            title={t("portfolio.projects.aeroprofile.title")}
            pitch={t("portfolio.projects.aeroprofile.pitch")}
            tags={["Python", "FastAPI", "React", "SciPy", "Bayesian"]}
            href="https://app.aeroprofile.cc/"
            repoHref="https://github.com/loic-123/aeroprofile"
            visual={<WindAccent />}
          />
          <ProjectCard
            eyebrow={t("portfolio.projects.hrv.eyebrow")}
            title={t("portfolio.projects.hrv.title")}
            pitch={t("portfolio.projects.hrv.pitch")}
            tags={["Python", "FastAPI", "React", "Signal Processing", "Claude API"]}
            href="https://hrv.aeroprofile.cc/"
            repoHref="https://github.com/loic-123/hrv-analysis"
            visual={<HrvAccent />}
          />
        </div>
      </FadeIn>
    </section>
  );
}
