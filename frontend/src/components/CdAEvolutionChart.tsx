/**
 * CdA evolution over time — one line per rider, each point = one ride.
 * Only shown when at least one rider has ≥2 completed rides.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { AnalysisResult } from "../types";
import InfoTooltip from "./InfoTooltip";

const RIDER_COLORS = ["#1D9E75", "#3B82F6", "#E8654A", "#F59E0B", "#A855F7", "#EC4899"];

interface RidePoint {
  date: string;
  cda: number;
  r2: number;
  fileName: string;
}

interface RiderSeries {
  name: string;
  points: RidePoint[];
}

interface Props {
  riders: RiderSeries[];
}

export default function CdAEvolutionChart({ riders }: Props) {
  const { t } = useTranslation();
  // Only show if at least one rider has ≥2 data points
  const hasEvolution = riders.some((r) => r.points.length >= 2);
  if (!hasEvolution && riders.every((r) => r.points.length <= 1)) {
    return null;
  }

  // Build a unified dataset: merge all dates, one column per rider
  const allDates = new Set<string>();
  for (const r of riders) {
    for (const p of r.points) allDates.add(p.date);
  }
  const sortedDates = [...allDates].sort();

  const data = sortedDates.map((date) => {
    const row: Record<string, any> = { date };
    for (const r of riders) {
      const pt = r.points.find((p) => p.date === date);
      if (pt) {
        row[r.name] = pt.cda;
        row[`${r.name}_r2`] = pt.r2;
        row[`${r.name}_file`] = pt.fileName;
      }
    }
    return row;
  });

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center">
        {t("evolChart.title")}
        <InfoTooltip text="Chaque point correspond à une sortie analysée. Si le CdA diminue au fil du temps, le cycliste a amélioré sa position aéro (ou a changé d'équipement). Attention : le CdA varie aussi avec les conditions (vent, drafting, parcours). Les points avec R² < 0.3 sont plus incertains." />
      </h3>
      <p className="text-xs text-muted mb-3">
        {t("evolChart.subtitle")}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="date" stroke="#8b8ba0" fontSize={11} />
          <YAxis
            stroke="#8b8ba0"
            fontSize={11}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{ background: "#14141c", border: "1px solid #262633" }}
            formatter={(value: number, name: string) => [
              `CdA = ${value.toFixed(3)} m²`,
              name,
            ]}
            labelFormatter={(label) => `Date : ${label}`}
          />
          <Legend />
          {riders.map((r, i) => (
            <Line
              key={r.name}
              type="monotone"
              dataKey={r.name}
              stroke={RIDER_COLORS[i % RIDER_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 5, fill: RIDER_COLORS[i % RIDER_COLORS.length] }}
              connectNulls
              name={r.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
