import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useNumberRoll } from "../../hooks/useNumberRoll";
import type { ReactNode } from "react";

interface Props {
  onCtaAnalyze: () => void;
  onCtaMethod: () => void;
}

export function LandingHero({ onCtaAnalyze, onCtaMethod }: Props) {
  const { t } = useTranslation();
  const rolled = useNumberRoll(0.284, { decimals: 3, durationMs: 1100 });

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-20 right-0 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(124 111 222 / 0.18) 0%, rgba(124, 111, 222, 0) 70%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-32 grid grid-cols-1 md:grid-cols-[1.1fr,1fr] gap-12 md:gap-16 items-center">
        <div className="space-y-6">
          <AnimatedBlock delay={0}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-panel text-xs text-muted-strong">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
              {t("landing.badge")}
            </div>
          </AnimatedBlock>

          <AnimatedBlock delay={60}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-text">
              {t("landing.heroPart1")} <span className="text-primary">CdA</span>
              <br />
              {t("landing.heroPart2")}
            </h1>
          </AnimatedBlock>

          <AnimatedBlock delay={120}>
            <p className="text-base md:text-lg text-muted-strong leading-relaxed max-w-md">
              <Trans
                i18nKey="landing.heroLede"
                components={{ fit: <span className="num text-text" /> }}
              />
            </p>
          </AnimatedBlock>

          <AnimatedBlock delay={180}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onCtaAnalyze}
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-fg font-medium text-sm transition-all duration-base hover:bg-primary-hover hover:shadow-glow-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {t("landing.ctaAnalyze")}
                <ArrowRight
                  size={16}
                  className="transition-transform duration-base group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
              <button
                onClick={onCtaMethod}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border-strong text-text text-sm transition-colors duration-base hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {t("landing.ctaMethod")}
              </button>
              <a
                href="https://github.com/loic-123/aeroprofile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-muted hover:text-text transition-colors"
              >
                <Github size={15} aria-hidden />
                GitHub
              </a>
            </div>
          </AnimatedBlock>

          <AnimatedBlock delay={240}>
            <p className="text-xs text-muted pt-2">
              {t("landing.byline")}
            </p>
          </AnimatedBlock>
        </div>

        <AnimatedBlock delay={300}>
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-xl border border-border/60 opacity-60 pointer-events-none"
              aria-hidden
            />
            <div className="relative rounded-xl border border-border-strong bg-panel shadow-e3 p-6 md:p-8 overflow-hidden">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted font-medium pb-4 border-b border-border/60">
                <span>{t("landing.sampleAnalysis")}</span>
                <span className="num text-muted">52.3 km · 1h47</span>
              </div>

              <div className="mt-6 text-[11px] uppercase tracking-widest text-muted font-medium">
                CdA
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="num font-bold text-5xl md:text-6xl text-text tracking-tight">
                  {rolled}
                </span>
                <span className="text-lg text-muted">m²</span>
              </div>

              <dl className="mt-4 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <dt className="text-muted w-28 text-[10px] uppercase tracking-wider">IC95 Hessian</dt>
                  <dd className="text-text">[0.271 – 0.297]</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="text-muted w-28 text-[10px] uppercase tracking-wider">IC95 Conformal</dt>
                  <dd className="text-accent">[0.274 – 0.301]</dd>
                  <span className="text-muted text-[10px]">n=12</span>
                </div>
              </dl>

              <div className="mt-6 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted font-medium mb-2">
                  <span>{t("landing.cdaOverTime")}</span>
                  <span className="text-accent">▁▂▄▆▇█▇▆▄▃▂▂</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
                {[
                  { label: "Crr", value: "0.0032" },
                  { label: "RMSE", value: "±63 W" },
                  { label: "ρ", value: "1.203" },
                ].map((s) => (
                  <div key={s.label} className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-muted">{s.label}</div>
                    <div className="num text-sm text-text mt-0.5">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedBlock>
      </div>
    </section>
  );
}

function AnimatedBlock({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        delay: delay / 1000,
      }}
    >
      {children}
    </motion.div>
  );
}
