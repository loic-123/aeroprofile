/**
 * Wind speed and direction along the ride distance.
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
} from "recharts";
import { useTranslation } from "react-i18next";
import type { ProfileData } from "../types";

export default function WindChart({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  const data = profile.distance_km.map((d, i) => ({
    d,
    speed: profile.wind_speed_ms[i] * 3.6,
    dir: profile.wind_dir_deg[i],
  }));
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis yAxisId="s" stroke="#8b8ba0" fontSize={11} unit=" km/h" />
          <YAxis yAxisId="d" orientation="right" stroke="#8b8ba0" fontSize={11} unit="°" domain={[0, 360]} />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
          <Legend />
          <Line yAxisId="s" type="monotone" dataKey="speed" stroke="#3B82F6" dot={false} name={`${t("chartsLegend.windSpeed")} (km/h)`} />
          <Line yAxisId="d" type="monotone" dataKey="dir" stroke="#E8654A" dot={false} name={`${t("chartsLegend.windDir")} (°)`} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
