import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
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
  const { t } = useTranslation();
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
              {t("diag.unreliableTitle", { r2: result.r_squared.toFixed(2) })}
            </div>
            <p className="mt-1 text-muted-strong">
              <Trans
                i18nKey="diag.unreliableBody1"
                components={{ strong: <strong className="text-text" /> }}
              />
            </p>
            <p className="mt-2 text-muted-strong">
              <Trans
                i18nKey="diag.unreliableBody2"
                components={{ strong: <strong className="text-text" /> }}
              />
            </p>
          </div>
        </Card>
      )}

      {!unreliable && badFit && (
        <Card tone="danger" elevation={0} className="p-4 flex gap-3">
          <AlertCircle className="text-danger shrink-0" size={20} aria-hidden />
          <div className="text-sm">
            <div className="font-semibold text-danger">
              {t("diag.badFitTitle", { r2: result.r_squared.toFixed(2) })}
            </div>
            <p className="mt-1 text-muted-strong">
              <Trans
                i18nKey="diag.badFitBody"
                components={{ strong: <strong className="text-text" /> }}
              />
            </p>
          </div>
        </Card>
      )}

      {showChungNote && (
        <Card tone="info" elevation={0} className="p-3 text-sm">
          <div className="font-semibold text-info">
            {t("diag.chungTitle")}
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
  const { t } = useTranslation();
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
    if (display && quality === "high") parts.push(t("diag.pmOkLabel", { display }));
    if (bias != null && biasN >= 60)
      parts.push(t("diag.pmCalibOk", { value: bias.toFixed(2) }));
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
    biasMsg = t("diag.pmBiasHigh", { n: biasN, pct });
  } else if (biasMild) {
    const pct = Math.round((bias! - 1) * 100);
    biasMsg = t("diag.pmBiasMild", { n: biasN, pct });
  } else if (biasLow) {
    const pct = Math.round((1 - bias!) * 100);
    biasMsg = t("diag.pmBiasLow", { n: biasN, pct });
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
          {t("diag.pmBanner", { display: display ?? t("diag.pmUnknown") })}
          {bias != null && biasN >= 60 && (
            <span className="ml-2 text-[11px] font-mono opacity-80">
              {t("diag.pmBiasBadge", { value: bias.toFixed(2) })}
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
  const { t } = useTranslation();
  const abs = Math.abs(delta);
  const tone: "primary" | "warn" | "danger" =
    abs < 0.005 ? "primary" : abs < 0.015 ? "warn" : "danger";
  const toneText =
    tone === "primary" ? "text-success" : tone === "warn" ? "text-warn" : "text-danger";
  const label =
    tone === "primary" ? t("diag.windSensRobust") : tone === "warn" ? t("diag.windSensModerate") : t("diag.windSensFragile");

  return (
    <div className="bg-panel border border-border/60 rounded-lg px-4 py-2.5 text-xs flex items-center gap-3 flex-wrap">
      <span className="font-semibold text-muted uppercase tracking-wide">
        {t("diag.windSensTitle")}
      </span>
      <span className="font-mono flex items-center gap-2">
        <span className="text-muted">{t("diag.windSensArrow")}</span>
        <span className={toneText}>
          Δ CdA = {delta >= 0 ? "+" : ""}
          {delta.toFixed(3)} m²
        </span>
        <span className={`text-[10px] uppercase tracking-wider ${toneText} opacity-80`}>
          ({label})
        </span>
      </span>
      <InfoTooltip text={t("diag.windSensTooltip")} />
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
  const { t } = useTranslation();
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
      ? t("diag.windRobust")
      : frag === "moderate"
        ? t("diag.windModerate")
        : t("diag.windFragile");

  const body =
    frag === "fragile"
      ? t("diag.windBodyFragile")
      : frag === "moderate"
        ? t("diag.windBodyModerate")
        : t("diag.windBodyRobust");

  return (
    <>
      <Card tone={tone} elevation={0} className="p-4 flex gap-3">
        <Icon className={`shrink-0 ${iconClass}`} size={20} aria-hidden />
        <div className="text-sm flex-1 min-w-0">
          <div className={`font-semibold ${iconClass} flex items-center gap-2`}>
            {title}
            <InfoTooltip text={t("diag.windFragilityTooltip")} />
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
              {t("diag.windApiSummary", { ms: apiWs.toFixed(1), kmh: (apiWs * 3.6).toFixed(0), dir: Math.round(apiDir) })}
            </div>
          </div>
          {onReanalyzeWithWind && frag !== "robust" && (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Wind size={14} aria-hidden />}
                onClick={() => setDialogOpen(true)}
              >
                {t("diag.windCorrect")}
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
  const { t } = useTranslation();
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
      aria-label={t("diag.windCorrect")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-panel border border-border rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-1">{t("diag.windCorrectDialogTitle")}</h2>
        <p className="text-xs text-muted mb-4 font-mono">
          {t("diag.windApiSummary", { ms: apiWindMs.toFixed(1), kmh: (apiWindMs * 3.6).toFixed(0), dir: Math.round(apiWindDirDeg) })}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="manual-wind-kmh">
              {t("diag.manualWindKmh")}
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
              {t("diag.manualWindDir")}
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
          {t("diag.manualWindHelp")}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            {t("diag.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!valid}
            onClick={() => onSubmit(kmhNum / 3.6, dirNum)}
          >
            {t("diag.rerun")}
          </Button>
        </div>
      </div>
    </div>
  );
}
