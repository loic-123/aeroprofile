import { useTranslation } from "react-i18next";
import { ArrowUpRight, Github } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  pitch: string;
  tags: string[];
  href: string;
  repoHref?: string;
  visual: ReactNode;
}

/**
 * Big project card for the portfolio landing. Anchors the visitor's eye
 * with a signature SVG accent at the top, then leads to an outbound link
 * to the actual product hosted on its own subdomain.
 */
export function ProjectCard({ eyebrow, title, pitch, tags, href, repoHref, visual }: Props) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-panel transition-all duration-base hover:border-primary-border hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="relative h-32 md:h-36 border-b border-border/60 bg-bg-elev overflow-hidden">
        {visual}
      </div>
      <div className="flex-1 p-6 md:p-7 flex flex-col">
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">
          {eyebrow}
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="font-display text-2xl md:text-3xl text-text tracking-tight">
            {title}
          </h3>
          <ArrowUpRight
            size={18}
            className="text-muted transition-all duration-base group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </div>
        <p className="text-sm md:text-[15px] text-muted-strong leading-relaxed mb-5 flex-1">
          {pitch}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-[11px] font-mono text-muted bg-bg-elev border border-border/60"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-border/40">
          <span className="text-sm text-primary group-hover:text-primary-hover transition-colors">
            {t("portfolio.projects.openApp")}
          </span>
          {repoHref && (
            <a
              href={repoHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
            >
              <Github size={12} aria-hidden />
              {t("portfolio.projects.viewCode")}
            </a>
          )}
        </div>
      </div>
    </a>
  );
}
