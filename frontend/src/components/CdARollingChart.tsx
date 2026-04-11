import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { ProfileData } from "../types";

export default function CdARollingChart({
  profile,
  cdaMean,
}: {
  profile: ProfileData;
  cdaMean: number;
}) {
  const data = profile.distance_km.map((d, i) => {
    const cda = profile.cda_rolling[i];
    const valid = profile.filter_valid[i];
    return {
      d,
      cdaValid: valid && cda != null ? cda : null,
      cdaFiltered: !valid && cda != null ? cda : null,
    };
  });

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">CdA glissant (10 min)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis
            stroke="#8b8ba0"
            fontSize={11}
            domain={[0.15, 0.6]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} />
          <Legend />
          <ReferenceLine y={cdaMean} stroke="#1D9E75" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cdaFiltered"
            stroke="#E8654A"
            dot={false}
            name="CdA (filtré)"
            strokeWidth={1}
            opacity={0.5}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="cdaValid"
            stroke="#3B82F6"
            dot={false}
            name="CdA (retenu)"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
