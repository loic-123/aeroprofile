/**
 * CdA running average over sessions — shows how the estimate stabilises
 * as more rides are added. X axis = session number, Y axis = CdA.
 * Two traces: per-ride CdA (dots) and cumulative weighted average (line).
 */

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { useTranslation } from "react-i18next";
import InfoTooltip from "./InfoTooltip";

interface RidePoint {
  date: string;
  cda: number;
  nrmse: number;
  fileName: string;
}

interface Props {
  rides: RidePoint[];
  aggCda: number | null;
}

export default function CdARunningAvgChart({ rides, aggCda }: Props) {
  const { t } = useTranslation();
  if (rides.length < 2) return null;

  // Sort by date
  const sorted = [...rides].sort((a, b) => a.date.localeCompare(b.date));

  // Compute running weighted average (weight = 1/nrmse², floor 0.05)
  const data = sorted.map((r, i) => {
    let totalW = 0;
    let sumCda = 0;
    for (let j = 0; j <= i; j++) {
      const n = Math.max(sorted[j].nrmse, 0.05);
      const qw = 3.0 - 2.0 * Math.min(n / 0.6, 1.0); // linear quality
      const w = qw;
      totalW += w;
      sumCda += sorted[j].cda * w;
    }
    return {
      session: i + 1,
      date: r.date,
      fileName: r.fileName,
      cda: Math.round(r.cda * 1000) / 1000,
      avg: Math.round((sumCda / totalW) * 1000) / 1000,
    };
  });

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        {t("runningAvgChart.title")}
        <InfoTooltip text={t("tooltips.runningAvg")} />
      </h3>
      <p className="text-xs text-muted mb-3">
        {t("runningAvgChart.subtitle")}
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis
            dataKey="session"
            stroke="#8b8ba0"
            fontSize={11}
            label={{ value: t("runningAvgChart.xAxis"), position: "insideBottom", offset: -5, fill: "#8b8ba0", fontSize: 10 }}
          />
          <YAxis
            stroke="#8b8ba0"
            fontSize={11}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{ background: "#14141c", border: "1px solid #262633" }}
            formatter={(value: number, name: string) => [
              value.toFixed(3),
              name === "avg" ? t("runningAvgChart.tooltipAvg") : t("runningAvgChart.tooltipRide"),
            ]}
            labelFormatter={(label) => {
              const d = data[Number(label) - 1];
              return d ? `${d.date} — ${d.fileName}` : t("runningAvgChart.rideFallback", { n: label });
            }}
          />
          <Legend
            formatter={(value) =>
              value === "avg" ? t("runningAvgChart.legendAvg") : t("runningAvgChart.legendRide")
            }
          />
          {aggCda && (
            <ReferenceLine
              y={aggCda}
              stroke="#1D9E75"
              strokeDasharray="6 3"
              strokeWidth={1}
            />
          )}
          <Scatter dataKey="cda" fill="#3B82F6" name="cda" />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#1D9E75"
            strokeWidth={2.5}
            dot={false}
            name="avg"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
