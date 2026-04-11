import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ProfileData } from "../types";

export default function PowerDecomposition({ profile }: { profile: ProfileData }) {
  const data = profile.distance_km.map((d, i) => ({
    d,
    aero: Math.max(0, profile.p_aero[i] || 0),
    rolling: Math.max(0, profile.p_rolling[i] || 0),
    gravity: Math.max(0, profile.p_gravity[i] || 0),
  }));
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Décomposition de la puissance</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis stroke="#8b8ba0" fontSize={11} unit=" W" />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
          <Legend />
          <Area
            type="monotone"
            dataKey="aero"
            stackId="1"
            stroke="#1D9E75"
            fill="#1D9E75"
            fillOpacity={0.6}
            name="Aéro"
          />
          <Area
            type="monotone"
            dataKey="rolling"
            stackId="1"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.6}
            name="Roulement"
          />
          <Area
            type="monotone"
            dataKey="gravity"
            stackId="1"
            stroke="#E8654A"
            fill="#E8654A"
            fillOpacity={0.6}
            name="Gravité"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
