import { useState, useEffect } from "react";
import { Link2, Loader2, Filter, Play, ChevronDown, ChevronRight, FileText } from "lucide-react";
import {
  connect,
  listActivities,
  analyzeRide,
  DEFAULT_FILTERS,
  type AthleteProfile,
  type ActivitySummary,
  type RideFilters,
} from "../api/intervals";
import { getCachedInterval, setCacheInterval, type CacheOpts } from "../api/cache";
import { saveToHistory } from "../api/history";
import type { AnalysisResult } from "../types";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS, CRR_PRESETS, type BikeType } from "../types";
import InfoTooltip from "../components/InfoTooltip";
import CdATotem from "../components/CdATotem";
import CdARunningAvgChart from "../components/CdARunningAvgChart";
import CdAEvolutionChart from "../components/CdAEvolutionChart";
import ResultsDashboard from "../components/ResultsDashboard";
import TabSwitcher from "../components/TabSwitcher";
import ReferenceTable from "../components/ReferenceTable";
import PositionSchematic from "../components/PositionSchematic";

const LS_KEY = "aeroprofile_intervals_key";
const LS_AID = "aeroprofile_intervals_aid";

const MAX_NRMSE = 0.45;

interface RideResult {
  activity: ActivitySummary;
  result?: AnalysisResult;
  error?: string;
  excluded: boolean;
}

export default function IntervalsPage() {
  // Connection
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [athleteId, setAthleteId] = useState(() => localStorage.getItem(LS_AID) || "0");
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  // Filters
  const [oldest, setOldest] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [newest, setNewest] = useState(() => new Date().toISOString().slice(0, 10));
  const [filters, setFilters] = useState<RideFilters>({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [mass, setMass] = useState(75);
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [crrFixed, setCrrFixed] = useState("0.003");
  const [positionIdx, setPositionIdx] = useState(2); // default: "Aéro (drops)"
  const [useCache, setUseCache] = useState(true);

  const handleBikeType = (bt: BikeType) => {
    setBikeType(bt);
    // Don't auto-set Crr — keep current selection (may be Auto)
  };

  // Activities list
  const [allActivities, setAllActivities] = useState<ActivitySummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listing, setListing] = useState(false);
  const [listed, setListed] = useState(false);

  // Analysis
  const [rides, setRides] = useState<RideResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewTab, setViewTab] = useState<"overview" | "detail">("overview");

  // Persist credentials
  useEffect(() => {
    if (apiKey) localStorage.setItem(LS_KEY, apiKey);
    if (athleteId) localStorage.setItem(LS_AID, athleteId);
  }, [apiKey, athleteId]);

  useEffect(() => {
    if (profile?.weight_kg) setMass(Math.round(profile.weight_kg + 10));
  }, [profile]);

  const doConnect = async () => {
    setConnecting(true);
    setConnError(null);
    try {
      const p = await connect(apiKey, athleteId);
      setProfile(p);
    } catch (e: any) {
      setConnError(e.message);
    }
    setConnecting(false);
  };

  const doList = async () => {
    if (!profile) return;
    setListing(true);
    setListed(false);
    try {
      const r = await listActivities(apiKey, athleteId, oldest, newest, {
        min_distance_km: 0, max_distance_km: 99999,
        max_elevation_m: 99999, min_duration_h: 0,
      });
      setAllActivities(r.activities);
      setTotalCount(r.total);
      setListed(true);
    } catch (e: any) {
      setConnError(e.message);
    }
    setListing(false);
  };

  // Keywords that strongly suggest group riding / drafting → exclude by default
  const GROUP_KEYWORDS = /\b(group[e]?|peloton|avec|aspi|aspiration|porte[- ]?bagage|roue|draft|à deux|à trois|à [0-9]+|cyclosportive|granfondo|course|compét|critérium|kermesse)\b/i;

  const [excludeGroup, setExcludeGroup] = useState(true);

  const filteredActivities = allActivities.filter((a) => {
    if (a.activity_type !== "Ride" && a.activity_type !== "GravelRide") return false;
    if (a.indoor) return false;
    if (!a.has_power) return false;
    if (a.distance_km < filters.min_distance_km) return false;
    if (a.distance_km > filters.max_distance_km) return false;
    if (a.elevation_gain_m > filters.max_elevation_m) return false;
    if (a.moving_time_s / 3600 < filters.min_duration_h) return false;
    if (excludeGroup && GROUP_KEYWORDS.test(a.name)) return false;
    return true;
  });

  const doAnalyze = async () => {
    setAnalyzing(true);
    setDoneCount(0);
    setRides([]);
    setSelectedIdx(0);
    setViewTab("overview");
    const crr = crrFixed ? parseFloat(crrFixed.replace(",", ".")) : undefined;
    const posPresetForCache = bikeType === "road" ? POSITION_PRESETS[positionIdx] : undefined;
    const cacheOpts: CacheOpts = {
      mass_kg: mass, crr_fixed: crr, bike_type: bikeType,
      cda_prior_mean: posPresetForCache?.cdaPrior,
      cda_prior_sigma: posPresetForCache?.cdaSigma,
    };
    const { minCda: MIN_CDA, maxCda: MAX_CDA } = BIKE_TYPE_CONFIG[bikeType];

    const results: RideResult[] = [];
    for (let i = 0; i < filteredActivities.length; i++) {
      const act = filteredActivities[i];
      const fromCache = useCache ? getCachedInterval(act.id, cacheOpts) : null;
      if (fromCache) {
        const nrmse = (fromCache.rmse_w || 0) / Math.max(fromCache.avg_power_w, 1);
        results.push({ activity: act, result: fromCache, excluded: nrmse > MAX_NRMSE || fromCache.cda < MIN_CDA || fromCache.cda > MAX_CDA });
      } else {
        try {
          const posPreset = bikeType === "road" ? POSITION_PRESETS[positionIdx] : undefined;
          const res = await analyzeRide(apiKey, athleteId, act.id, mass, crr, bikeType, posPreset?.cdaPrior, posPreset?.cdaSigma);
          const nrmse = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
          results.push({ activity: act, result: res, excluded: nrmse > MAX_NRMSE || res.cda < MIN_CDA || res.cda > MAX_CDA });
          setCacheInterval(act.id, res, cacheOpts);
        } catch (e: any) {
          results.push({ activity: act, error: e.message, excluded: true });
        }
      }
      setDoneCount(i + 1);
      setRides([...results]);
    }

    const good = results.filter((r) => !r.excluded && r.result);
    if (good.length > 0) {
      const best = good.sort(
        (a, b) =>
          (a.result!.rmse_w / Math.max(a.result!.avg_power_w, 1)) -
          (b.result!.rmse_w / Math.max(b.result!.avg_power_w, 1)),
      )[0];
      setSelectedIdx(results.indexOf(best));
    }

    // Save to history
    if (good.length > 0) {
      const nrmses = good.map((r) => Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01));
      const bestN = Math.min(...nrmses), worstN = Math.max(...nrmses), span = worstN - bestN;
      let tw = 0, sc = 0, sr = 0, sp = 0, sRho = 0, sRmse = 0;
      for (let j = 0; j < good.length; j++) {
        const res = good[j].result!;
        const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
        const w = Math.max(res.valid_points, 1) * qw;
        tw += w; sc += res.cda * w; sr += res.crr * w; sp += res.avg_power_w * w; sRho += res.avg_rho * w; sRmse += (res.rmse_w || 0) * w;
      }
      const hCda = sc / tw, hCrr = sr / tw;
      let hLow: number | null = null, hHigh: number | null = null;
      if (good.length >= 2) {
        const cdas = good.map((r) => r.result!.cda);
        const wVar = cdas.reduce((a, c) => a + (c - hCda) ** 2, 0) / cdas.length;
        const se = Math.sqrt(wVar / cdas.length);
        hLow = hCda - 1.96 * se; hHigh = hCda + 1.96 * se;
      }
      const posP = bikeType === "road" ? POSITION_PRESETS[positionIdx] : undefined;
      saveToHistory({
        id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        mode: "intervals",
        label: `${good.length} sortie${good.length > 1 ? "s" : ""} via Intervals.icu (${profile?.name || athleteId})`,
        cda: hCda, cdaLow: hLow, cdaHigh: hHigh, crr: hCrr,
        rmseW: sRmse / tw, avgPowerW: sp / tw, avgRho: sRho / tw,
        bikeType,
        positionLabel: posP?.label || BIKE_TYPE_CONFIG[bikeType].label,
        massKg: mass,
        crrFixed: crr ?? null,
        cdaPriorMean: posP?.cdaPrior ?? null,
        cdaPriorSigma: posP?.cdaSigma ?? null,
        nRides: good.length,
        nExcluded: results.length - good.length,
        nTotalPoints: good.reduce((a, r) => a + (r.result?.valid_points || 0), 0),
        rideCdas: good.map((r) => ({
          date: r.result!.ride_date,
          cda: r.result!.cda,
          nrmse: (r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1),
        })),
      });
    }

    setAnalyzing(false);
  };

  const goodRides = rides.filter((r) => !r.excluded && r.result);

  // Full aggregate computation (matching App.tsx)
  let aggCda: number | null = null;
  let aggCrr: number | null = null;
  let aggCdaLow: number | null = null;
  let aggCdaHigh: number | null = null;
  let aggPower: number | null = null;
  let aggRho: number | null = null;
  let aggRmse: number | null = null;
  if (goodRides.length >= 1) {
    const nrmses = goodRides.map((r) =>
      Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01),
    );
    const bestN = Math.min(...nrmses);
    const worstN = Math.max(...nrmses);
    const span = worstN - bestN;
    let totalW = 0, sumCda = 0, sumCrr = 0, sumPow = 0, sumRho = 0, sumRmse = 0;
    for (let j = 0; j < goodRides.length; j++) {
      const res = goodRides[j].result!;
      const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
      const w = Math.max(res.valid_points, 1) * qw;
      totalW += w;
      sumCda += res.cda * w;
      sumCrr += res.crr * w;
      sumPow += res.avg_power_w * w;
      sumRho += res.avg_rho * w;
      sumRmse += (res.rmse_w || 0) * w;
    }
    aggCda = sumCda / totalW;
    aggCrr = sumCrr / totalW;
    aggPower = sumPow / totalW;
    aggRho = sumRho / totalW;
    aggRmse = sumRmse / totalW;
    if (goodRides.length >= 2) {
      const cdas = goodRides.map((r) => r.result!.cda);
      let wVar = 0;
      for (const c of cdas) wVar += (c - aggCda!) ** 2;
      wVar /= cdas.length;
      const se = Math.sqrt(wVar / cdas.length);
      aggCdaLow = aggCda - 1.96 * se;
      aggCdaHigh = aggCda + 1.96 * se;
    }
  }

  const selectedResult = rides[selectedIdx]?.result || null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Link2 className="text-teal" size={20} />
          Intervals.icu
        </h2>
        <p className="text-sm text-muted mt-1">
          Connectez votre compte pour analyser automatiquement toutes vos sorties.
        </p>
      </div>

      {/* Connection */}
      <div className="bg-panel border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3">Connexion</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-muted mb-1">
              Clé API
              <InfoTooltip text="Trouvez votre clé API dans Intervals.icu → Settings → Developer Settings (en bas de la page)." />
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Votre clé API Intervals.icu"
              className="w-full bg-bg border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-teal"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Athlete ID
              <InfoTooltip text="Visible dans l'URL de votre profil Intervals.icu (ex: i12345). Ou mettez '0' pour l'utilisateur connecté." />
            </label>
            <input
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              placeholder="0"
              className="w-full bg-bg border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-teal"
            />
          </div>
          <button
            onClick={doConnect}
            disabled={connecting || !apiKey}
            className="px-4 py-2 bg-teal hover:bg-teal/90 disabled:opacity-40 text-white rounded font-semibold text-sm flex items-center gap-2"
          >
            {connecting ? <Loader2 className="animate-spin" size={14} /> : <Link2 size={14} />}
            Connecter
          </button>
        </div>
        {connError && <p className="text-coral text-sm mt-2">{connError}</p>}
        {profile && (
          <div className="mt-3 p-3 bg-teal/10 border border-teal/30 rounded text-sm">
            Connecté : <strong>{profile.name}</strong> • {profile.weight_kg} kg • FTP {profile.ftp} W
          </div>
        )}
      </div>

      {/* Filters + date range */}
      {profile && (
        <div className="bg-panel border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Paramètres</h3>

          {/* Row 1: Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">Date début</label>
              <input type="date" value={oldest} onChange={(e) => setOldest(e.target.value)}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 font-mono" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Date fin</label>
              <input type="date" value={newest} onChange={(e) => setNewest(e.target.value)}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 font-mono" />
            </div>
          </div>

          {/* Row 2: Mass + Bike type */}
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 mt-3 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">Masse totale (kg)</label>
              <input type="number" value={mass} onChange={(e) => setMass(parseFloat(e.target.value) || 75)}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 font-mono" min={30} max={200} step={0.1} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Type de vélo</label>
              <div className="flex gap-1">
                {(Object.entries(BIKE_TYPE_CONFIG) as [BikeType, typeof BIKE_TYPE_CONFIG[BikeType]][]).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => handleBikeType(key)} title={cfg.description}
                    className={`flex-1 px-3 py-1.5 text-sm rounded transition ${
                      bikeType === key ? "bg-teal text-white font-semibold" : "bg-bg border border-border text-muted hover:text-text"
                    }`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Crr + Position */}
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 mt-3 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">Pneus (Crr)</label>
              <select value={crrFixed} onChange={(e) => setCrrFixed(e.target.value)}
                className={`w-full bg-bg border rounded px-2 py-1.5 font-mono text-xs ${
                  !crrFixed ? "border-orange-500/50" : "border-border"
                }`}>
                {CRR_PRESETS.map((p) => (
                  <option key={p.crr} value={p.crr === 0 ? "" : String(p.crr)}>
                    {p.crr === 0 ? "Auto (estimé)" : `${p.crr.toFixed(4)} — ${p.label}`}
                  </option>
                ))}
              </select>
              {!crrFixed && (
                <p className="text-[10px] text-orange-400 mt-0.5">
                  Fixer le Crr donne un CdA plus stable.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Position :
                <span className="text-teal font-semibold ml-1">{POSITION_PRESETS[positionIdx].label}</span>
                {POSITION_PRESETS[positionIdx].cdaPrior > 0 ? (
                  <span className="ml-1">(prior CdA ≈ {POSITION_PRESETS[positionIdx].cdaPrior})</span>
                ) : (
                  <span className="ml-1">(pas de prior — estimation libre)</span>
                )}
              </label>
              <input type="range" min={0} max={POSITION_PRESETS.length - 1} step={1}
                value={positionIdx} onChange={(e) => setPositionIdx(parseInt(e.target.value))}
                className="w-full accent-teal" />
              <div className="flex justify-between text-[10px] text-muted mt-0.5">
                {POSITION_PRESETS.map((p, i) => (
                  <span key={i} className={`cursor-pointer ${i === positionIdx ? "text-teal font-semibold" : ""}`}
                    onClick={() => setPositionIdx(i)}>{p.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setUseCache(!useCache)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                useCache ? "bg-teal" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  useCache ? "translate-x-4" : ""
                }`}
              />
            </button>
            <label className="text-xs text-muted">
              Cache local {useCache ? "(activé)" : "(désactivé — re-analyse tout)"}
            </label>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mt-3 flex items-center text-sm text-muted hover:text-text"
          >
            {showFilters ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Filter size={14} className="mr-1" /> Filtres de rides
          </button>

          {showFilters && (
            <div className="mt-3 space-y-4 text-sm">
              <p className="text-xs text-muted">
                Seules les sorties <strong>extérieures avec capteur de puissance</strong> sont
                prises en compte (indoor et rides sans puissance sont toujours exclues).
              </p>

              {/* Group ride exclusion toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExcludeGroup(!excludeGroup)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    excludeGroup ? "bg-teal" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      excludeGroup ? "translate-x-4" : ""
                    }`}
                  />
                </button>
                <label className="text-xs text-muted">
                  Exclure les sorties en groupe
                  {excludeGroup && (
                    <span className="text-teal ml-1">
                      (détection par mots-clés : groupe, peloton, avec, aspi, course…)
                    </span>
                  )}
                </label>
              </div>
              <div>
                <label className="block text-xs text-muted mb-2">
                  Distance : <span className="text-teal font-mono">{filters.min_distance_km}</span> – <span className="text-teal font-mono">{filters.max_distance_km}</span> km
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Min</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={500} step={5}
                        value={filters.min_distance_km}
                        onChange={(e) => { const v = parseFloat(e.target.value); setFilters({ ...filters, min_distance_km: Math.min(v, filters.max_distance_km - 5) }); }}
                        className="flex-1 accent-teal" />
                      <span className="font-mono text-xs w-12 text-right">{filters.min_distance_km}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Max</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={500} step={5}
                        value={filters.max_distance_km}
                        onChange={(e) => { const v = parseFloat(e.target.value); setFilters({ ...filters, max_distance_km: Math.max(v, filters.min_distance_km + 5) }); }}
                        className="flex-1 accent-info" />
                      <span className="font-mono text-xs w-12 text-right">{filters.max_distance_km}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">
                    D+ max : <span className="text-teal font-mono">{filters.max_elevation_m}</span> m
                  </label>
                  <input type="range" min={200} max={5000} step={100}
                    value={filters.max_elevation_m}
                    onChange={(e) => setFilters({ ...filters, max_elevation_m: parseFloat(e.target.value) })}
                    className="w-full accent-teal" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">
                    Durée min : <span className="text-teal font-mono">{Math.round(filters.min_duration_h * 60)}</span> min
                  </label>
                  <input type="range" min={0} max={240} step={15}
                    value={Math.round(filters.min_duration_h * 60)}
                    onChange={(e) => setFilters({ ...filters, min_duration_h: parseFloat(e.target.value) / 60 })}
                    className="w-full accent-teal" />
                </div>
              </div>
              {listed && (
                <p className="text-xs text-teal font-mono">
                  → {filteredActivities.length} rides correspondent aux filtres
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button onClick={doList} disabled={listing}
              className="px-4 py-2 border border-border rounded hover:border-muted text-sm flex items-center gap-2">
              {listing ? <Loader2 className="animate-spin" size={14} /> : <Filter size={14} />}
              Rechercher les sorties
            </button>
            {listed && (
              <span className="text-sm text-muted">
                <span className="text-teal font-mono">{allActivities.length}</span> rides vélo
                sur <span className="font-mono">{totalCount}</span> activités
              </span>
            )}
          </div>
        </div>
      )}

      {/* Activity list + analyze button */}
      {listed && (
        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              <span className="text-teal font-mono">{filteredActivities.length}</span> rides
              retenues sur <span className="font-mono">{allActivities.length}</span> activités
              {filteredActivities.length === 0 && <span className="text-coral ml-2">(ajustez les filtres)</span>}
            </h3>
            <button onClick={doAnalyze} disabled={analyzing || filteredActivities.length === 0}
              className="px-5 py-2 bg-teal hover:bg-teal/90 disabled:opacity-40 text-white font-semibold rounded flex items-center gap-2">
              {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              {analyzing ? `Analyse ${doneCount}/${filteredActivities.length}…` : `Analyser ${filteredActivities.length} sorties`}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto text-xs space-y-1">
            {filteredActivities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-muted py-0.5">
                <span className="font-mono text-text w-20">{a.start_date}</span>
                <span className="truncate flex-1">{a.name}</span>
                <span className="font-mono">{a.distance_km} km</span>
                <span className="font-mono">{Math.round(a.elevation_gain_m)} m</span>
                <span className="font-mono">{Math.round(a.average_watts)} W</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {analyzing && (
        <div className="bg-panel border border-border rounded-lg p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin text-teal" size={14} />
              Analyse en cours…
            </span>
            <span className="font-mono text-teal">{doneCount} / {filteredActivities.length}</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-teal rounded-full transition-all duration-500"
              style={{ width: `${filteredActivities.length > 0 ? (doneCount / filteredActivities.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {goodRides.length > 0 && aggCda !== null && (
        <>
          <TabSwitcher
            tabs={[
              { id: "overview", label: "Vue d'ensemble" },
              { id: "detail", label: "Détail d'une sortie" },
            ]}
            active={viewTab}
            onChange={(id) => setViewTab(id as "overview" | "detail")}
          />

          {viewTab === "overview" && (
            <div className="space-y-6">
              {/* Totem */}
              {!analyzing && <CdATotem cda={aggCda} />}

              {/* Aggregate banner */}
              <div className="bg-panel border border-teal rounded-lg p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-muted uppercase tracking-wide flex items-center">
                      CdA moyen ({goodRides.length} sortie{goodRides.length > 1 ? "s" : ""} retenue{goodRides.length > 1 ? "s" : ""} sur {rides.length})
                      <InfoTooltip text="Moyenne pondérée par le nombre de points valides × qualité (1/nRMSE). Les sorties avec nRMSE > 45% ou CdA hors limites sont exclues." />
                    </div>
                    <div className="text-3xl font-mono font-bold text-teal mt-1">
                      CdA = {aggCda.toFixed(3)}
                      {aggCdaLow != null && (
                        <span className="text-sm text-muted font-normal ml-2">
                          IC95 [{aggCdaLow.toFixed(3)} – {aggCdaHigh!.toFixed(3)}]
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-6 text-right">
                    {aggCrr !== null && (
                      <div>
                        <div className="text-xs text-muted">Crr moyen</div>
                        <div className="text-xl font-mono text-teal">{aggCrr.toFixed(4)}</div>
                      </div>
                    )}
                    {aggRmse !== null && (
                      <div>
                        <div className="text-xs text-muted">RMSE moyen</div>
                        <div className="text-xl font-mono text-muted">±{aggRmse.toFixed(0)} W</div>
                      </div>
                    )}
                    {aggPower !== null && aggCda > 0 && (
                      <div>
                        <div className="text-xs text-muted flex items-center justify-end">
                          W/CdA
                          <InfoTooltip text="Puissance moyenne / CdA = capacité à aller vite sur le plat." />
                        </div>
                        <div className="text-xl font-mono text-info">
                          {(aggPower / aggCda).toFixed(0)}
                        </div>
                      </div>
                    )}
                    {aggPower !== null && aggCda > 0 && (
                      <div>
                        <div className="text-xs text-muted">V plat</div>
                        <div className="text-xl font-mono text-info">
                          {(Math.pow(2 * aggPower / (aggCda * (aggRho || 1.2)), 1/3) * 3.6).toFixed(1)} km/h
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Position + Derived metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-panel border border-border rounded-lg p-4 flex justify-center">
                  <PositionSchematic cda={aggCda} label="Position moyenne" size={240} />
                </div>
                <div className="bg-panel border border-border rounded-lg p-4 md:col-span-2">
                  <h3 className="text-sm font-semibold mb-2">Métriques dérivées (moyenne)</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-mono">
                    {[30, 35, 40, 45].map((s) => {
                      const v = s / 3.6;
                      const pAero = 0.5 * aggCda * (aggRho || 1.2) * v * v * v;
                      const pRoll = (aggCrr || 0.004) * mass * 9.80665 * v;
                      const pTotal = (pAero + pRoll) / 0.977;
                      return (
                        <div key={s} className="flex justify-between border-b border-border/30 py-1">
                          <span className="text-muted">{s} km/h</span>
                          <span className="text-teal">{pTotal.toFixed(0)} W</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Watts pour rouler sur le plat ({mass} kg, pas de vent, ρ = {(aggRho || 1.2).toFixed(2)})
                  </p>
                </div>
              </div>

              <ReferenceTable cda={aggCda} crr={aggCrr || 0.004} />

              {/* Charts */}
              {goodRides.length >= 2 && (
                <>
                  <CdARunningAvgChart
                    rides={goodRides.map((r) => ({
                      date: r.result!.ride_date,
                      cda: r.result!.cda,
                      nrmse: (r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1),
                      fileName: r.activity.name,
                    }))}
                    aggCda={aggCda}
                  />
                  <CdAEvolutionChart
                    riders={[{
                      name: "CdA",
                      points: goodRides.map((r) => ({
                        date: r.result!.ride_date,
                        cda: r.result!.cda,
                        r2: r.result!.r_squared,
                        fileName: r.activity.name,
                      })).sort((a, b) => a.date.localeCompare(b.date)),
                    }]}
                  />
                </>
              )}

              {/* Ride chips */}
              <div className="bg-panel border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Sorties analysées</h3>
                <div className="flex flex-wrap gap-1.5">
                  {rides.map((r, i) => {
                    const isBad = r.excluded;
                    let reason = "";
                    let nrmseVal = 0;
                    if (r.error) {
                      reason = `Erreur : ${r.error}`;
                    } else if (r.result) {
                      nrmseVal = (r.result.rmse_w || 0) / Math.max(r.result.avg_power_w, 1);
                      reason = `${r.activity.name}\nCdA ${r.result.cda.toFixed(3)} • nRMSE ${(nrmseVal*100).toFixed(0)}% • ±${r.result.rmse_w.toFixed(0)}W`;
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (r.result && !isBad) {
                            setSelectedIdx(i);
                            setViewTab("detail");
                          }
                        }}
                        title={reason}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono transition ${
                          isBad
                            ? "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
                            : "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:border-teal cursor-pointer"
                        }`}
                      >
                        {isBad ? "✗" : "✓"}
                        <FileText size={11} />
                        <span className="truncate max-w-[120px]">{r.activity.start_date}</span>
                        {r.result && !isBad && (
                          <>
                            <span className="opacity-70">{r.result.cda.toFixed(3)}</span>
                            <span className="opacity-40">{(nrmseVal*100).toFixed(0)}%</span>
                          </>
                        )}
                        {isBad && r.result && <span className="opacity-40">{r.result.cda.toFixed(3)}</span>}
                        {isBad && !r.result && <span className="opacity-40">err.</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-1.5 text-[10px] text-muted">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Retenue (cliquer → détail)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Exclue
                  </span>
                </div>
                <p className="text-[10px] text-muted mt-2 leading-relaxed">
                  Une sortie est exclue si son erreur de modélisation (nRMSE) dépasse 45%
                  ou si le CdA estimé tombe hors de la plage du type de vélo
                  ({BIKE_TYPE_CONFIG[bikeType].minCda}–{BIKE_TYPE_CONFIG[bikeType].maxCda} m²).
                  Les sorties en groupe (mots-clés dans le titre) sont exclues avant l'analyse.
                  Le seuil à 45% garantit que seules les rides où le modèle physique
                  fonctionne bien contribuent à la moyenne — les rides bruitées sont
                  trop sensibles aux paramètres pour être fiables.
                  Survolez une sortie exclue pour voir la raison.
                </p>
              </div>
            </div>
          )}

          {viewTab === "detail" && selectedResult && (
            <div>
              <div className="bg-panel border border-border rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm flex-wrap">
                <FileText size={14} className="text-muted" />
                <span className="text-muted">Détail :</span>
                <span className="font-mono text-teal">{rides[selectedIdx]?.activity?.name}</span>
                <span className="text-muted text-xs">({rides[selectedIdx]?.activity?.start_date})</span>
                <div className="flex gap-1 ml-auto">
                  {rides.filter((r) => !r.excluded && r.result).map((r) => {
                    const realIdx = rides.indexOf(r);
                    return (
                      <button
                        key={realIdx}
                        onClick={() => setSelectedIdx(realIdx)}
                        className={`text-xs px-2 py-0.5 rounded font-mono ${
                          realIdx === selectedIdx
                            ? "bg-teal text-white"
                            : "bg-panel border border-border text-muted hover:text-text"
                        }`}
                      >
                        {r.activity.start_date}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ResultsDashboard result={selectedResult} massKg={mass} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
