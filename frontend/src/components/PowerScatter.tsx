import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ProfileData } from "../types";

export default function PowerScatter({ profile }: { profile: ProfileData }) {
  const data = profile.power_measured
    .map((m, i) => ({ x: m, y: profile.power_modeled[i] }))
    .filter((p) => p.x > 0 && p.x < 800 && Math.abs(p.y) < 800)
    .filter((_, i) => i % 3 === 0);
  const maxV = 600;
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">P_modèle vs P_mesuré</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart>
          <CartesianGrid stroke="#262633" />
          <XAxis
            dataKey="x"
            name="Mesuré"
            stroke="#8b8ba0"
            fontSize={11}
            domain={[0, maxV]}
            unit=" W"
          />
          <YAxis
            dataKey="y"
            name="Modèle"
            stroke="#8b8ba0"
            fontSize={11}
            domain={[0, maxV]}
            unit=" W"
          />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: maxV, y: maxV },
            ]}
            stroke="#E8654A"
            strokeDasharray="3 3"
          />
          <Scatter data={data} fill="#1D9E75" fillOpacity={0.4} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
