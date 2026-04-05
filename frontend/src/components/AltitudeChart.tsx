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
import type { ProfileData } from "../types";

export default function AltitudeChart({ profile }: { profile: ProfileData }) {
  const data = profile.distance_km.map((d, i) => ({
    d,
    real: profile.altitude_real[i],
    virtual: profile.altitude_virtual[i] + (profile.altitude_real[0] || 0),
  }));
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Altitude réelle vs virtuelle (Chung)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="#262633" />
          <XAxis dataKey="d" stroke="#8b8ba0" fontSize={11} unit=" km" />
          <YAxis stroke="#8b8ba0" fontSize={11} unit=" m" />
          <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} />
          <Legend />
          <Line type="monotone" dataKey="real" stroke="#1D9E75" dot={false} name="Altitude réelle" />
          <Line
            type="monotone"
            dataKey="virtual"
            stroke="#E8654A"
            dot={false}
            strokeDasharray="4 4"
            name="Altitude virtuelle"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
