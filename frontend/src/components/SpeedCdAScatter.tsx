import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ProfileData } from "../types";

export default function SpeedCdAScatter({ profile }: { profile: ProfileData }) {
  const data: { x: number; y: number }[] = [];
  for (let i = 0; i < profile.cda_rolling.length; i++) {
    const cda = profile.cda_rolling[i];
    const p = profile.power_measured[i];
    if (cda == null || !profile.filter_valid[i] || p <= 0) continue;
    // back-compute speed from distance
    if (i === 0) continue;
    // rough speed proxy
    data.push({ x: cda, y: p });
  }
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">CdA glissant vs puissance mesurée</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="x" stroke="#8b8ba0" fontSize={11} name="CdA" />
          <YAxis dataKey="y" stroke="#8b8ba0" fontSize={11} unit=" W" />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} />
          <Scatter data={data} fill="#1D9E75" fillOpacity={0.3} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
