import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
import type { ProfileData } from "../types";

export default function AltitudeChart({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  const data = profile.distance_km.map((d, i) => ({
    d,
    real: profile.altitude_real[i],
    virtual: profile.altitude_virtual[i] + (profile.altitude_real[0] || 0),
  }));

  // Compute VE-excluded zones (contiguous segments where filter_ve_valid=false)
  const veZones: { x1: number; x2: number }[] = [];
  if (profile.filter_ve_valid) {
    let inZone = false;
    let zoneStart = 0;
    for (let i = 0; i < profile.filter_ve_valid.length; i++) {
      if (!profile.filter_ve_valid[i] && !inZone) {
        inZone = true;
        zoneStart = profile.distance_km[i];
      } else if (profile.filter_ve_valid[i] && inZone) {
        inZone = false;
        veZones.push({ x1: zoneStart, x2: profile.distance_km[i] });
      }
    }
    if (inZone) {
      veZones.push({ x1: zoneStart, x2: profile.distance_km[profile.distance_km.length - 1] });
    }
  }

  // Compute Y domain for reference areas (need min/max altitude)
  const allAlt = data.map((d) => d.real).filter((v) => v != null) as number[];
  const yMin = Math.min(...allAlt) - 10;
  const yMax = Math.max(...allAlt) + 10;

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">
        {t("charts.altitudeTitle")}
        {veZones.length > 0 && (
          <span className="text-xs text-muted font-normal ml-2">
            {t("chartsLegend.filteredHint")}
          </span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis stroke="#8b8ba0" fontSize={11} unit=" m" />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
          <Legend />
          {veZones.map((z, i) => (
            <ReferenceArea
              key={i}
              x1={z.x1}
              x2={z.x2}
              y1={yMin}
              y2={yMax}
              fill="#8b8ba0"
              fillOpacity={0.15}
              stroke="none"
            />
          ))}
          <Line type="monotone" dataKey="real" stroke="#1D9E75" dot={false} name={t("chartsLegend.altReal")} />
          <Line
            type="monotone"
            dataKey="virtual"
            stroke="#E8654A"
            dot={false}
            strokeDasharray="4 4"
            name={t("chartsLegend.altVirtual")}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
