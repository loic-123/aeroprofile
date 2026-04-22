import { useTranslation } from "react-i18next";
import type { AnalysisResult } from "../../types";
import { Card } from "../ui";
import InfoTooltip from "../InfoTooltip";
import AltitudeChart from "../AltitudeChart";
import CdARollingChart from "../CdARollingChart";
import PowerDecomposition from "../PowerDecomposition";
import PowerScatter from "../PowerScatter";
import ResidualsHistogram from "../ResidualsHistogram";
import SpeedCdAScatter from "../SpeedCdAScatter";
import WindChart from "../WindChart";
import SpeedPowerChart from "../SpeedPowerChart";
import EnergyPieChart from "../EnergyPieChart";
import AirDensityChart from "../AirDensityChart";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  result: AnalysisResult;
}

function ChartCard({
  title,
  description,
  children,
  index = 0,
}: {
  title: string;
  description: string;
  children: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.04, 0.2) }}
    >
      <Card elevation={1} className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold flex items-center">
            {title}
            <InfoTooltip text={description} />
          </h3>
          <p className="text-xs text-muted mt-0.5 leading-snug">{description}</p>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

/**
 * All eight analytical charts stacked in a reading order that tells
 * a story: first altitude reconstruction (the sanity check), then
 * CdA rolling (is it stable?), then the power decomposition (what
 * does the power go into?), then model-vs-measure scatter + residuals
 * (how well did we fit?), then context (wind, ρ, map).
 *
 * Each chart is wrapped in a motion.div that fades+slides in when
 * scrolled into view — only on first appearance, not on every
 * re-render. prefers-reduced-motion is respected globally.
 */
export function ResultsCharts({ result }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard
        index={0}
        title={t("charts.altitudeTitle")}
        description={t("charts.altitudeDesc")}
      >
        <AltitudeChart profile={result.profile} />
      </ChartCard>

      <ChartCard
        index={1}
        title={t("charts.cdaRollingTitle")}
        description={t("charts.cdaRollingDesc")}
      >
        <CdARollingChart profile={result.profile} cdaMean={result.cda} />
      </ChartCard>

      <ChartCard
        index={2}
        title={t("charts.powerDecompTitle")}
        description={t("charts.powerDecompDesc")}
      >
        <PowerDecomposition profile={result.profile} />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={3}
          title={t("charts.powerScatterTitle")}
          description={t("charts.powerScatterDesc")}
        >
          <PowerScatter profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={4}
          title={t("charts.residualsTitle")}
          description={t("charts.residualsDesc")}
        >
          <ResidualsHistogram profile={result.profile} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={5}
          title={t("charts.speedPowerTitle")}
          description={t("charts.speedPowerDesc")}
        >
          <SpeedPowerChart profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={6}
          title={t("charts.energyPieTitle")}
          description={t("charts.energyPieDesc")}
        >
          <EnergyPieChart profile={result.profile} />
        </ChartCard>
      </div>

      <ChartCard
        index={7}
        title={t("charts.speedCdaTitle")}
        description={t("charts.speedCdaDesc")}
      >
        <SpeedCdAScatter profile={result.profile} />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          index={8}
          title={t("charts.windChartTitle")}
          description={t("charts.windChartDesc")}
        >
          <WindChart profile={result.profile} />
        </ChartCard>
        <ChartCard
          index={9}
          title={t("charts.rhoTitle")}
          description={t("charts.rhoDesc")}
        >
          <AirDensityChart profile={result.profile} />
        </ChartCard>
      </div>

    </div>
  );
}
