import { useState, useEffect } from "react";
import { Link2, Loader2, Filter, Play, ChevronDown, ChevronRight, FileText, ExternalLink } from "lucide-react";
import {
  connect,
  listActivities,
  analyzeRide,
  DEFAULT_FILTERS,
  type AthleteProfile,
  type ActivitySummary,
  type RideFilters,
} from "../api/intervals";
import type { AnalysisResult } from "../types";
import InfoTooltip from "../components/InfoTooltip";
import CdATotem from "../components/CdATotem";
import CdARunningAvgChart from "../components/CdARunningAvgChart";
import CdAEvolutionChart from "../components/CdAEvolutionChart";
import ResultsDashboard from "../components/ResultsDashboard";

const LS_KEY = "aeroprofile_intervals_key";
const LS_AID = "aeroprofile_intervals_aid";

const MAX_NRMSE = 0.60;

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
  const [crrFixed, setCrrFixed] = useState("");

  // Activities list — allActivities = everything from API, filtered in real-time
  const [allActivities, setAllActivities] = useState<ActivitySummary[]>([]);
  const [listing, setListing] = useState(false);
  const [listed, setListed] = useState(false);

  // Analysis
  const [rides, setRides] = useState<RideResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Persist credentials
  useEffect(() => {
    if (apiKey) localStorage.setItem(LS_KEY, apiKey);
    if (athleteId) localStorage.setItem(LS_AID, athleteId);
  }, [apiKey, athleteId]);

  // Update mass from profile: add ~10 kg for the bike
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
      // Fetch ALL activities in the date range (no server-side filtering)
      const r = await listActivities(apiKey, athleteId, oldest, newest, {
        min_distance_km: 0,
        max_distance_km: 99999,
        max_elevation_m: 99999,
        min_duration_h: 0,
      });
      setAllActivities(r.activities);
      setListed(true);
    } catch (e: any) {
      setConnError(e.message);
    }
    setListing(false);
  };

  // Client-side filtering — updates live when filters change.
  // Indoor rides are ALWAYS excluded (no option). Power is ALWAYS required.
  const filteredActivities = allActivities.filter((a) => {
    if (a.activity_type !== "Ride" && a.activity_type !== "GravelRide") return false;
    if (a.indoor) return false;
    if (!a.has_power) return false;
    if (a.distance_km < filters.min_distance_km) return false;
    if (a.distance_km > filters.max_distance_km) return false;
    if (a.elevation_gain_m > filters.max_elevation_m) return false;
    if (a.moving_time_s / 3600 < filters.min_duration_h) return false;
    return true;
  });

  const doAnalyze = async () => {
    setAnalyzing(true);
    setDoneCount(0);
    setRides([]);
    setSelectedIdx(0);
    const crr = crrFixed ? parseFloat(crrFixed.replace(",", ".")) : undefined;

    const results: RideResult[] = [];
    for (let i = 0; i < filteredActivities.length; i++) {
      const act = filteredActivities[i];
      try {
        const res = await analyzeRide(apiKey, athleteId, act.id, mass, crr);
        const nrmse = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
        results.push({ activity: act, result: res, excluded: nrmse > MAX_NRMSE });
      } catch (e: any) {
        results.push({ activity: act, error: e.message, excluded: true });
      }
      setDoneCount(i + 1);
      setRides([...results]);
    }

    // Select best ride
    const good = results.filter((r) => !r.excluded && r.result);
    if (good.length > 0) {
      const best = good.sort(
        (a, b) =>
          (a.result!.rmse_w / Math.max(a.result!.avg_power_w, 1)) -
          (b.result!.rmse_w / Math.max(b.result!.avg_power_w, 1)),
      )[0];
      setSelectedIdx(results.indexOf(best));
    }
    setAnalyzing(false);
  };

  const goodRides = rides.filter((r) => !r.excluded && r.result);

  // Aggregate CdA
  let aggCda: number | null = null;
  if (goodRides.length >= 1) {
    const nrmses = goodRides.map((r) =>
      Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01),
    );
    const bestN = Math.min(...nrmses);
    const worstN = Math.max(...nrmses);
    const span = worstN - bestN;
    let totalW = 0, sumCda = 0;
    for (let j = 0; j < goodRides.length; j++) {
      const res = goodRides[j].result!;
      const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
      const w = Math.max(res.valid_points, 1) * qw;
      totalW += w;
      sumCda += res.cda * w;
    }
    aggCda = sumCda / totalW;
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

      {/* Filters + date range (only after connected) */}
      {profile && (
        <div className="bg-panel border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Paramètres</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">Date début</label>
              <input type="date" value={oldest} onChange={(e) => setOldest(e.target.value)}
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Date fin</label>
              <input type="date" value={newest} onChange={(e) => setNewest(e.target.value)}
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Masse totale cycliste+vélo (kg)</label>
              <input type="number" value={mass} onChange={(e) => setMass(parseFloat(e.target.value) || 75)}
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono" min={30} max={200} step={0.1} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Crr fixe (vide=auto)</label>
              <input type="text" value={crrFixed} onChange={(e) => setCrrFixed(e.target.value)} placeholder="auto"
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono" />
            </div>
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

              {/* Distance dual slider */}
              <div>
                <label className="block text-xs text-muted mb-2">
                  Distance : <span className="text-teal font-mono">{filters.min_distance_km}</span> – <span className="text-teal font-mono">{filters.max_distance_km}</span> km
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted w-8">0</span>
                  <div className="flex-1 relative h-6">
                    {/* Min slider */}
                    <input
                      type="range"
                      min={0} max={500} step={5}
                      value={filters.min_distance_km}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setFilters({ ...filters, min_distance_km: Math.min(v, filters.max_distance_km - 5) });
                      }}
                      className="absolute w-full h-1 top-2.5 appearance-none bg-border rounded pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    {/* Max slider */}
                    <input
                      type="range"
                      min={0} max={500} step={5}
                      value={filters.max_distance_km}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setFilters({ ...filters, max_distance_km: Math.max(v, filters.min_distance_km + 5) });
                      }}
                      className="absolute w-full h-1 top-2.5 appearance-none bg-transparent rounded pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-info [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-muted w-10">500</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">
                    D+ max : <span className="text-teal font-mono">{filters.max_elevation_m}</span> m
                  </label>
                  <input
                    type="range"
                    min={200} max={5000} step={100}
                    value={filters.max_elevation_m}
                    onChange={(e) => setFilters({ ...filters, max_elevation_m: parseFloat(e.target.value) })}
                    className="w-full accent-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">
                    Durée min : <span className="text-teal font-mono">{Math.round(filters.min_duration_h * 60)}</span> min
                  </label>
                  <input
                    type="range"
                    min={0} max={240} step={15}
                    value={Math.round(filters.min_duration_h * 60)}
                    onChange={(e) => setFilters({ ...filters, min_duration_h: parseFloat(e.target.value) / 60 })}
                    className="w-full accent-teal"
                  />
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
            <button
              onClick={doList}
              disabled={listing}
              className="px-4 py-2 border border-border rounded hover:border-muted text-sm flex items-center gap-2"
            >
              {listing ? <Loader2 className="animate-spin" size={14} /> : <Filter size={14} />}
              Rechercher les sorties
            </button>
            {listed && (
              <span className="text-sm text-muted">
                {allActivities.length} activités sur Intervals (tous types)
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
              {filteredActivities.length === 0 && (
                <span className="text-coral ml-2">(ajustez les filtres)</span>
              )}
            </h3>
            <button
              onClick={doAnalyze}
              disabled={analyzing || filteredActivities.length === 0}
              className="px-5 py-2 bg-teal hover:bg-teal/90 disabled:opacity-40 text-white font-semibold rounded flex items-center gap-2"
            >
              {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              {analyzing ? `Analyse ${doneCount}/${filteredActivities.length}…` : `Analyser ${filteredActivities.length} sorties`}
            </button>
          </div>

          {/* Scrollable activity preview */}
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
      {goodRides.length > 0 && (
        <>
          {/* Totem */}
          {aggCda && !analyzing && <CdATotem cda={aggCda} />}

          {/* Aggregate banner */}
          <div className="bg-panel border border-teal rounded-lg p-4">
            <div className="text-xs text-muted uppercase">
              CdA moyen ({goodRides.length} sortie{goodRides.length > 1 ? "s" : ""} retenue{goodRides.length > 1 ? "s" : ""})
            </div>
            <div className="text-3xl font-mono font-bold text-teal mt-1">
              CdA = {aggCda?.toFixed(3)}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {rides.map((r, i) => {
                const isBad = r.excluded;
                return (
                  <button
                    key={i}
                    onClick={() => r.result && !isBad && setSelectedIdx(i)}
                    title={r.error || (r.result ? `CdA ${r.result.cda.toFixed(3)}` : "")}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono ${
                      isBad
                        ? "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
                        : i === selectedIdx
                          ? "bg-teal/20 text-teal border border-teal"
                          : "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:border-teal"
                    }`}
                  >
                    {isBad ? "✗" : i === selectedIdx ? "▶" : "✓"}
                    <span className="truncate max-w-[120px]">{r.activity.start_date}</span>
                    {r.result && !isBad && <span className="opacity-60">{r.result.cda.toFixed(3)}</span>}
                    {isBad && <span className="opacity-40">excl.</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          {goodRides.length >= 2 && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* Detail */}
          {selectedResult && (
            <>
              <div className="bg-panel border border-border rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
                <FileText size={14} className="text-muted" />
                <span className="text-muted">Détail :</span>
                <span className="font-mono text-teal">{rides[selectedIdx]?.activity?.name}</span>
                <span className="text-muted text-xs">({rides[selectedIdx]?.activity?.start_date})</span>
              </div>
              <ResultsDashboard result={selectedResult} />
            </>
          )}
        </>
      )}
    </div>
  );
}
