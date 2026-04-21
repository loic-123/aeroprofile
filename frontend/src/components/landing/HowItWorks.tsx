import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Upload, Cpu, LineChart } from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  num: string;
  icon: ReactNode;
  titleKey: string;
  bodyKey: string;
}

export function HowItWorks() {
  const { t } = useTranslation();
  const steps: Step[] = [
    { num: "01", icon: <Upload size={16} />, titleKey: "landing.step1Title", bodyKey: "landing.step1Body" },
    { num: "02", icon: <Cpu size={16} />, titleKey: "landing.step2Title", bodyKey: "landing.step2Body" },
    { num: "03", icon: <LineChart size={16} />, titleKey: "landing.step3Title", bodyKey: "landing.step3Body" },
  ];

  return (
    <section className="bg-panel/40 border-y border-border/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="mb-12 md:mb-16 max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            {t("landing.howItWorksEyebrow")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-text">
            {t("landing.howItWorksHeadline")}
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
                {t(s.titleKey)}
              </h3>
              <p className="text-sm text-muted-strong leading-relaxed">{t(s.bodyKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
