import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface Props {
  onGotoAbout: () => void;
}

/**
 * A short builder teaser on the landing — the tool is introduced via
 * a single honest sentence about who made it, then a CTA to the
 * /about page. The point is to anchor credibility visually (the
 * photo) without turning the landing into a CV.
 */
export function BuilderTeaser({ onGotoAbout }: Props) {
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
              // Graceful fallback to the SVG placeholder if the
              // user hasn't uploaded their photo yet.
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
            Who built this
          </div>
          <p className="text-xl md:text-2xl font-display text-text leading-snug tracking-tight">
            AeroProfile is what you get when a triathlete trains at
            Imperial's AI lab and can't find a CdA estimator he trusts.
          </p>
          <button
            onClick={onGotoAbout}
            className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
          >
            About the builder
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </motion.div>
    </section>
  );
}
