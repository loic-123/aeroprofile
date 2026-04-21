import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  Wind,
  Sigma,
  Shield,
  Filter,
  Gauge,
  Activity,
  ArrowRight,
} from "lucide-react";

interface Props {
  onGotoMethod: (slug: string) => void;
}

interface Diff {
  icon: ReactNode;
  title: string;
  body: string;
  link?: { label: string; slug: string };
}

/**
 * Grid of 6 differentiators — the "why use AeroProfile and not
 * Aerolab / myWindsock / Notio" argument made visual. Each card has
 * an icon, a short title, a 2-sentence rationale, and a link to the
 * corresponding methodology article so readers can drill in.
 *
 * Layout: 3 columns on lg, 2 on md, 1 on mobile. Cards animate in
 * with a short stagger as the user scrolls into view.
 */
export function DifferentiatorGrid({ onGotoMethod }: Props) {
  const diffs: Diff[] = [
    {
      icon: <Wind size={18} />,
      title: "Wind-inverse solver",
      body:
        "The primary solver jointly fits CdA and the wind field, rather than trusting a 10 km-grid weather API. On rides with heading variety this typically doubles R² (0.5 → 0.98).",
      link: { label: "Method", slug: "wind-correction" },
    },
    {
      icon: <Sigma size={18} />,
      title: "Hierarchical meta-analysis",
      body:
        "Multi-ride aggregation uses a DerSimonian–Laird random-effects estimator with the Hartung–Knapp–Sidik–Jonkman small-sample correction. Proper meta-analysis, not a naïve average.",
      link: { label: "Method", slug: "aggregation-methods" },
    },
    {
      icon: <Shield size={18} />,
      title: "Prior invariance, tested",
      body:
        "Your position prior should not shift the aggregate CdA. AeroProfile publishes cda_raw on every ride so you can verify, and a pytest regression enforces the invariant in CI.",
      link: { label: "Method", slug: "prior-invariance" },
    },
    {
      icon: <Filter size={18} />,
      title: "Eight quality gates",
      body:
        "Not every ride yields a good CdA. Each analysis is classified by 8 documented gates (solvers_pegged, sensor_miscalib, prior_dominated…) so bad rides are flagged, not silently averaged in.",
    },
    {
      icon: <Gauge size={18} />,
      title: "Per-ride wind sensitivity",
      body:
        "A post-hoc re-solve with wind × 1.05 exposes the Δ CdA. Not a blind correction - a transparent number showing whether this ride is wind-robust or wind-fragile.",
      link: { label: "Method", slug: "wind-correction" },
    },
    {
      icon: <Activity size={18} />,
      title: "Power-meter drift detection",
      body:
        "Independent of the solver. Flat-pedaling bias ratio tracked per sensor, in your history, with a KDE distribution. Spots a drifting Assioma before your CdA starts to look weird.",
      link: { label: "Method", slug: "power-meter-quality" },
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
      <div className="mb-12 md:mb-16 max-w-2xl">
        <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
          Why it's different
        </div>
        <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
          Six choices that make this tool trustworthy.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {diffs.map((d, i) => (
          <motion.article
            key={d.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
              delay: Math.min(i * 0.05, 0.25),
            }}
            className="group relative rounded-lg border border-border bg-panel p-6 transition-colors duration-base hover:border-border-strong hover:bg-panel-2"
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary-subtle border border-primary-border text-primary mb-4">
              {d.icon}
            </div>
            <h3 className="text-base font-semibold text-text mb-2 tracking-tight">
              {d.title}
            </h3>
            <p className="text-sm text-muted-strong leading-relaxed">{d.body}</p>
            {d.link && (
              <button
                onClick={() => onGotoMethod(d.link!.slug)}
                className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                {d.link.label}
                <ArrowRight
                  size={12}
                  className="transition-transform duration-base group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
