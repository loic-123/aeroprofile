import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { Anomaly } from "../types";

export default function AnomalyAlerts({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <div className="space-y-2">
      {anomalies.map((a, i) => {
        const styles =
          a.severity === "error"
            ? { bg: "bg-coral/10", border: "border-coral", text: "text-coral", Icon: AlertCircle }
            : a.severity === "warning"
              ? {
                  bg: "bg-orange-500/10",
                  border: "border-orange-500",
                  text: "text-orange-400",
                  Icon: AlertTriangle,
                }
              : { bg: "bg-info/10", border: "border-info", text: "text-info", Icon: Info };
        const { Icon } = styles;
        return (
          <div
            key={i}
            className={`${styles.bg} border ${styles.border} rounded-lg p-3 flex gap-3`}
          >
            <Icon className={styles.text} size={20} />
            <div className="flex-1">
              <div className={`font-semibold text-sm ${styles.text}`}>{a.title}</div>
              <div className="text-sm text-text mt-1">{a.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
