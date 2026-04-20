import type { AnalysisResult } from "../../types";
import { Card } from "../ui";
import InfoTooltip from "../InfoTooltip";

interface Props {
  result: AnalysisResult;
  massKg?: number;
}

/**
 * "Watts to ride on the flat" table + a one-liner summary of the
 * aero / rolling split at 40 km/h. Uses the rider's own mass + the
 * session's average air density for realism.
 */
export function ResultsDerivedMetrics({ result, massKg }: Props) {
  const rho = result.avg_rho;
  const cda = result.cda;
  const crr = result.crr;
  const mass = massKg || 75;
  const g = 9.80665;

  const powerAt = (kmh: number) => {
    const v = kmh / 3.6;
    const pAero = 0.5 * cda * rho * v * v * v;
    const pRoll = crr * mass * g * v;
    return (pAero + pRoll) / 0.976;
  };

  const speeds = [30, 35, 40, 45];

  const v40 = 40 / 3.6;
  const pAero40 = 0.5 * cda * rho * v40 * v40 * v40;
  const pRoll40 = crr * mass * g * v40;
  const aeroShare = (100 * pAero40) / (pAero40 + pRoll40);

  return (
    <Card elevation={1} className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-serif italic text-2xl text-primary/90 leading-none mb-2 flex items-center gap-2">
            Watts sur le plat
            <InfoTooltip text={`Watts nécessaires pour maintenir une vitesse donnée sur le plat, sans vent, pour ${mass} kg avec votre CdA et Crr. Air à densité de votre sortie.`} />
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            {mass} kg · ρ = {rho.toFixed(3)} · pas de vent
          </p>
        </div>
      </div>
      <table className="w-full text-sm font-mono">
        <tbody>
          {speeds.map((s) => (
            <tr
              key={s}
              className="border-b border-border/40 last:border-0 hover:bg-panel-2/50 transition-colors"
            >
              <td className="py-1.5 text-muted">{s} km/h</td>
              <td className="py-1.5 text-right text-text font-semibold">
                {powerAt(s).toFixed(0)} <span className="text-muted font-normal">W</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-muted mt-3 pt-3 border-t border-border/40 flex items-center gap-1 flex-wrap">
        À 40 km/h :{" "}
        <span className="text-text font-mono">{aeroShare.toFixed(0)}%</span> de
        la puissance vainc l'air, le reste le roulement.
        <InfoTooltip text="Part de la puissance qui va dans la traînée aérodynamique (le reste va dans la résistance au roulement). À basse vitesse la roue domine ; à haute vitesse l'air domine (loi en v² pour la force, v³ pour la puissance)." />
      </div>
    </Card>
  );
}
