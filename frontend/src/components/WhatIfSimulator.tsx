/**
 * What-If Simulator: vary one parameter on a real ride and see the impact.
 *
 * Modes:
 *  - Vary CdA → see new speed (at same power) or new power (at same speed)
 *  - Vary power (±%) → see new speed
 *  - Vary speed (±km/h) → see new power required
 *
 * Two power profiles:
 *  - "Réel" = keep the actual power profile (intervals, sprints, etc.)
 *  - "Lissé" = use constant power = average
 */

import { useState, useMemo } from "react";
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
const I_EFF = 0.14; // wheel inertia effective mass

/**
 * Given all forces except aero, solve for velocity that balances power.
 * P * eta = 0.5 * CdA * rho * V_air^2 * V + Crr * m * g * V + m * g * grad * V
 * With V_air ≈ V + headwind, this is a cubic in V. We use Newton's method.
 */
function solveSpeed(
  power: number,
  cda: number,
  crr: number,
  rho: number,
  mass: number,
  gradient: number,
  headwind: number,
  vGuess: number,
): number {
  let v = Math.max(vGuess, 1.0);
  for (let iter = 0; iter < 20; iter++) {
    const va = v + headwind;
    if (va <= 0) { v = Math.max(v * 0.5, 0.5); continue; }
    const pAero = 0.5 * cda * rho * va * va * v;
    const pRoll = crr * mass * G * Math.cos(Math.atan(gradient)) * v;
    const pGrav = mass * G * Math.sin(Math.atan(gradient)) * v;
    const pTotal = pAero + pRoll + pGrav;
    const target = power * ETA;
    const residual = pTotal - target;

    // Derivative dP/dV
    const dpAero = 0.5 * cda * rho * (3 * va * va - 2 * va * headwind);
    // simplified: d/dV[0.5*cda*rho*(v+hw)^2*v] = 0.5*cda*rho*(3v^2+4v*hw+hw^2)
    const dpAerodV = 0.5 * cda * rho * (3 * v * v + 4 * v * headwind + headwind * headwind);
    const dpRolldV = crr * mass * G * Math.cos(Math.atan(gradient));
    const dpGravdV = mass * G * Math.sin(Math.atan(gradient));
    const dpdv = dpAerodV + dpRolldV + dpGravdV;

    if (Math.abs(dpdv) < 1e-6) break;
    const step = residual / dpdv;
    v = Math.max(v - step, 0.1);
    if (Math.abs(residual) < 0.01) break;
  }
  return v;
}

/**
 * Given velocity, compute power required.
 */
function computePower(
  v: number,
  cda: number,
  crr: number,
  rho: number,
  mass: number,
  gradient: number,
  headwind: number,
): number {
  const va = v + headwind;
  if (va <= 0 || v <= 0) return 0;
  const pAero = 0.5 * cda * rho * va * va * v;
  const pRoll = crr * mass * G * Math.cos(Math.atan(gradient)) * v;
  const pGrav = mass * G * Math.sin(Math.atan(gradient)) * v;
  return (pAero + pRoll + pGrav) / ETA;
}

type SimMode = "cda" | "power" | "speed";
type PowerProfile = "real" | "smooth";

export default function WhatIfSimulator({ result }: { result: AnalysisResult }) {
  const [mode, setMode] = useState<SimMode>("cda");
  const [powerProfile, setPowerProfile] = useState<PowerProfile>("real");
  const [cdaDelta, setCdaDelta] = useState(0); // absolute delta
  const [powerDelta, setPowerDelta] = useState(0); // percentage
  const [speedDelta, setSpeedDelta] = useState(0); // km/h

  const profile = result.profile;
  const baseCda = result.cda;
  const baseCrr = result.crr;
  const n = profile.distance_km.length;

  // Compute headwind per point from wind data + rider bearing
  // We don't have bearing in ProfileData, but we have wind_speed and the
  // original v_air vs v_ground relationship. Approximate headwind as:
  // headwind ≈ v_air - v_ground (from the original analysis)
  const avgPower = result.avg_power_w;
  const avgRho = result.avg_rho;

  const simData = useMemo(() => {
    if (n < 10) return [];

    const dist = profile.distance_km;
    const pMeasured = profile.power_measured;
    const vReal = dist.map((_, i) => {
      // Estimate ground speed from distance differences
      if (i === 0) return 0;
      const dd = (dist[i] - dist[i - 1]) * 1000; // meters
      // We don't have dt per point in ProfileData, assume 1s sampling
      return Math.max(dd, 0);
    });

    // Better approach: use power_modeled and power_measured to infer
    // actual conditions. We have rho, gradient can be estimated from altitude.

    const altReal = profile.altitude_real;
    const rhoArr = profile.rho;
    const windSpeed = profile.wind_speed_ms;

    // Estimate gradient from altitude
    const gradients: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0 || dist[i] === dist[i - 1]) {
        gradients.push(0);
      } else {
        const dh = (altReal[i] || 0) - (altReal[i - 1] || 0);
        const dd = (dist[i] - dist[i - 1]) * 1000;
        gradients.push(dd > 0 ? Math.max(-0.25, Math.min(0.25, dh / dd)) : 0);
      }
    }

    // Estimate ground speed from distance (assume 1s intervals, downsampled)
    // The profile is downsampled to max 5000 points, so dt varies
    const totalDist = dist[n - 1] - dist[0]; // km
    const totalTime = result.ride_duration_s;
    const avgDt = totalTime / n; // seconds per sample

    const groundSpeeds: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        groundSpeeds.push(result.avg_speed_kmh / 3.6);
      } else {
        const dd = (dist[i] - dist[i - 1]) * 1000;
        const v = dd / avgDt;
        groundSpeeds.push(Math.max(v, 0.1));
      }
    }

    // Headwind estimate: use wind_speed as approximate headwind component
    // (rough — we don't have bearing in the profile, but it's the best we can do)
    // Actually, we can compute it from P_measured and the model:
    // P*eta = 0.5*CdA*rho*Va²*V + Crr*m*g*V + m*g*grad*V
    // Va = V + headwind → headwind = Va - V
    // But we don't have Va directly. Use wind_speed * cos(angle) ≈ 0 on average
    // Simplification: headwind = 0 for the simulation (relative comparison still valid)

    const simCda = baseCda + (mode === "cda" ? cdaDelta : 0);
    const simCrr = baseCrr;

    // Build output data
    const output: { d: number; vReal: number; vSim: number; pReal: number; pSim: number }[] = [];

    for (let i = 1; i < n; i++) {
      const d = dist[i];
      const rho = rhoArr[i] || avgRho;
      const grad = gradients[i];
      const vGround = groundSpeeds[i];
      const headwind = 0; // simplified

      const pReal = powerProfile === "smooth" ? avgPower : (pMeasured[i] || avgPower);
      let pSim = pReal;
      let vSim = vGround;

      if (mode === "cda") {
        // Same power, new CdA → what speed?
        vSim = solveSpeed(pReal, simCda, baseCrr, rho, result.avg_speed_kmh > 0 ? 76 : 76, grad, headwind, vGround);
      } else if (mode === "power") {
        // Power changed by powerDelta %
        pSim = pReal * (1 + powerDelta / 100);
        vSim = solveSpeed(pSim, baseCda, baseCrr, rho, 76, grad, headwind, vGround);
      } else if (mode === "speed") {
        // Speed changed → what power needed?
        vSim = vGround + speedDelta / 3.6;
        if (vSim > 0) {
          pSim = computePower(vSim, baseCda, baseCrr, rho, 76, grad, headwind);
        }
      }

      output.push({
        d,
        vReal: vGround * 3.6,
        vSim: Math.max(vSim, 0) * 3.6,
        pReal,
        pSim: Math.max(pSim, 0),
      });
    }

    return output;
  }, [n, mode, cdaDelta, powerDelta, speedDelta, powerProfile, baseCda, baseCrr, avgPower, avgRho, profile, result]);

  // Summary stats
  const summary = useMemo(() => {
    if (simData.length === 0) return null;
    const avgVReal = simData.reduce((s, d) => s + d.vReal, 0) / simData.length;
    const avgVSim = simData.reduce((s, d) => s + d.vSim, 0) / simData.length;
    const avgPReal = simData.reduce((s, d) => s + d.pReal, 0) / simData.length;
    const avgPSim = simData.reduce((s, d) => s + d.pSim, 0) / simData.length;

    const totalDistKm = profile.distance_km[n - 1] - profile.distance_km[0];
    const timeReal = result.ride_duration_s;
    const timeSim = avgVSim > 0 ? (totalDistKm / (avgVSim / 3.6)) * 1000 : timeReal;

    return {
      avgVReal, avgVSim, deltaV: avgVSim - avgVReal,
      avgPReal, avgPSim, deltaP: avgPSim - avgPReal,
      timeReal, timeSim, deltaTime: timeSim - timeReal,
    };
  }, [simData, n, profile, result]);

  const fmtTime = (s: number) => {
    const h = Math.floor(Math.abs(s) / 3600);
    const m = Math.floor((Math.abs(s) % 3600) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    const sign = s < 0 ? "-" : "+";
    return h > 0 ? `${sign}${h}h${m.toString().padStart(2, "0")}m${sec.toString().padStart(2, "0")}s`
      : `${sign}${m}m${sec.toString().padStart(2, "0")}s`;
  };

  // Downsample for chart
  const chartData = useMemo(() => {
    if (simData.length <= 500) return simData;
    const step = Math.ceil(simData.length / 500);
    return simData.filter((_, i) => i % step === 0);
  }, [simData]);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-teal" />
        Simulateur What-If
        <InfoTooltip text="Faites varier un paramètre et voyez l'impact sur votre sortie. Les autres paramètres (météo, parcours, masse) restent identiques à la sortie réelle." />
      </h3>

      {/* Mode selector */}
      <div className="flex gap-1">
        {([
          { id: "cda" as SimMode, label: "Varier le CdA" },
          { id: "power" as SimMode, label: "Varier la puissance" },
          { id: "speed" as SimMode, label: "Varier la vitesse" },
        ]).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              mode === m.id ? "bg-teal text-white font-semibold" : "bg-bg border border-border text-muted hover:text-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Power profile selector */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted">Profil de puissance :</span>
        <button
          onClick={() => setPowerProfile("real")}
          className={`px-2 py-1 rounded ${powerProfile === "real" ? "bg-info/20 text-info font-semibold" : "text-muted"}`}
        >
          Réel (avec intervalles)
        </button>
        <button
          onClick={() => setPowerProfile("smooth")}
          className={`px-2 py-1 rounded ${powerProfile === "smooth" ? "bg-info/20 text-info font-semibold" : "text-muted"}`}
        >
          Lissé (puissance constante)
        </button>
      </div>

      {/* Slider */}
      <div>
        {mode === "cda" && (
          <>
            <label className="block text-xs text-muted mb-1">
              CdA : <span className="text-teal font-mono font-semibold">{(baseCda + cdaDelta).toFixed(3)} m²</span>
              <span className="ml-2 text-muted">
                ({cdaDelta >= 0 ? "+" : ""}{cdaDelta.toFixed(3)} vs réel {baseCda.toFixed(3)})
              </span>
            </label>
            <input
              type="range"
              min={-0.15}
              max={0.15}
              step={0.005}
              value={cdaDelta}
              onChange={(e) => setCdaDelta(parseFloat(e.target.value))}
              className="w-full accent-teal"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>{(baseCda - 0.15).toFixed(2)}</span>
              <span className="text-teal">actuel</span>
              <span>{(baseCda + 0.15).toFixed(2)}</span>
            </div>
          </>
        )}

        {mode === "power" && (
          <>
            <label className="block text-xs text-muted mb-1">
              Puissance : <span className="text-teal font-mono font-semibold">{powerDelta >= 0 ? "+" : ""}{powerDelta}%</span>
              <span className="ml-2 text-muted">
                ({(avgPower * (1 + powerDelta / 100)).toFixed(0)} W vs {avgPower.toFixed(0)} W réel)
              </span>
            </label>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={powerDelta}
              onChange={(e) => setPowerDelta(parseInt(e.target.value))}
              className="w-full accent-teal"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>-30%</span>
              <span className="text-teal">actuel</span>
              <span>+30%</span>
            </div>
          </>
        )}

        {mode === "speed" && (
          <>
            <label className="block text-xs text-muted mb-1">
              Vitesse : <span className="text-teal font-mono font-semibold">{speedDelta >= 0 ? "+" : ""}{speedDelta.toFixed(1)} km/h</span>
              <span className="ml-2 text-muted">
                ({(result.avg_speed_kmh + speedDelta).toFixed(1)} vs {result.avg_speed_kmh.toFixed(1)} km/h réel)
              </span>
            </label>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={speedDelta}
              onChange={(e) => setSpeedDelta(parseFloat(e.target.value))}
              className="w-full accent-teal"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>-10 km/h</span>
              <span className="text-teal">actuel</span>
              <span>+10 km/h</span>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      {summary && (cdaDelta !== 0 || powerDelta !== 0 || speedDelta !== 0) && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-bg rounded p-2">
            <div className="text-[10px] text-muted uppercase">Vitesse moy.</div>
            <div className="font-mono text-sm">
              <span className="text-muted">{summary.avgVReal.toFixed(1)}</span>
              <span className="mx-1">→</span>
              <span className="text-teal font-semibold">{summary.avgVSim.toFixed(1)}</span>
              <span className="text-xs text-muted"> km/h</span>
            </div>
            <div className={`text-xs font-mono ${summary.deltaV > 0 ? "text-emerald-400" : summary.deltaV < 0 ? "text-coral" : "text-muted"}`}>
              {summary.deltaV >= 0 ? "+" : ""}{summary.deltaV.toFixed(1)} km/h
            </div>
          </div>
          <div className="bg-bg rounded p-2">
            <div className="text-[10px] text-muted uppercase">Puissance moy.</div>
            <div className="font-mono text-sm">
              <span className="text-muted">{summary.avgPReal.toFixed(0)}</span>
              <span className="mx-1">→</span>
              <span className="text-teal font-semibold">{summary.avgPSim.toFixed(0)}</span>
              <span className="text-xs text-muted"> W</span>
            </div>
            <div className={`text-xs font-mono ${summary.deltaP < 0 ? "text-emerald-400" : summary.deltaP > 0 ? "text-coral" : "text-muted"}`}>
              {summary.deltaP >= 0 ? "+" : ""}{summary.deltaP.toFixed(0)} W
            </div>
          </div>
          <div className="bg-bg rounded p-2">
            <div className="text-[10px] text-muted uppercase">Temps estimé</div>
            <div className="font-mono text-sm">
              <span className="text-teal font-semibold">{fmtTime(summary.deltaTime)}</span>
            </div>
            <div className="text-xs text-muted">
              sur {(profile.distance_km[n - 1]).toFixed(0)} km
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 10 && (cdaDelta !== 0 || powerDelta !== 0 || speedDelta !== 0) && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#262633" />
            <XAxis dataKey="d" stroke="#8b8ba0" fontSize={10} unit=" km" />
            <YAxis
              stroke="#8b8ba0"
              fontSize={10}
              unit={mode === "speed" ? " W" : " km/h"}
            />
            <Tooltip contentStyle={{ background: "#14141c", border: "1px solid #262633" }} />
            <Legend />
            {mode === "speed" ? (
              <>
                <Line type="monotone" dataKey="pReal" stroke="#8b8ba0" dot={false} name="P réelle" strokeWidth={1} />
                <Line type="monotone" dataKey="pSim" stroke="#1D9E75" dot={false} name="P simulée" strokeWidth={2} />
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="vReal" stroke="#8b8ba0" dot={false} name="V réelle" strokeWidth={1} />
                <Line type="monotone" dataKey="vSim" stroke="#1D9E75" dot={false} name="V simulée" strokeWidth={2} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {(cdaDelta === 0 && powerDelta === 0 && speedDelta === 0) && (
        <p className="text-xs text-muted text-center py-4">
          Déplacez le slider pour simuler un changement et voir son impact sur la sortie.
        </p>
      )}
    </div>
  );
}
