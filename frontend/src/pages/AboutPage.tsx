import { motion } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import { Github, Mail, Linkedin, ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  onGotoHome: () => void;
  onGotoAnalyze: () => void;
  onGotoMethods: () => void;
}

export default function AboutPage({
  onGotoHome,
  onGotoAnalyze,
  onGotoMethods,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      <button
        onClick={onGotoHome}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors mb-10"
      >
        <ArrowLeft size={12} aria-hidden />
        {t("about.back")}
      </button>

      <FadeIn>
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-5">
          {t("about.eyebrow")}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 md:gap-10 items-start mb-10">
          <img
            src="/loic.jpg"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/loic.svg";
            }}
            alt="Loïc Bouxirot"
            width={160}
            height={160}
            className="w-36 h-36 md:w-40 md:h-40 rounded-full object-cover border border-border-strong shadow-e2 mx-auto md:mx-0"
          />
          <div className="space-y-4">
            <h1 className="font-display text-3xl md:text-4xl leading-[1.1] text-text tracking-tight">
              {t("about.title")}
            </h1>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="prose prose-invert max-w-none space-y-5 text-[15px] leading-relaxed text-muted-strong">
          <p>
            <Trans
              i18nKey="about.p1"
              components={{
                name: <span className="text-text font-medium" />,
                em: <em />,
              }}
            />
          </p>
          <p>
            <Trans
              i18nKey="about.p2"
              components={{
                imperial: <span className="text-text" />,
                em: <em />,
              }}
            />
          </p>
          <p>
            <Trans
              i18nKey="about.p3"
              components={{ em: <em /> }}
            />
          </p>
          <p className="text-muted">
            <Trans
              i18nKey="about.p4"
              components={{ em: <em /> }}
            />
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={180}>
        <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap items-center gap-4">
          <span className="text-xs uppercase tracking-widest text-muted font-semibold">
            {t("about.contact")}
          </span>
          <a
            href="https://github.com/loic-123/aeroprofile"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-text hover:text-primary transition-colors"
          >
            <Github size={14} aria-hidden />
            GitHub
          </a>
          <a
            href="mailto:loic.bouxirot@gmail.com"
            className="inline-flex items-center gap-1.5 text-sm text-text hover:text-primary transition-colors"
          >
            <Mail size={14} aria-hidden />
            Email
          </a>
          <a
            href="https://www.linkedin.com/in/loïc-bouxirot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-text hover:text-primary transition-colors"
          >
            <Linkedin size={14} aria-hidden />
            LinkedIn
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={260}>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Cta
            onClick={onGotoAnalyze}
            title={t("about.ctaAnalyzeTitle")}
            body={t("about.ctaAnalyzeBody")}
          />
          <Cta
            onClick={onGotoMethods}
            title={t("about.ctaMethodsTitle")}
            body={t("about.ctaMethodsBody")}
          />
        </div>
      </FadeIn>
    </div>
  );
}

function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: delay / 1000,
      }}
    >
      {children}
    </motion.div>
  );
}

function Cta({
  onClick,
  title,
  body,
}: {
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-lg border border-border bg-panel p-5 transition-all duration-base hover:border-primary-border hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="flex items-center gap-2 font-semibold text-text">
        {title}
        <ArrowRight
          size={14}
          className="transition-transform duration-base group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <p className="text-sm text-muted-strong leading-relaxed mt-1.5">
        {body}
      </p>
    </button>
  );
}
