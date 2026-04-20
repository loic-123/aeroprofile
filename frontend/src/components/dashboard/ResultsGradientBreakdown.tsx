import type { AnalysisResult } from "../../types";
import { Card, Badge } from "../ui";
import InfoTooltip from "../InfoTooltip";
import { Mountain, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface Props {
  result: AnalysisResult;
}

/**
 * CdA recomputed on three gradient regimes (flat, climb, descent).
 * A spread > 0.08 m² between the three signals a model mismatch
 * (usually asymmetric wind) or a genuine position change between
 * low-power climb and high-power descent.
 */
export function ResultsGradientBreakdown({ result }: Props) {
  const { cda_climb, cda_descent, cda_flat } = result;
  if (cda_climb == null && cda_descent == null && cda_flat == null) return null;

  const vals = [cda_climb, cda_descent, cda_flat].filter(
    (v): v is number => v != null,
  );
  const spread = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  const asymmetric = spread > 0.08;

  const rows: {
    icon: JSX.Element;
    label: string;
    val: number | null | undefined;
    note: string;
  }[] = [
    {
      icon: <Minus size={14} aria-hidden />,
      label: "Plat (±2%)",
      val: cda_flat,
      note: "le plus informatif pour le CdA",
    },
    {
      icon: <Mountain size={14} aria-hidden />,
      label: "Montée (>+2%)",
      val: cda_climb,
      note: "souvent biaisé (gravité domine)",
    },
    {
      icon: <TrendingDown size={14} aria-hidden />,
      label: "Descente (<−2%)",
      val: cda_descent,
      note: "V_air élevé, fort signal aéro",
    },
  ];

  return (
    <Card elevation={1} className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center">
            CdA par régime de pente
            <InfoTooltip text="CdA recalculé séparément sur les portions montantes (>+2%), descendantes (<−2%) et plates (±2%). Un écart > 0.08 m² entre les trois suggère un biais : vent asymétrique mal capturé, dérive du capteur à haute puissance, ou changement de position entre montée et descente. Ce n'est pas forcément une erreur — les cyclistes se redressent VRAIMENT en montée lente." />
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Grosse asymétrie = signal de biais OU changement de position réel
          </p>
        </div>
        {asymmetric && (
          <Badge tone="warn" size="sm" className="shrink-0">
            Δ {spread.toFixed(3)} m²
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1">
              <span className="text-muted">{r.icon}</span>
              {r.label}
            </div>
            <div className="num text-lg font-semibold">
              {r.val != null ? r.val.toFixed(3) : "—"}
            </div>
            <div className="text-[10px] text-muted opacity-70">{r.note}</div>
          </div>
        ))}
      </div>
      {asymmetric && (
        <div className="mt-3 pt-3 border-t border-border/60 text-xs text-warn flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            Écart de {spread.toFixed(3)} m² entre régimes — vérifiez que le
            vent API est représentatif de la sortie.
          </span>
        </div>
      )}
    </Card>
  );
}
