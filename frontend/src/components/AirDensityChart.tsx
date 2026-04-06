/**
 * Air density (ρ) along the ride distance.
 * Shows how altitude and temperature affect ρ throughout the ride.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ProfileData } from "../types";

export default function AirDensityChart({ profile }: { profile: ProfileData }) {
  const data = profile.distance_km.map((d, i) => ({
    d,
    rho: profile.rho[i],
  }));
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis
            stroke="#8b8ba0"
            fontSize={11}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(3)}
            unit=" kg/m³"
          />
          <Tooltip
            contentStyle={{ background: "#14141c", border: "1px solid #262633" }}
            formatter={(v: number) => [`${v.toFixed(4)} kg/m³`, "ρ"]}
          />
          <Line type="monotone" dataKey="rho" stroke="#F59E0B" dot={false} name="ρ" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
