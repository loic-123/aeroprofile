import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AnalysisResult } from "../../types";
import { Card } from "../ui";
import InfoTooltip from "../InfoTooltip";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
  badFit: boolean;
}

/**
 * Aggregates every "how to interpret this ride" warning or note:
 *  - unreliable (R² < 0) hard-failure banner
 *  - badFit (R² < 0.3) warning banner
 *  - Chung VE solver note (when it takes over from wind_inverse)
 *  - Power meter banner (sensor class + calibration bias ratio)
 *  - Wind sensitivity diagnostic (Δ CdA if wind × 1.05)
 *
 * All diagnostics are optional; the component renders nothing if none
 * applies. When multiple fire, they're ordered by severity (hardest
 * failure first).
 */
export function ResultsDiagnostics({ result, unreliable, badFit }: Props) {
  const showChungNote = result.solver_method === "chung_ve";
  const hasAnyDiagnostic =
    unreliable ||
    badFit ||
    showChungNote ||
    hasPowerMeterWarning(result) ||
    result.cda_delta_wind_plus_5pct != null;

  if (!hasAnyDiagnostic) return null;

  return (
    <div className="space-y-3">
      {unreliable && (
        <Card tone="danger" elevation={0} className="p-4 flex gap-3">
          <AlertCircle className="text-danger shrink-0" size={20} aria-hidden />
          <div className="text-sm">
            <div className="font-semibold text-danger">
              CdA et Crr non estimables sur cette sortie (R² = {result.r_squared.toFixed(2)})
            </div>
            <p className="mt-1 text-muted-strong">
              Le modèle physique ne s'applique pas : il y a une ou plusieurs
              forces non prises en compte (vent réel très différent de la météo
              API, drafting massif, freins qui frottent, capteur défectueux…).{" "}
              <strong className="text-text">Les valeurs ci-dessous ne sont pas fiables</strong> —
              le solveur a trouvé le « moins mauvais » fit possible, pas une
              mesure correcte.
            </p>
            <p className="mt-2 text-muted-strong">
              Ce que vous pouvez quand même exploiter : le{" "}
              <strong className="text-text">breakdown plat / montée / descente</strong>{" "}
              ci-dessous (qui reste qualitativement parlant), et la{" "}
              <strong className="text-text">direction du biais des résidus</strong>{" "}
              dans les alertes (qui indique s'il faut chercher un capteur sur-
              ou sous-calibré).
            </p>
          </div>
        </Card>
      )}

      {!unreliable && badFit && (
        <Card tone="danger" elevation={0} className="p-4 flex gap-3">
          <AlertCircle className="text-danger shrink-0" size={20} aria-hidden />
          <div className="text-sm">
            <div className="font-semibold text-danger">
              Qualité d'ajustement faible (R² = {result.r_squared.toFixed(2)})
            </div>
            <p className="mt-1 text-muted-strong">
              Le modèle physique n'explique pas bien cette sortie. Causes
              probables : capteur de puissance mal calibré, altitude GPS très
              bruitée, beaucoup de drafting ou de freinages, ou sortie peu
              adaptée (vélo à assistance, cyclocross, VTT en sous-bois).{" "}
              <strong className="text-text">
                Les valeurs CdA et Crr sont à prendre avec beaucoup de
                précaution.
              </strong>
            </p>
          </div>
        </Card>
      )}

      {showChungNote && (
        <Card tone="info" elevation={0} className="p-3 text-sm">
          <div className="font-semibold text-info">
            Méthode : Chung (Virtual Elevation)
          </div>
          {result.solver_note && (
            <p className="mt-1 text-xs text-muted-strong">
              {result.solver_note}
            </p>
          )}
        </Card>
      )}

      <PowerMeterBanner result={result} />

      {result.cda_delta_wind_plus_5pct != null && (
        <WindSensitivityBanner delta={result.cda_delta_wind_plus_5pct} />
      )}
    </div>
  );
}

function hasPowerMeterWarning(result: AnalysisResult): boolean {
  const quality = result.power_meter_quality;
  const bias = result.power_bias_ratio;
  const biasN = result.power_bias_n_points ?? 0;
  const biasHighThresh = quality === "low" ? 1.15 : 1.35;
  const biasMildThresh = quality === "low" ? 1.08 : 1.2;
  const biasHigh = bias != null && biasN >= 60 && bias > biasHighThresh;
  const biasMild = bias != null && biasN >= 60 && bias > biasMildThresh && bias <= biasHighThresh;
  const biasLow = bias != null && biasN >= 60 && bias < 0.8;
  return (
    (quality != null && quality !== "high") || biasHigh || biasMild || biasLow
  );
}

function PowerMeterBanner({ result }: { result: AnalysisResult }) {
  const quality = result.power_meter_quality;
  const display = result.power_meter_display;
  const warning = result.power_meter_warning || "";
  const bias = result.power_bias_ratio;
  const biasN = result.power_bias_n_points ?? 0;

  const biasHighThresh = quality === "low" ? 1.15 : 1.35;
  const biasMildThresh = quality === "low" ? 1.08 : 1.2;
  const biasHigh = bias != null && biasN >= 60 && bias > biasHighThresh;
  const biasMild = bias != null && biasN >= 60 && bias > biasMildThresh && bias <= biasHighThresh;
  const biasLow = bias != null && biasN >= 60 && bias < 0.8;
  const biasAnomaly = biasHigh || biasLow;
  const hasWarning = (quality && quality !== "high") || biasAnomaly || biasMild;

  if (!hasWarning) {
    const parts: string[] = [];
    if (display && quality === "high") parts.push(`Capteur : ${display}`);
    if (bias != null && biasN >= 60)
      parts.push(`calibration OK (biais ×${bias.toFixed(2)})`);
    if (!parts.length) return null;
    return (
      <div className="text-[11px] text-muted font-mono flex items-center gap-1.5 opacity-80">
        <CheckCircle2 size={12} className="text-success" aria-hidden />
        {parts.join(" • ")}
      </div>
    );
  }

  const severity: "danger" | "warn" =
    quality === "low" || biasHigh ? "danger" : "warn";
  const iconClass = severity === "danger" ? "text-danger" : "text-warn";

  let biasMsg = "";
  if (biasHigh) {
    const pct = Math.round((bias! - 1) * 100);
    biasMsg =
      `**Capteur probablement mal calibré.** Sur les portions plates pédalées ` +
      `(${biasN} points), la puissance mesurée est ${pct}% plus haute que la ` +
      `valeur théorique pour un CdA/Crr typique. C'est le signe d'un capteur ` +
      `avec offset stuck ou d'un zero-offset manquant. Recalibrez avant la ` +
      `prochaine sortie.`;
  } else if (biasMild) {
    const pct = Math.round((bias! - 1) * 100);
    biasMsg =
      `Puissance mesurée ${pct}% au-dessus de la valeur théorique (${biasN} ` +
      `points plats). Peut indiquer une légère dérive de calibration, ou ` +
      `simplement un profil plus musclé que la moyenne.`;
  } else if (biasLow) {
    const pct = Math.round((1 - bias!) * 100);
    biasMsg =
      `Puissance mesurée ${pct}% sous la valeur théorique (${biasN} points ` +
      `plats). Capteur sous-estimé ou vent arrière important non modélisé.`;
  }

  const sensorWarn = quality && quality !== "high" ? warning : "";
  const render = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((s, i) =>
      s.startsWith("**") && s.endsWith("**") ? (
        <strong key={i}>{s.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{s}</span>
      ),
    );

  return (
    <Card tone={severity} elevation={0} className="p-4 flex gap-3">
      {severity === "danger" ? (
        <AlertCircle className={`shrink-0 ${iconClass}`} size={20} aria-hidden />
      ) : (
        <AlertTriangle className={`shrink-0 ${iconClass}`} size={20} aria-hidden />
      )}
      <div className="text-sm flex-1 min-w-0">
        <div className={`font-semibold ${iconClass}`}>
          Capteur de puissance : {display ?? "inconnu"}
          {bias != null && biasN >= 60 && (
            <span className="ml-2 text-[11px] font-mono opacity-80">
              biais ×{bias.toFixed(2)}
            </span>
          )}
        </div>
        {sensorWarn && (
          <p className="mt-1 text-[13px] leading-snug text-muted-strong">
            {render(sensorWarn)}
          </p>
        )}
        {biasMsg && (
          <p className={`${sensorWarn ? "mt-2" : "mt-1"} text-[13px] leading-snug text-muted-strong`}>
            {render(biasMsg)}
          </p>
        )}
      </div>
    </Card>
  );
}

function WindSensitivityBanner({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  const tone: "primary" | "warn" | "danger" =
    abs < 0.005 ? "primary" : abs < 0.015 ? "warn" : "danger";
  const toneText =
    tone === "primary" ? "text-success" : tone === "warn" ? "text-warn" : "text-danger";
  const label =
    tone === "primary" ? "robuste" : tone === "warn" ? "modérément sensible" : "fragile";

  return (
    <div className="bg-panel border border-border/60 rounded px-4 py-3 text-xs flex items-center gap-3 flex-wrap">
      <span className="font-serif italic text-primary/90 text-lg leading-none">
        Sensibilité au vent
      </span>
      <span className="font-mono flex items-center gap-2">
        <span className="text-muted">+5 % →</span>
        <span className={toneText}>
          Δ CdA = {delta >= 0 ? "+" : ""}
          {delta.toFixed(3)} m²
        </span>
        <span className={`text-[10px] uppercase tracking-wider ${toneText} opacity-80`}>
          ({label})
        </span>
      </span>
      <InfoTooltip text="Post-hoc : Chung VE relancé avec wind_speed × 1.05. Le Δ exposé montre si le CdA est robuste (|Δ|<0.005, vert), modéré (<0.015, ambre) ou fragile (rouge) au biais vent Open-Meteo. ERA5 a un biais documenté de ~−0.7% sur la moyenne et sous-estime les vents forts (Jourdier 2020). Remplace une correction aveugle par un diagnostic transparent." />
    </div>
  );
}
