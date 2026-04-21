/**
 * Pie chart showing total energy split: aero, rolling, gravity.
 * Only counts positive contributions (energy spent, not gained from descents).
 */

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import type { ProfileData } from "../types";

const COLORS = ["#1D9E75", "#3B82F6", "#E8654A", "#F59E0B"];

export default function EnergyPieChart({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  let aero = 0;
  let rolling = 0;
  let gravity = 0;
  let accel = 0;

  for (let i = 0; i < profile.p_aero.length; i++) {
    if (!profile.filter_valid[i]) continue;
    aero += Math.max(0, profile.p_aero[i] || 0);
    rolling += Math.max(0, profile.p_rolling[i] || 0);
    gravity += Math.max(0, profile.p_gravity[i] || 0);
    accel += Math.max(0, (profile as any).p_accel?.[i] || 0);
  }

  const total = aero + rolling + gravity + accel || 1;

  const data = [
    { name: t("energyAero"), value: Math.round(aero), pct: ((aero / total) * 100).toFixed(0) },
    { name: t("energyRolling"), value: Math.round(rolling), pct: ((rolling / total) * 100).toFixed(0) },
    { name: t("energyGravity"), value: Math.round(gravity), pct: ((gravity / total) * 100).toFixed(0) },
    { name: t("energyAccel"), value: Math.round(accel), pct: ((accel / total) * 100).toFixed(0) },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            dataKey="value"
            label={({ name, pct }) => `${name} ${pct}%`}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#14141c", border: "1px solid #262633" }}
            formatter={(value: number, name: string) => [`${value.toLocaleString()} J`, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
