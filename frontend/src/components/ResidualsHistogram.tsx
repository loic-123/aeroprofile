import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ProfileData } from "../types";

export default function ResidualsHistogram({ profile }: { profile: ProfileData }) {
  const residuals: number[] = [];
  for (let i = 0; i < profile.power_measured.length; i++) {
    if (!profile.filter_valid[i]) continue;
    const r = profile.power_modeled[i] - profile.power_measured[i];
    if (Math.abs(r) < 200) residuals.push(r);
  }
  const bins = 40;
  const min = -150,
    max = 150;
  const step = (max - min) / bins;
  const hist: { bin: number; count: number }[] = [];
  for (let i = 0; i < bins; i++) hist.push({ bin: min + i * step + step / 2, count: 0 });
  residuals.forEach((r) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((r - min) / step)));
    hist[idx].count++;
  });
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Histogramme des résidus (W)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={hist}>
          <CartesianGrid stroke="#262633" />
          <XAxis
            dataKey="bin"
            stroke="#8b8ba0"
            fontSize={11}
            tickFormatter={(v) => v.toFixed(0)}
          />
          <YAxis stroke="#8b8ba0" fontSize={11} />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
          <ReferenceLine x={0} stroke="#E8654A" strokeDasharray="3 3" />
          <Bar dataKey="count" fill="#3B82F6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
