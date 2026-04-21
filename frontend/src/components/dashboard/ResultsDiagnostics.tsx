import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Wind } from "lucide-react";
import type { AnalysisResult } from "../../types";
import { Button, Card } from "../ui";
import InfoTooltip from "../InfoTooltip";

interface Props {
  result: AnalysisResult;
  unreliable: boolean;
  badFit: boolean;
  onReanalyzeWithWind?: (manual_wind_ms: number, manual_wind_dir_deg: number) => void;
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
export function ResultsDiagnostics({ result, unreliable, badFit, onReanalyzeWithWind }: Props) {
  const showChungNote = result.solver_method === "chung_ve";
  const hasWindDiag =
    result.wind_fragility != null && result.wind_fragility !== "unknown";
  const hasAnyDiagnostic =
    unreliable ||
    badFit ||
    showChungNote ||
    hasPowerMeterWarning(result) ||
    hasWindDiag ||
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

      {hasWindDiag ? (
        <WindFragilityBanner
          result={result}
          onReanalyzeWithWind={onReanalyzeWithWind}
        />
      ) : (
        result.cda_delta_wind_plus_5pct != null && (
          <WindSensitivityBanner delta={result.cda_delta_wind_plus_5pct} />
        )
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
    <div className="bg-panel border border-border/60 rounded-lg px-4 py-2.5 text-xs flex items-center gap-3 flex-wrap">
      <span className="font-semibold text-muted uppercase tracking-wide">
        Sensibilité au vent
      </span>
      <span className="font-mono flex items-center gap-2">
        <span className="text-muted">+5% wind →</span>
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

function WindFragilityBanner({
  result,
  onReanalyzeWithWind,
}: {
  result: AnalysisResult;
  onReanalyzeWithWind?: (ms: number, dir: number) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const frag = result.wind_fragility ?? "unknown";
  const dPlus = result.cda_delta_wind_plus_30pct ?? 0;
  const dMinus = result.cda_delta_wind_minus_30pct ?? 0;
  const maxDelta = Math.max(Math.abs(dPlus), Math.abs(dMinus));
  const apiWs = result.avg_wind_speed_ms ?? 0;
  const apiDir = result.avg_wind_dir_deg ?? 0;

  const tone: "success" | "warn" | "danger" =
    frag === "robust" ? "success" : frag === "moderate" ? "warn" : "danger";
  const Icon = frag === "fragile" ? AlertCircle : frag === "moderate" ? AlertTriangle : CheckCircle2;
  const iconClass =
    frag === "fragile" ? "text-danger" : frag === "moderate" ? "text-warn" : "text-success";
  const title =
    frag === "robust"
      ? "Vent Open-Meteo cohérent avec les données (robuste)"
      : frag === "moderate"
        ? "Vent API peut-être imprécis (CdA modérément sensible)"
        : "Vent API probablement incorrect — CdA fragile";

  const body =
    frag === "fragile"
      ? "Sur cette sortie, faire varier le vent API de ±30% déplace le CdA estimé de plus de 0,05 m². C'est le signe d'une zone où Open-Meteo capture mal le vent réel (côte, relief, grille grossière). Saisis le vent mesuré pour fiabiliser l'analyse."
      : frag === "moderate"
        ? "Faire varier le vent API de ±30% déplace le CdA de 0,02 à 0,05 m². Sensibilité modérée — un vent mesuré améliorerait la précision."
        : "Faire varier le vent API de ±30% laisse le CdA quasi inchangé. Estimation robuste au vent.";

  return (
    <>
      <Card tone={tone} elevation={0} className="p-4 flex gap-3">
        <Icon className={`shrink-0 ${iconClass}`} size={20} aria-hidden />
        <div className="text-sm flex-1 min-w-0">
          <div className={`font-semibold ${iconClass} flex items-center gap-2`}>
            {title}
            <InfoTooltip text="Test de sensibilité : Chung VE relancé avec wind_speed × 1.30 et × 0.70 (bornes plausibles du biais ERA5 en zone côtière, Jourdier 2020). wind_fragility = max(|Δ±30%|) classé robust < 0,02 < moderate < 0,05 ≤ fragile." />
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted-strong">
            {body}
          </p>
          <div className="mt-2 text-[11px] font-mono text-muted space-y-0.5">
            <div>
              Δ CdA (vent ×1,30) = {dPlus >= 0 ? "+" : ""}
              {dPlus.toFixed(3)} m² &nbsp;|&nbsp; Δ CdA (vent ×0,70) = {dMinus >= 0 ? "+" : ""}
              {dMinus.toFixed(3)} m² &nbsp;(max |Δ| = {maxDelta.toFixed(3)})
            </div>
            <div>
              Vent API utilisé : {apiWs.toFixed(1)} m/s ({(apiWs * 3.6).toFixed(0)} km/h) depuis {Math.round(apiDir)}°
            </div>
          </div>
          {onReanalyzeWithWind && frag !== "robust" && (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Wind size={14} className="mr-1.5" aria-hidden />
                Corriger le vent
              </Button>
            </div>
          )}
        </div>
      </Card>
      {dialogOpen && onReanalyzeWithWind && (
        <ManualWindDialog
          apiWindMs={apiWs}
          apiWindDirDeg={apiDir}
          onCancel={() => setDialogOpen(false)}
          onSubmit={(ms, dir) => {
            setDialogOpen(false);
            onReanalyzeWithWind(ms, dir);
          }}
        />
      )}
    </>
  );
}

function ManualWindDialog({
  apiWindMs,
  apiWindDirDeg,
  onCancel,
  onSubmit,
}: {
  apiWindMs: number;
  apiWindDirDeg: number;
  onCancel: () => void;
  onSubmit: (ms: number, dirDeg: number) => void;
}) {
  const [kmh, setKmh] = useState<string>((apiWindMs * 3.6).toFixed(0));
  const [dir, setDir] = useState<string>(Math.round(apiWindDirDeg).toString());

  const kmhNum = parseFloat(kmh.replace(",", "."));
  const dirNum = parseFloat(dir.replace(",", "."));
  const valid =
    Number.isFinite(kmhNum) && kmhNum >= 0 && kmhNum <= 150 &&
    Number.isFinite(dirNum) && dirNum >= 0 && dirNum <= 360;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Corriger le vent"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-panel border border-border rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-1">Corriger le vent mesuré</h2>
        <p className="text-xs text-muted mb-4">
          Vent API : <span className="font-mono">{apiWindMs.toFixed(1)} m/s ({(apiWindMs * 3.6).toFixed(0)} km/h) depuis {Math.round(apiWindDirDeg)}°</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="manual-wind-kmh">
              Vitesse au sol (km/h)
            </label>
            <input
              id="manual-wind-kmh"
              type="number"
              inputMode="decimal"
              value={kmh}
              onChange={(e) => setKmh(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 font-mono text-sm"
              step={1}
              min={0}
              max={150}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="manual-wind-dir">
              Direction d'où il vient (°, 0=N, 90=E, 180=S, 270=O)
            </label>
            <input
              id="manual-wind-dir"
              type="number"
              inputMode="decimal"
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 font-mono text-sm"
              step={5}
              min={0}
              max={360}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted leading-snug">
          Renseigne le vent réel au niveau du cycliste (pas à 10 m). Exemples : stations Météo-France, Windy, Weatherflow Tempest, ou une estimation basée sur la sensation à vélo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!valid}
            onClick={() => onSubmit(kmhNum / 3.6, dirNum)}
          >
            Relancer l'analyse
          </Button>
        </div>
      </div>
    </div>
  );
}
