import { motion } from "framer-motion";
import { Github, Mail, Linkedin, ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  onGotoHome: () => void;
  onGotoAnalyze: () => void;
  onGotoMethods: () => void;
}

/**
 * About page. Compact on purpose: ~5 sentences that introduce Loïc
 * THROUGH the tool (not the reverse — no CV rundown). The page
 * should feel like a short, honest "who's behind this" aside that
 * pushes the visitor back to the product.
 */
export default function AboutPage({
  onGotoHome,
  onGotoAnalyze,
  onGotoMethods,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-20">
      {/* Back link */}
      <button
        onClick={onGotoHome}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors mb-10"
      >
        <ArrowLeft size={12} aria-hidden />
        Back to home
      </button>

      <FadeIn>
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-5">
          About
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
              AeroProfile is what you get when a triathlete trains at
              Imperial's AI lab and can't find a CdA estimator he trusts.
            </h1>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="prose prose-invert max-w-none space-y-5 text-[15px] leading-relaxed text-muted-strong">
          <p>
            Hi, I'm <span className="text-text font-medium">Loïc Bouxirot</span>.
            AeroProfile exists because, in 2024, I bought an aero helmet and spent
            the next six months wondering - in the unhinged, slightly obsessive
            way only a triathlete can - whether it was actually doing anything,
            or whether I'd just given €300 to a company that sells{" "}
            <em>hope, in expanded polystyrene form</em>.
          </p>
          <p>
            It turns out the answer to that question, honestly measured, requires
            inverse problems, Bayesian uncertainty, and a healthy respect for
            Open-Meteo's wind field. Which is a weirdly specific Venn diagram.
            So I wrote the tool I wanted to exist - leaning on the day job
            (safety-critical ML at{" "}
            <span className="text-text">Imperial College London</span>, with
            previous stops at Safran, Decathlon, and Ochy doing foundation
            models, computer vision, and LLM pipelines) and the weekend habit
            (front-pack triathlon, headwinds, opinions about tyre pressure).
          </p>
          <p>
            The wind-inverse solver, the hierarchical aggregation, the
            prior-invariance regression tests, the eight quality gates - they
            all come from that bicultural loop. If it looks over-engineered for
            a cycling tool, it's because every other tool I found was{" "}
            <em>under</em>-engineered for a measurement tool. I did not set out
            to write 14 methodology articles. It just kept happening.
          </p>
          <p className="text-muted">
            The code is on GitHub. Bug reports with a FIT file attached are
            gold. Bug reports that begin with <em>"I think your physics is
            wrong"</em> are even better, provided they end with a FIT file.
          </p>
        </div>
      </FadeIn>

      {/* Contact row */}
      <FadeIn delay={180}>
        <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap items-center gap-4">
          <span className="text-xs uppercase tracking-widest text-muted font-semibold">
            Get in touch
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

      {/* CTAs */}
      <FadeIn delay={260}>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Cta
            onClick={onGotoAnalyze}
            title="Analyze your ride"
            body="The fastest way to see what the tool does - drop a .fit and get your CdA in ~30 seconds."
          />
          <Cta
            onClick={onGotoMethods}
            title="Read the methodology"
            body="14 articles cover every solver, filter, and statistical choice inside AeroProfile."
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
