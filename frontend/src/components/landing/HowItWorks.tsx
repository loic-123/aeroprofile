import { motion } from "framer-motion";
import { Upload, Cpu, LineChart } from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  num: string;
  icon: ReactNode;
  title: string;
  body: string;
}

/**
 * "How it works" — a deliberately short 3-step walkthrough so
 * readers who skipped the differentiator grid still leave with
 * a mental model of the pipeline.
 */
export function HowItWorks() {
  const steps: Step[] = [
    {
      num: "01",
      icon: <Upload size={16} />,
      title: "Drop your ride",
      body:
        ".fit, .gpx or .tcx. One file or a batch — batches get aggregated with proper hierarchical meta-analysis, not a naïve mean.",
    },
    {
      num: "02",
      icon: <Cpu size={16} />,
      title: "The pipeline runs",
      body:
        "13 filters isolate steady-state points. Three solvers compete (wind-inverse, Chung VE, Martin LS). Eight quality gates grade the estimate. Tiled Open-Meteo weather feeds the wind.",
    },
    {
      num: "03",
      icon: <LineChart size={16} />,
      title: "You get a number you can trust",
      body:
        "CdA with Hessian + conformal confidence intervals. Per-regime breakdown (flat / climb / descent). Diagnostics if something smells off. And every choice explained in /methods.",
    },
  ];

  return (
    <section className="bg-panel/40 border-y border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="mb-12 md:mb-16 max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            How it works
          </div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
            From a bike file to a trustworthy CdA in ~30 seconds.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.35,
                ease: [0.16, 1, 0.3, 1],
                delay: i * 0.08,
              }}
              className="relative"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="num text-primary/80 text-sm">{s.num}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-primary">{s.icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-text mb-2 tracking-tight">
                {s.title}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
