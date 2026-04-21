/**
 * What-If Simulator: vary one parameter on a real ride and see the impact.
 *
 * 6 combinations:
 *  - Vary CdA, power fixed → new speed
 *  - Vary CdA, speed fixed → new power needed
 *  - Vary power, CdA fixed → new speed
 *  - Vary power, speed fixed → new CdA equivalent
 *  - Vary speed, power fixed → new power needed
 *  - Vary speed, CdA fixed → new power needed (same as above)
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
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
import type { AnalysisResult } from "../types";
import InfoTooltip from "./InfoTooltip";

const G = 9.80665;
const ETA = 0.977;

/** Solve for V given P, CdA, Crr, rho, mass, gradient (no wind). */
function solveSpeed(
  power: number, cda: number, crr: number, rho: number,
  mass: number, gradient: number, vGuess: number,
): number {
  const ct = Math.cos(Math.atan(gradient));
  const st = Math.sin(Math.atan(gradient));
  let v = Math.max(vGuess, 0.5);
  for (let i = 0; i < 30; i++) {
    const f = 0.5 * cda * rho * v * v * v + crr * mass * G * ct * v + mass * G * st * v - power * ETA;
    const df = 1.5 * cda * rho * v * v + crr * mass * G * ct + mass * G * st;
    if (Math.abs(df) < 1e-9) break;
    v = Math.max(v - f / df, 0.01);
    if (Math.abs(f) < 0.1) break;
  }
  return v;
}

/** Compute power required at given speed. */
function computePower(
  v: number, cda: number, crr: number, rho: number,
  mass: number, gradient: number,
): number {
  if (v <= 0) return 0;
  const ct = Math.cos(Math.atan(gradient));
  const st = Math.sin(Math.atan(gradient));
  return (0.5 * cda * rho * v * v * v + crr * mass * G * ct * v + mass * G * st * v) / ETA;
}

type VaryParam = "cda" | "power" | "speed";
type FixedParam = "power" | "speed";
type PowerProfile = "real" | "smooth";

export default function WhatIfSimulator({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const [vary, setVary] = useState<VaryParam>("cda");
  const [fixed, setFixed] = useState<FixedParam>("power");
  const [powerProfile, setPowerProfile] = useState<PowerProfile>("real");
  const [cdaDelta, setCdaDelta] = useState(0);
  const [powerDelta, setPowerDelta] = useState(0);
  const [speedDelta, setSpeedDelta] = useState(0);

  const profile = result.profile;
  const baseCda = result.cda;
  const baseCrr = result.crr;
  const n = profile.distance_km.length;
  const avgPower = result.avg_power_w;
  const avgRho = result.avg_rho;
  const totalTime = result.ride_duration_s;
  const avgDt = totalTime / Math.max(n, 1);
  const mass = 76; // cancels in relative comparison

  // What fixed options make sense for each vary param
  const fixedOptions: Record<VaryParam, { id: FixedParam; label: string }[]> = {
    cda:   [{ id: "power", label: t("whatIf.fix.powerImpactSpeed") },
            { id: "speed", label: t("whatIf.fix.speedImpactPower") }],
    power: [{ id: "power", label: t("whatIf.fix.cdaImpactSpeed") },
            { id: "speed", label: t("whatIf.fix.speedEqCda") }],
    speed: [{ id: "power", label: t("whatIf.fix.powerRequiredPower") },
            { id: "speed", label: t("whatIf.fix.cdaRequiredPower") }],
  };

  const resetSliders = () => { setCdaDelta(0); setPowerDelta(0); setSpeedDelta(0); };

  const simData = useMemo(() => {
    if (n < 10) return [];

    const dist = profile.distance_km;
    const pMeasured = profile.power_measured;
    const altReal = profile.altitude_real;
    const rhoArr = profile.rho;

    const gradients: number[] = [0];
    for (let i = 1; i < n; i++) {
      const dd = (dist[i] - dist[i - 1]) * 1000;
      if (dd > 0.1) {
        const dh = (altReal[i] || 0) - (altReal[i - 1] || 0);
        gradients.push(Math.max(-0.25, Math.min(0.25, dh / dd)));
      } else {
        gradients.push(gradients[i - 1] || 0);
      }
    }

    // Compute raw speeds from distance deltas, then calibrate so the
    // average matches the known avg_speed_kmh from the analysis result.
    const rawSpeeds: number[] = [1];
    for (let i = 1; i < n; i++) {
      const dd = (dist[i] - dist[i - 1]) * 1000;
      rawSpeeds.push(Math.max(dd / avgDt, 0.01));
    }
    const rawAvg = rawSpeeds.reduce((s, v) => s + v, 0) / rawSpeeds.length;
    const targetAvg = result.avg_speed_kmh / 3.6;
    const calibFactor = rawAvg > 0.1 ? targetAvg / rawAvg : 1;
    const groundSpeeds = rawSpeeds.map((v) => v * calibFactor);

    const output: { d: number; vReal: number; vSim: number; pReal: number; pSim: number; cdaSim: number; cdaValid: boolean }[] = [];

    for (let i = 1; i < n; i++) {
      const d = dist[i];
      const rho = rhoArr[i] || avgRho;
      const grad = gradients[i];
      const vGround = groundSpeeds[i];
      const pRaw = powerProfile === "smooth" ? avgPower : (pMeasured[i] || avgPower);

      // Baseline: solve V from real P and real CdA (model-consistent baseline)
      const vBase = solveSpeed(pRaw, baseCda, baseCrr, rho, mass, grad, vGround);

      let vSim = vBase;
      let pSim = pRaw;
      let cdaEq = baseCda;
      let cdaValid = false;

      if (vary === "cda") {
        const newCda = baseCda + cdaDelta;
        if (fixed === "power") {
          vSim = solveSpeed(pRaw, newCda, baseCrr, rho, mass, grad, vBase);
          pSim = pRaw;
        } else {
          vSim = vBase;
          pSim = computePower(vGround, newCda, baseCrr, rho, mass, grad);
        }
      } else if (vary === "power") {
        const newP = pRaw * (1 + powerDelta / 100);
        if (fixed === "power") {
          // CdA fixed, power changes → new speed
          vSim = solveSpeed(newP, baseCda, baseCrr, rho, mass, grad, vBase);
          pSim = newP;
        } else {
          // Speed fixed, power changes → equivalent CdA
          // Only meaningful on flat + fast + pedalling segments where aero dominates
          vSim = vBase;
          pSim = newP;
          const isFlatFast = Math.abs(grad) < 0.02 && vGround > 8 && pRaw > 100;
          if (isFlatFast && vGround > 0.5) {
            const ct = Math.cos(Math.atan(grad));
            const st = Math.sin(Math.atan(grad));
            const pNonAero = baseCrr * mass * G * ct * vGround + mass * G * st * vGround;
            const den = 0.5 * rho * vGround * vGround * vGround;
            if (den > 1) {
              const eq = (newP * ETA - pNonAero) / den;
              if (eq > 0.05 && eq < 0.8) {
                cdaEq = eq;
                cdaValid = true;
              }
            }
          }
        }
      } else {
        const newV = vBase + speedDelta / 3.6;
        vSim = Math.max(newV, 0.01);
        pSim = computePower(vSim, baseCda, baseCrr, rho, mass, grad);
      }

      // Use RATIO method: vSim/vBase applied to real GPS speed
      // This way vReal matches the actual ride, and vSim is the delta
      const ratio = vBase > 0.1 ? vSim / vBase : 1;
      const vRealKmh = vGround * 3.6;
      const vSimKmh = vRealKmh * ratio;

      output.push({
        d,
        vReal: vRealKmh,
        vSim: Math.max(vSimKmh, 0),
        pReal: pRaw,
        pSim: Math.max(pSim, 0),
        cdaSim: cdaEq,
        cdaValid,
      });
    }

    return output;
  }, [n, vary, fixed, cdaDelta, powerDelta, speedDelta, powerProfile, baseCda, baseCrr, avgPower, avgRho, avgDt, mass, profile, result]);

  // Summary
  const summary = useMemo(() => {
    if (simData.length === 0) return null;
    const avgVReal = simData.reduce((s, d) => s + d.vReal, 0) / simData.length;
    const avgVSim = simData.reduce((s, d) => s + d.vSim, 0) / simData.length;
    const avgPReal = simData.reduce((s, d) => s + d.pReal, 0) / simData.length;
    const avgPSim = simData.reduce((s, d) => s + d.pSim, 0) / simData.length;

    let timeReal = 0, timeSim = 0;
    for (const pt of simData) {
      timeReal += avgDt;
      timeSim += pt.vSim > 0.1 ? (pt.vReal / pt.vSim) * avgDt : avgDt;
    }

    const validCda = simData.filter((d) => d.cdaValid);
    const avgCdaSim = validCda.length > 0
      ? validCda.reduce((s, d) => s + d.cdaSim, 0) / validCda.length
      : baseCda;

    return { avgVReal, avgVSim, deltaV: avgVSim - avgVReal,
             avgPReal, avgPSim, deltaP: avgPSim - avgPReal,
             avgCdaSim, deltaCda: avgCdaSim - baseCda,
             timeReal, timeSim, deltaTime: timeSim - timeReal };
  }, [simData, avgDt, baseCda]);

  const fmtTime = (s: number) => {
    const abs = Math.abs(s);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const sec = Math.floor(abs % 60);
    const sign = s < 0 ? "-" : "+";
    return h > 0 ? `${sign}${h}h${m.toString().padStart(2, "0")}m${sec.toString().padStart(2, "0")}s`
      : `${sign}${m}m${sec.toString().padStart(2, "0")}s`;
  };

  const chartData = useMemo(() => {
    if (simData.length <= 500) return simData;
    const step = Math.ceil(simData.length / 500);
    return simData.filter((_, i) => i % step === 0);
  }, [simData]);

  // Decide what to show in chart: V or P
  const showPowerChart = (vary === "cda" && fixed === "speed") ||
                          (vary === "speed") ||
                          (vary === "power" && fixed === "speed");

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-teal" />
        {t("whatIf.title")}
        <InfoTooltip text="Faites varier un paramètre et voyez l'impact sur la sortie. Le modèle recalcule point par point avec l'équation de Martin, en gardant parcours et météo identiques." />
      </h3>

      {/* Vary selector */}
      <div className="flex gap-1">
        {([
          { id: "cda" as VaryParam, label: t("whatIf.varyCda") },
          { id: "power" as VaryParam, label: t("whatIf.varyPower") },
          { id: "speed" as VaryParam, label: t("whatIf.varySpeed") },
        ]).map((m) => (
          <button key={m.id}
            onClick={() => { setVary(m.id); setFixed(fixedOptions[m.id][0].id); resetSliders(); }}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              vary === m.id ? "bg-teal text-white font-semibold" : "bg-bg border border-border text-muted hover:text-text"
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Fixed param selector */}
      <div className="flex gap-1">
        {fixedOptions[vary].map((opt) => (
          <button key={opt.id}
            onClick={() => setFixed(opt.id)}
            className={`flex-1 px-2 py-1 text-[11px] rounded transition ${
              fixed === opt.id ? "bg-info/20 text-info font-semibold border border-info/30" : "bg-bg border border-border text-muted hover:text-text"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Power profile (only when power is an input, not output) */}
      {!(vary === "cda" && fixed === "speed") && vary !== "speed" && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted">{t("whatIf.powerProfile")}</span>
          <button onClick={() => setPowerProfile("real")}
            className={`px-2 py-1 rounded ${powerProfile === "real" ? "bg-info/20 text-info font-semibold" : "text-muted"}`}>
            {t("whatIf.powerReal")}
          </button>
          <button onClick={() => setPowerProfile("smooth")}
            className={`px-2 py-1 rounded ${powerProfile === "smooth" ? "bg-info/20 text-info font-semibold" : "text-muted"}`}>
            {t("whatIf.powerSmooth")}
          </button>
        </div>
      )}

      {/* Slider */}
      <div>
        {vary === "cda" && (
          <>
            <label className="block text-xs text-muted mb-1">
              {t("whatIf.sliderCda")} <span className="text-teal font-mono font-semibold">{(baseCda + cdaDelta).toFixed(3)} m²</span>
              <span className="ml-2">{t("whatIf.sliderCdaDelta", { delta: (cdaDelta >= 0 ? "+" : "") + cdaDelta.toFixed(3), base: baseCda.toFixed(3) })}</span>
            </label>
            <input type="range" min={-0.25} max={0.25} step={0.005} value={cdaDelta}
              onChange={(e) => setCdaDelta(parseFloat(e.target.value))} className="w-full accent-teal" />
            <div className="flex justify-between text-[10px] text-muted">
              <span>{Math.max(baseCda - 0.25, 0.05).toFixed(2)}</span>
              <span className="text-teal cursor-pointer" onClick={() => setCdaDelta(0)}>{t("whatIf.current")}</span>
              <span>{(baseCda + 0.25).toFixed(2)}</span>
            </div>
          </>
        )}
        {vary === "power" && (
          <>
            <label className="block text-xs text-muted mb-1">
              {t("whatIf.sliderPower")} <span className="text-teal font-mono font-semibold">{powerDelta >= 0 ? "+" : ""}{powerDelta}%</span>
              <span className="ml-2">{t("whatIf.sliderPowerDelta", { newW: (avgPower * (1 + powerDelta / 100)).toFixed(0), baseW: avgPower.toFixed(0) })}</span>
            </label>
            <input type="range" min={-50} max={50} step={1} value={powerDelta}
              onChange={(e) => setPowerDelta(parseInt(e.target.value))} className="w-full accent-teal" />
            <div className="flex justify-between text-[10px] text-muted">
              <span>-50%</span>
              <span className="text-teal cursor-pointer" onClick={() => setPowerDelta(0)}>{t("whatIf.current")}</span>
              <span>+50%</span>
            </div>
          </>
        )}
        {vary === "speed" && (
          <>
            <label className="block text-xs text-muted mb-1">
              {t("whatIf.sliderSpeed")} <span className="text-teal font-mono font-semibold">{speedDelta >= 0 ? "+" : ""}{speedDelta.toFixed(1)} km/h</span>
              <span className="ml-2">{t("whatIf.sliderSpeedDelta", { newKmh: (result.avg_speed_kmh + speedDelta).toFixed(1), baseKmh: result.avg_speed_kmh.toFixed(1) })}</span>
            </label>
            <input type="range" min={-15} max={15} step={0.5} value={speedDelta}
              onChange={(e) => setSpeedDelta(parseFloat(e.target.value))} className="w-full accent-teal" />
            <div className="flex justify-between text-[10px] text-muted">
              <span>-15 km/h</span>
              <span className="text-teal cursor-pointer" onClick={() => setSpeedDelta(0)}>{t("whatIf.current")}</span>
              <span>+15 km/h</span>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-bg rounded p-2">
            <div className="text-[10px] text-muted uppercase">{t("whatIf.avgSpeed")}</div>
            <div className="font-mono text-sm">
              <span className="text-muted">{summary.avgVReal.toFixed(1)}</span>
              <span className="mx-1">→</span>
              <span className="text-teal font-semibold">{summary.avgVSim.toFixed(1)}</span>
              <span className="text-xs text-muted"> km/h</span>
            </div>
            <div className={`text-xs font-mono ${summary.deltaV > 0.05 ? "text-emerald-400" : summary.deltaV < -0.05 ? "text-coral" : "text-muted"}`}>
              {summary.deltaV >= 0 ? "+" : ""}{summary.deltaV.toFixed(1)} km/h
            </div>
          </div>
          <div className="bg-bg rounded p-2">
            {vary === "power" && fixed === "speed" ? (
              <>
                <div className="text-[10px] text-muted uppercase">{t("whatIf.equivCda")}</div>
                <div className="font-mono text-sm">
                  <span className="text-muted">{baseCda.toFixed(3)}</span>
                  <span className="mx-1">→</span>
                  <span className="text-teal font-semibold">{summary.avgCdaSim.toFixed(3)}</span>
                  <span className="text-xs text-muted"> m²</span>
                </div>
                <div className={`text-xs font-mono ${summary.deltaCda < -0.001 ? "text-emerald-400" : summary.deltaCda > 0.001 ? "text-coral" : "text-muted"}`}>
                  {summary.deltaCda >= 0 ? "+" : ""}{summary.deltaCda.toFixed(3)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-muted uppercase">{t("whatIf.avgPower")}</div>
                <div className="font-mono text-sm">
                  <span className="text-muted">{summary.avgPReal.toFixed(0)}</span>
                  <span className="mx-1">→</span>
                  <span className="text-teal font-semibold">{summary.avgPSim.toFixed(0)}</span>
                  <span className="text-xs text-muted"> W</span>
                </div>
                <div className={`text-xs font-mono ${summary.deltaP < -0.5 ? "text-emerald-400" : summary.deltaP > 0.5 ? "text-coral" : "text-muted"}`}>
                  {summary.deltaP >= 0 ? "+" : ""}{summary.deltaP.toFixed(0)} W
                </div>
              </>
            )}
          </div>
          <div className="bg-bg rounded p-2">
            <div className="text-[10px] text-muted uppercase">{t("whatIf.estimatedTime")}</div>
            <div className="font-mono text-sm">
              <span className={summary.deltaTime < -1 ? "text-emerald-400 font-semibold" : summary.deltaTime > 1 ? "text-coral font-semibold" : "text-muted"}>
                {fmtTime(summary.deltaTime)}
              </span>
            </div>
            <div className="text-xs text-muted">{t("whatIf.over", { km: profile.distance_km[n - 1].toFixed(0) })}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 10 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#262633" />
            <XAxis dataKey="d" stroke="#8b8ba0" fontSize={10} unit=" km" />
            <YAxis stroke="#8b8ba0" fontSize={10} unit={showPowerChart ? " W" : " km/h"} />
            <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} formatter={(v: number) => typeof v === "number" ? v.toFixed(1) : v} />
            <Legend />
            {showPowerChart ? (
              <>
                <Line type="monotone" dataKey="pReal" stroke="#8b8ba0" dot={false} name={t("whatIf.legendPReal")} strokeWidth={1} />
                <Line type="monotone" dataKey="pSim" stroke="#1D9E75" dot={false} name={t("whatIf.legendPSim")} strokeWidth={2} />
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="vReal" stroke="#8b8ba0" dot={false} name={t("whatIf.legendVReal")} strokeWidth={1} />
                <Line type="monotone" dataKey="vSim" stroke="#1D9E75" dot={false} name={t("whatIf.legendVSim")} strokeWidth={2} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

    </div>
  );
}
