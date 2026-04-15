import { useState, useEffect } from "react";
import { Link2, Loader2, Filter, Play, ChevronDown, ChevronRight, FileText } from "lucide-react";
import {
  connect,
  listActivities,
  analyzeRide,
  analyzeBatchIntervals,
  logAnalysisSession,
  DEFAULT_FILTERS,
  type AthleteProfile,
  type ActivitySummary,
  type RideFilters,
} from "../api/intervals";
import { getCachedInterval, setCacheInterval, type CacheOpts } from "../api/cache";
import { saveToHistory } from "../api/history";
import { getActiveProfile, type ProfileSettings } from "../api/profiles";
import ProfilePicker from "../components/ProfilePicker";
import type { AnalysisResult, HierarchicalAnalysisResult } from "../types";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS_BY_BIKE, CRR_PRESETS, isHardFailure, type BikeType } from "../types";
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

const DEFAULT_MAX_NRMSE = 0.45;

interface RideResult {
  activity: ActivitySummary;
  result?: AnalysisResult;
  error?: string;
  excluded: boolean;
}

export default function IntervalsPage() {
  // Profile-driven initial state. We read the active profile ONCE at mount
  // to seed every form field; the ProfilePicker below can reload it on
  // demand or save the current form state back into the profile.
  const initialProfile = getActiveProfile();
  const initialSettings = initialProfile.settings || {};
  const legacyApiKey = localStorage.getItem(LS_KEY) || "";
  const legacyAid = localStorage.getItem(LS_AID) || "0";

  // Connection — fall back to legacy localStorage for first-run migration
  const [apiKey, setApiKey] = useState(initialSettings.intervalsApiKey || legacyApiKey);
  const [athleteId, setAthleteId] = useState(initialSettings.intervalsAthleteId || legacyAid);
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
  const [filters, setFilters] = useState<RideFilters>(() => {
    const f = initialSettings.intervalsFilters;
    if (!f) return { ...DEFAULT_FILTERS };
    return {
      min_distance_km: f.minDistanceKm ?? DEFAULT_FILTERS.min_distance_km,
      max_distance_km: f.maxDistanceKm ?? DEFAULT_FILTERS.max_distance_km,
      max_elevation_m: f.maxElevationM ?? DEFAULT_FILTERS.max_elevation_m,
      max_elevation_per_km: f.maxElevationPerKm ?? DEFAULT_FILTERS.max_elevation_per_km,
      min_duration_h: f.minDurationH ?? DEFAULT_FILTERS.min_duration_h,
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [mass, setMass] = useState(initialSettings.massKg ?? 75);
  const [bikeType, setBikeType] = useState<BikeType>(initialSettings.bikeType ?? "road");
  const [crrFixed, setCrrFixed] = useState(
    initialSettings.crrFixed != null ? String(initialSettings.crrFixed) : "0.0032",
  );
  const [positionIdx, setPositionIdx] = useState(initialSettings.positionIdx ?? 2);
  const [useCache, setUseCache] = useState(true);
  const [maxNrmse, setMaxNrmse] = useState(initialSettings.maxNrmse ?? 45);
  // P3 — minimum solver agreement. "off" keeps everything (default),
  // "medium" excludes low-confidence rides (|Δ chung−wind| ≥ 0.05),
  // "high" excludes both low and medium (keeps only |Δ| < 0.02).
  const [minConfidence, setMinConfidence] = useState<"off" | "medium" | "high">("off");

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
  const [hierResult, setHierResult] = useState<HierarchicalAnalysisResult | null>(null);
  const [hierLoading, setHierLoading] = useState(false);
  const [hierError, setHierError] = useState<string | null>(null);

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

  const [excludeGroup, setExcludeGroup] = useState(
    initialSettings.intervalsFilters?.excludeGroup ?? true,
  );
  // Pre-analysis sensor filter: lets the user exclude candidate rides
  // by their power meter before the expensive analysis loop. Initialises
  // empty (= "all"); first populated when the activity list loads.
  const [sensorFilter, setSensorFilter] = useState<Set<string>>(new Set());
  const [sensorFilterInitialised, setSensorFilterInitialised] = useState(false);

  // Base filter — everything except the D+/km grade ratio and the sensor filter
  const passesBaseFilters = (a: typeof allActivities[number]) => {
    if (a.activity_type !== "Ride" && a.activity_type !== "GravelRide") return false;
    if (a.indoor) return false;
    if (!a.has_power) return false;
    if (a.distance_km < filters.min_distance_km) return false;
    if (a.distance_km > filters.max_distance_km) return false;
    if (a.elevation_gain_m > filters.max_elevation_m) return false;
    if (a.moving_time_s / 3600 < filters.min_duration_h) return false;
    if (excludeGroup && GROUP_KEYWORDS.test(a.name)) return false;
    return true;
  };
  // Sensor filter: applied on top of the base filters. An empty set means
  // "don't filter by sensor" (show all rides). Use "__unknown__" for rides
  // without a power_meter field.
  const passesSensorFilter = (a: typeof allActivities[number]) => {
    if (sensorFilter.size === 0) return true;
    const key = a.power_meter || "__unknown__";
    return sensorFilter.has(key);
  };
  // D+/km exclusion on top of the base filters — tracked separately so we
  // can show "X rides excluded by grade filter" in the UI.
  const passesGradeFilter = (a: typeof allActivities[number]) => {
    if (filters.max_elevation_per_km == null) return true;
    if (a.distance_km <= 0) return true;
    return a.elevation_gain_m / a.distance_km <= filters.max_elevation_per_km;
  };
  const baseFiltered = allActivities.filter(passesBaseFilters);
  const afterGrade = baseFiltered.filter(passesGradeFilter);
  const excludedByGrade = baseFiltered.length - afterGrade.length;
  const filteredActivities = afterGrade.filter(passesSensorFilter);
  const excludedBySensor = afterGrade.length - filteredActivities.length;
  // Distinct sensors observed in the ride list, for the filter UI
  const availableSensors = (() => {
    const counts = new Map<string, number>();
    let unknown = 0;
    for (const a of baseFiltered) {
      if (a.power_meter) counts.set(a.power_meter, (counts.get(a.power_meter) || 0) + 1);
      else unknown++;
    }
    return {
      list: [...counts.entries()].sort((x, y) => y[1] - x[1]),
      unknown,
    };
  })();
  // First time the sensor list becomes non-empty, seed the filter with
  // everything selected so nothing gets accidentally excluded.
  if (!sensorFilterInitialised && (availableSensors.list.length > 0 || availableSensors.unknown > 0)) {
    const initial = new Set<string>();
    for (const [k] of availableSensors.list) initial.add(k);
    if (availableSensors.unknown > 0) initial.add("__unknown__");
    setSensorFilter(initial);
    setSensorFilterInitialised(true);
  }
  const toggleSensor = (k: string) => {
    const next = new Set(sensorFilter);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSensorFilter(next);
  };
  const selectAllSensors = () => {
    const next = new Set<string>();
    for (const [k] of availableSensors.list) next.add(k);
    if (availableSensors.unknown > 0) next.add("__unknown__");
    setSensorFilter(next);
  };
  const selectNoSensors = () => setSensorFilter(new Set(["__none__"]));

  const doAnalyze = async () => {
    setAnalyzing(true);
    setDoneCount(0);
    setRides([]);
    setSelectedIdx(0);
    setViewTab("overview");
    setHierResult(null);
    setHierError(null);
    const MAX_NRMSE = maxNrmse >= 100 ? 999 : maxNrmse / 100;
    const crr = crrFixed ? parseFloat(crrFixed.replace(",", ".")) : undefined;
    // Use the position-preset prior for each ride — the adaptive prior
    // (max(1, σ_Hess/σ_prior)) keeps it soft when data are informative and
    // ramps it up only when the data can't separate CdA from Crr. This
    // replaces the previous "disable_prior=true on multi-rides" workaround,
    // which left noisy rides to hit the physical bounds.
    const posP = POSITION_PRESETS_BY_BIKE[bikeType][positionIdx];
    const priorMean = posP?.cdaPrior && posP.cdaPrior > 0 ? posP.cdaPrior : undefined;
    const priorSigma = posP?.cdaSigma && posP.cdaSigma > 0 ? posP.cdaSigma : undefined;
    const cacheOpts: CacheOpts = {
      mass_kg: mass, crr_fixed: crr, bike_type: bikeType,
      cda_prior_mean: priorMean,
      cda_prior_sigma: priorSigma,
      disable_prior: false,
    };
    const { minCda: MIN_CDA, maxCda: MAX_CDA } = BIKE_TYPE_CONFIG[bikeType];

    // Record the full session context in the backend log so the analyst
    // post-hoc knows exactly which filters and profile were used for
    // every ANALYZE line that follows.
    const activeProf = profile;
    await logAnalysisSession({
      profile_key: activeProf?.id ? `intervals:${activeProf.id}` : `intervals:${athleteId}`,
      profile_name: activeProf?.name,
      mode: "intervals",
      mass_kg: mass,
      bike_type: bikeType,
      position_label: posP?.label,
      crr_fixed: crr ?? null,
      cda_prior_mean: priorMean ?? null,
      cda_prior_sigma: priorSigma ?? null,
      max_nrmse: MAX_NRMSE,
      oldest, newest,
      min_distance_km: filters.min_distance_km,
      max_distance_km: filters.max_distance_km,
      max_elevation_m: filters.max_elevation_m,
      max_elevation_per_km: filters.max_elevation_per_km,
      min_duration_h: filters.min_duration_h,
      exclude_group: excludeGroup,
      n_candidates: baseFiltered.length,
      n_selected: filteredActivities.length,
      sensor_filter:
        sensorFilter.size > 0 &&
        sensorFilter.size < availableSensors.list.length + (availableSensors.unknown > 0 ? 1 : 0)
          ? Array.from(sensorFilter)
          : null,
      // UI-level filters that shape the aggregate — included in the
      // session log so a future reader can reproduce the exact view the
      // user was looking at.
      min_confidence: minConfidence,
      use_cache: useCache,
    });

    // Confidence-based exclusion (P3). When the user asks for a minimum
    // solver agreement, rides with insufficient confidence are excluded
    // from the aggregate. "unknown" means the cross-check is not
    // meaningful (e.g. a solver hit a physical bound so the agreement
    // is an artefact of the bound, not a real signal) — we treat it as
    // "at least as bad as low" when the filter is active, because the
    // ride carries no reliable cross-check information.
    const confidenceExcludes = (conf: string | undefined): boolean => {
      if (minConfidence === "off") return false;
      if (!conf) return false; // legacy entries without cross-check
      if (minConfidence === "medium") return conf === "low" || conf === "unknown";
      if (minConfidence === "high") return conf === "low" || conf === "medium" || conf === "unknown";
      return false;
    };

    const results: RideResult[] = [];
    for (let i = 0; i < filteredActivities.length; i++) {
      const act = filteredActivities[i];
      const fromCache = useCache ? getCachedInterval(act.id, cacheOpts) : null;
      if (fromCache) {
        const nrmse = (fromCache.rmse_w || 0) / Math.max(fromCache.avg_power_w, 1);
        const qBad = isHardFailure(fromCache.quality_status);
        const confBad = confidenceExcludes(fromCache.solver_confidence);
        results.push({ activity: act, result: fromCache, excluded: !!qBad || confBad || nrmse > MAX_NRMSE || fromCache.cda < MIN_CDA || fromCache.cda > MAX_CDA });
      } else {
        try {
          const res = await analyzeRide(apiKey, athleteId, act.id, mass, crr, bikeType, priorMean, priorSigma, false);
          const nrmse = (res.rmse_w || 0) / Math.max(res.avg_power_w, 1);
          const qBad = isHardFailure(res.quality_status);
          const confBad = confidenceExcludes(res.solver_confidence);
          results.push({ activity: act, result: res, excluded: !!qBad || confBad || nrmse > MAX_NRMSE || res.cda < MIN_CDA || res.cda > MAX_CDA });
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

    // Hierarchical (Method B) joint analysis on the good rides — runs in parallel
    // with history save so the user can see Method A immediately.
    let hierPromise: Promise<HierarchicalAnalysisResult | null> = Promise.resolve(null);
    if (good.length >= 2) {
      setHierLoading(true);
      hierPromise = analyzeBatchIntervals(
        apiKey,
        athleteId,
        good.map((r) => r.activity.id),
        mass,
        crr,
        bikeType,
        priorMean,
        priorSigma,
      )
        .then((r) => {
          setHierResult(r);
          return r;
        })
        .catch((e) => {
          setHierError(e.message || String(e));
          return null;
        })
        .finally(() => setHierLoading(false));
    }

    // Save to history
    if (good.length > 0) {
      const nrmses = good.map((r) => Math.max((r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1), 0.01));
      const bestN = Math.min(...nrmses), worstN = Math.max(...nrmses), span = worstN - bestN;
      const weights: number[] = [];
      let tw = 0, sc = 0, sr = 0, sp = 0, sRho = 0, sRmse = 0;
      for (let j = 0; j < good.length; j++) {
        const res = good[j].result!;
        const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
        const w = Math.max(res.valid_points, 1) * qw;
        weights.push(w);
        tw += w; sc += res.cda * w; sr += res.crr * w; sp += res.avg_power_w * w; sRho += res.avg_rho * w; sRmse += (res.rmse_w || 0) * w;
      }
      const hCda = sc / tw, hCrr = sr / tw;
      let hLow: number | null = null, hHigh: number | null = null;
      if (good.length >= 2) {
        // B5 — weighted variance so the IC95 is consistent with the weighted
        // mean. The old code used an unweighted sum and divided by cdas.length,
        // which gave a short ride the same weight as a long ride in the IC
        // width even though it had 100× less contribution to the mean.
        const cdas = good.map((r) => r.result!.cda);
        let wVar = 0;
        for (let j = 0; j < cdas.length; j++) wVar += weights[j] * (cdas[j] - hCda) ** 2;
        wVar /= tw;
        const se = Math.sqrt(wVar / cdas.length);
        hLow = hCda - 1.96 * se; hHigh = hCda + 1.96 * se;
      }
      const posP = POSITION_PRESETS_BY_BIKE[bikeType][positionIdx];
      const hier = await hierPromise;

      // Summarise power meter + bike across the good rides — if they're all
      // the same sensor/bike, show its label; otherwise flag as "mixed".
      const pmLabelCounts = new Map<string, number>();
      const pmQualityCounts = new Map<string, number>();
      const biasRatios: number[] = [];
      const bikeCounts = new Map<string, { label: string; count: number }>();
      for (const r of good) {
        const lbl = r.result?.power_meter_display;
        if (lbl) pmLabelCounts.set(lbl, (pmLabelCounts.get(lbl) || 0) + 1);
        const q = r.result?.power_meter_quality;
        if (q) pmQualityCounts.set(q, (pmQualityCounts.get(q) || 0) + 1);
        const br = r.result?.power_bias_ratio;
        if (br != null && (r.result?.power_bias_n_points ?? 0) >= 60) biasRatios.push(br);
        const gid = r.result?.gear_id;
        if (gid) {
          const bl = r.result?.gear_name || `Vélo ${gid}`;
          const cur = bikeCounts.get(gid) || { label: bl, count: 0 };
          bikeCounts.set(gid, { label: bl, count: cur.count + 1 });
        }
      }
      const sortedLabels = [...pmLabelCounts.entries()].sort((a, b) => b[1] - a[1]);
      const powerMeterLabel =
        sortedLabels.length === 0
          ? undefined
          : sortedLabels.length === 1
            ? sortedLabels[0][0]
            : `Mixte (${sortedLabels.length} capteurs — principal : ${sortedLabels[0][0]})`;
      // Use the worst quality across rides as the summary (conservative)
      const qRank = { low: 0, medium: 1, unknown: 2, high: 3 } as Record<string, number>;
      const worstQuality =
        [...pmQualityCounts.keys()].sort((a, b) => qRank[a] - qRank[b])[0] as
          | "low" | "medium" | "unknown" | "high" | undefined;
      const medianBias =
        biasRatios.length > 0
          ? biasRatios.slice().sort((a, b) => a - b)[Math.floor(biasRatios.length / 2)]
          : undefined;
      const sortedBikes = [...bikeCounts.entries()].sort((a, b) => b[1].count - a[1].count);
      let bikeKey: string | undefined;
      let bikeLabel: string | undefined;
      if (sortedBikes.length === 1) {
        bikeKey = sortedBikes[0][0];
        bikeLabel = sortedBikes[0][1].label;
      } else if (sortedBikes.length > 1) {
        bikeKey = "mixed";
        bikeLabel = `Mixte (${sortedBikes.length} vélos)`;
      }

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
        maxNrmse: MAX_NRMSE,
        minConfidence,
        useCache,
        disablePrior: false,
        aggregationMethod: "inverse_var",
        hierarchicalMu: hier?.mu_cda,
        hierarchicalTau: hier?.tau,
        dateFrom: oldest,
        dateTo: newest,
        minDistanceKm: filters.min_distance_km,
        maxDistanceKm: filters.max_distance_km,
        maxElevationM: filters.max_elevation_m,
        maxElevationPerKm: filters.max_elevation_per_km,
        minDurationH: filters.min_duration_h,
        excludeGroup,
        powerMeterLabel,
        powerMeterQuality: worstQuality,
        powerBiasRatio: medianBias,
        athleteKey: profile?.id ? `intervals:${profile.id}` : `intervals:${athleteId}`,
        athleteName: profile?.name || `Intervals #${athleteId}`,
        bikeKey,
        bikeLabel,
        nRides: good.length,
        nExcluded: results.length - good.length,
        nTotalPoints: good.reduce((a, r) => a + (r.result?.valid_points || 0), 0),
        rideCdas: good.map((r) => ({
          date: r.result!.ride_date,
          cda: r.result!.cda,
          nrmse: (r.result!.rmse_w || 0) / Math.max(r.result!.avg_power_w, 1),
          biasRatio: r.result!.power_bias_ratio ?? undefined,
          powerMeter: r.result!.power_meter_display ?? undefined,
          chungCda: r.result!.chung_cda ?? undefined,
          solverCrossCheckDelta: r.result!.solver_cross_check_delta ?? undefined,
          solverConfidence: r.result!.solver_confidence,
          qualityStatus: r.result!.quality_status,
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
    // Inverse-variance weighted aggregation
    let totalW = 0, sumCda = 0, sumCrr = 0, sumPow = 0, sumRho = 0, sumRmse = 0;
    for (let j = 0; j < goodRides.length; j++) {
      const res = goodRides[j].result!;
      const qw = span > 0.001 ? 3.0 - 2.0 * (nrmses[j] - bestN) / span : 2.0;
      const ciWidth = (res.cda_ci_high || 0) - (res.cda_ci_low || 0);
      const sigma = ciWidth > 0 ? Math.max(ciWidth / 3.92, 0.001) : 0.05;
      const invVar = 1 / (sigma * sigma);
      const w = invVar * qw;
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

  // --- Profile integration --------------------------------------------------
  // `currentSettings` captures the form state for the "Save to profile"
  // button. `applySettings` applies a loaded profile's settings to the
  // form, overwriting every field that the profile defines (fields not
  // set in the profile keep their current value).
  const currentSettings = (): ProfileSettings => ({
    massKg: mass,
    bikeType,
    positionIdx,
    crrFixed: crrFixed && crrFixed !== "" ? parseFloat(crrFixed.replace(",", ".")) : null,
    maxNrmse,
    intervalsApiKey: apiKey,
    intervalsAthleteId: athleteId,
    intervalsFilters: {
      minDistanceKm: filters.min_distance_km,
      maxDistanceKm: filters.max_distance_km,
      maxElevationM: filters.max_elevation_m,
      maxElevationPerKm: filters.max_elevation_per_km,
      minDurationH: filters.min_duration_h,
      excludeGroup,
    },
  });

  const applySettings = (s: ProfileSettings) => {
    if (s.massKg != null) setMass(s.massKg);
    if (s.bikeType) setBikeType(s.bikeType);
    if (s.positionIdx != null) setPositionIdx(s.positionIdx);
    if (s.crrFixed != null) setCrrFixed(String(s.crrFixed));
    else if (s.crrFixed === null) setCrrFixed("");
    if (s.maxNrmse != null) setMaxNrmse(s.maxNrmse);
    if (s.intervalsApiKey != null) setApiKey(s.intervalsApiKey);
    if (s.intervalsAthleteId != null) setAthleteId(s.intervalsAthleteId);
    if (s.intervalsFilters) {
      setFilters({
        min_distance_km: s.intervalsFilters.minDistanceKm ?? filters.min_distance_km,
        max_distance_km: s.intervalsFilters.maxDistanceKm ?? filters.max_distance_km,
        max_elevation_m: s.intervalsFilters.maxElevationM ?? filters.max_elevation_m,
        max_elevation_per_km: s.intervalsFilters.maxElevationPerKm ?? filters.max_elevation_per_km,
        min_duration_h: s.intervalsFilters.minDurationH ?? filters.min_duration_h,
      });
      if (s.intervalsFilters.excludeGroup != null) setExcludeGroup(s.intervalsFilters.excludeGroup);
    }
    // Reset the connected profile so the user re-clicks "Se connecter" with
    // the (potentially new) credentials.
    setProfile(null);
  };

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

      <ProfilePicker
        currentSettings={currentSettings()}
        onLoad={applySettings}
        context="intervals"
      />

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
                <span className="text-teal font-semibold ml-1">{POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].label}</span>
                {POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].cdaPrior > 0 ? (
                  <span className="ml-1">(prior CdA ≈ {POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].cdaPrior})</span>
                ) : (
                  <span className="ml-1">(pas de prior — estimation libre)</span>
                )}
              </label>
              <input type="range" min={0} max={POSITION_PRESETS_BY_BIKE[bikeType].length - 1} step={1}
                value={positionIdx} onChange={(e) => setPositionIdx(parseInt(e.target.value))}
                className="w-full accent-teal" />
              <div className="flex justify-between text-[10px] text-muted mt-0.5">
                {POSITION_PRESETS_BY_BIKE[bikeType].map((p, i) => (
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

          {/* nRMSE threshold slider */}
          <div className="mt-3">
            <label className="block text-xs text-muted mb-1">
              Seuil qualité (nRMSE max) : <span className="text-teal font-mono font-semibold">{maxNrmse > 95 ? "désactivé (toutes)" : `${maxNrmse}%`}</span>
              <span className="ml-2">
                ({maxNrmse > 95 ? "aucun filtre qualité" : maxNrmse < 30 ? "très strict — peu de sorties retenues" : maxNrmse < 45 ? "strict" : maxNrmse < 60 ? "modéré" : "permissif — plus de sorties mais moins précis"})
              </span>
            </label>
            <input type="range" min={20} max={100} step={5} value={maxNrmse}
              onChange={(e) => setMaxNrmse(parseInt(e.target.value))}
              className="w-full accent-teal max-w-sm" />
            <div className="flex justify-between text-[10px] text-muted max-w-sm">
              <span>20% (strict)</span>
              <span>Toutes</span>
            </div>
          </div>

          {/* Solver confidence threshold (P3) */}
          <div className="mt-3">
            <label className="block text-xs text-muted mb-1">
              Accord wind_inverse ↔ Chung VE :{" "}
              <span className="text-teal font-mono font-semibold">
                {minConfidence === "off" ? "toutes (off)" : minConfidence === "medium" ? "exclure désaccord fort" : "garder uniquement accord élevé"}
              </span>
            </label>
            <div className="flex gap-1.5 max-w-sm">
              {(["off", "medium", "high"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMinConfidence(v)}
                  className={`flex-1 px-2 py-1 text-xs font-mono rounded border transition ${
                    minConfidence === v
                      ? "bg-teal/20 border-teal text-teal"
                      : "bg-panel border-border text-muted hover:border-teal/50"
                  }`}
                  title={
                    v === "off"
                      ? "Garder toutes les sorties, ne pas filtrer sur l'accord solveur"
                      : v === "medium"
                        ? "Exclure les sorties où |ΔCdA wind−chung| ≥ 0.05 (désaccord fort) ET les sorties où un solveur a touché une borne physique (cross-check non fiable)"
                        : "Garder uniquement les sorties où |ΔCdA wind−chung| < 0.02 (solveurs en accord) et aucun solveur à la borne"
                  }
                >
                  {v === "off" ? "off" : v === "medium" ? "≥ medium" : "high only"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-1 max-w-sm leading-tight">
              Chaque sortie est aussi analysée avec Chung VE comme contrôle.
              Quand les deux solveurs divergent sur CdA, la sortie est moins
              robuste au choix du traitement du vent. La comparaison utilise
              en priorité les valeurs "hors prior" pour détecter les cas où
              les deux solveurs convergent à la borne (accord artificiel).
              Filtre désactivé par défaut.
            </p>
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
              <div>
                <label className="block text-xs text-muted mb-1">
                  Pente moyenne max : <span className="text-teal font-mono">{filters.max_elevation_per_km ?? 999}</span> m/km
                  <span className="text-[10px] text-muted ml-1">
                    ({((filters.max_elevation_per_km ?? 0) / 10).toFixed(1)}% de pente moyenne)
                  </span>
                </label>
                <input type="range" min={2} max={15} step={1}
                  value={filters.max_elevation_per_km ?? 15}
                  onChange={(e) => setFilters({ ...filters, max_elevation_per_km: parseFloat(e.target.value) })}
                  className="w-full accent-teal" />
                <p className="text-[10px] text-muted mt-1 leading-tight">
                  Exclut les rides en montée : à pente forte, la traînée aéro est noyée dans la gravité et CdA devient non identifiable. 5 m/km (0.5%) = velodrome/route quasi plate ; 10 m/km (1%) = plat ondulé ; 15 m/km (1.5%) = vallonné léger.
                </p>
              </div>
              {listed && (availableSensors.list.length > 0 || availableSensors.unknown > 0) && (
                <div className="mt-2 bg-bg border border-border rounded p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted font-semibold">Filtrer par capteur de puissance :</span>
                    <div className="flex items-center gap-1 text-[9px]">
                      <button onClick={selectAllSensors} className="px-1.5 py-0.5 rounded border border-border hover:border-teal text-muted hover:text-teal">Tous</button>
                      <button onClick={selectNoSensors} className="px-1.5 py-0.5 rounded border border-border hover:border-coral text-muted hover:text-coral">Aucun</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSensors.list.map(([k, n]) => {
                      const checked = sensorFilter.has(k);
                      return (
                        <label key={k} className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-mono cursor-pointer ${
                          checked ? "bg-teal/10 border-teal text-teal" : "bg-panel border-border text-muted hover:border-muted"
                        }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSensor(k)} className="accent-teal scale-75" />
                          <span>{k}</span>
                          <span className="opacity-60">({n})</span>
                        </label>
                      );
                    })}
                    {availableSensors.unknown > 0 && (
                      <label className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-mono cursor-pointer ${
                        sensorFilter.has("__unknown__") ? "bg-muted/20 border-muted text-text" : "bg-panel border-border text-muted"
                      }`}>
                        <input type="checkbox" checked={sensorFilter.has("__unknown__")} onChange={() => toggleSensor("__unknown__")} className="accent-teal scale-75" />
                        <span>Capteur inconnu</span>
                        <span className="opacity-60">({availableSensors.unknown})</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
              {listed && (
                <div className="text-xs font-mono space-y-0.5 mt-2">
                  <p className="text-teal">
                    → {filteredActivities.length} rides correspondent aux filtres
                  </p>
                  {excludedByGrade > 0 && (
                    <p className="text-warn opacity-80">
                      ⓘ {excludedByGrade} ride{excludedByGrade > 1 ? "s" : ""} exclue{excludedByGrade > 1 ? "s" : ""} par "pente moyenne max" ({filters.max_elevation_per_km} m/km) — CdA non identifiable sur dénivelé élevé.
                    </p>
                  )}
                  {excludedBySensor > 0 && (
                    <p className="text-info opacity-80">
                      ⓘ {excludedBySensor} ride{excludedBySensor > 1 ? "s" : ""} exclue{excludedBySensor > 1 ? "s" : ""} par le filtre capteur.
                    </p>
                  )}
                </div>
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

              {/* Méthode hiérarchique (DerSimonian–Laird) banner */}
              {(hierLoading || hierResult || hierError) && (
                <div className="bg-panel border border-info/40 rounded-lg p-4">
                  <div className="text-xs text-muted uppercase tracking-wide flex items-center mb-2">
                    Méthode hiérarchique (DerSimonian–Laird)
                    <InfoTooltip text="Méta-analyse à effets aléatoires : chaque ride contribue son CdA_i avec son incertitude σ_i (Hessienne du fit Chung VE), puis l'estimateur DerSimonian–Laird combine ces estimations en agrégeant la variance inter-rides τ². Réf. DerSimonian & Laird (Controlled Clinical Trials, 1986), Higgins & Thompson (Stat. Med. 2002)." />
                  </div>
                  {hierLoading && (
                    <div className="flex items-center gap-2 text-muted text-sm">
                      <Loader2 className="animate-spin" size={14} />
                      Calcul de l'optimisation jointe (peut prendre plusieurs minutes)…
                    </div>
                  )}
                  {hierError && (
                    <div className="text-coral text-sm">Échec : {hierError}</div>
                  )}
                  {hierResult && (
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <div className="text-xs text-muted">μ CdA</div>
                        <div className="text-xl font-mono text-info">
                          {hierResult.mu_cda.toFixed(3)}
                          <span className="text-xs text-muted font-normal ml-2">
                            IC95 [{hierResult.mu_cda_ci_low.toFixed(3)} – {hierResult.mu_cda_ci_high.toFixed(3)}]
                          </span>
                        </div>
                        {aggCda !== null && Math.abs(hierResult.mu_cda - aggCda) > 0.001 && (
                          <div className="text-xs text-muted mt-0.5">
                            Δ vs inverse-variance : {(hierResult.mu_cda - aggCda >= 0 ? "+" : "")}{(hierResult.mu_cda - aggCda).toFixed(4)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted">Crr partagé</div>
                        <div className="text-xl font-mono text-info">{hierResult.crr.toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">τ (variance inter-rides)</div>
                        <div className="text-xl font-mono text-muted">±{hierResult.tau.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted flex items-center">
                          N rides
                          <InfoTooltip text="N = nombre de rides dans la méta-analyse. n_eff = effective sample size après pondération random-effects (Σwᵢ)²/Σwᵢ². Si n_eff << N, l'estimation est dominée par quelques rides (σ_i petits)." />
                        </div>
                        <div className="text-xl font-mono text-muted">
                          {hierResult.n_rides}
                          {typeof hierResult.n_eff === "number" && hierResult.n_eff > 0 && (
                            <span className="text-xs text-muted font-normal ml-2">
                              (n_eff = {hierResult.n_eff.toFixed(1)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    const bikeBounds = BIKE_TYPE_CONFIG[bikeType];
                    const nrmseCutoff = maxNrmse >= 100 ? 9.99 : maxNrmse / 100;
                    let reason = "";
                    let nrmseVal = 0;
                    // exclusionCategory drives the chip colour so the user
                    // can see at a glance what kind of problem dominated:
                    //   "fit"   = nRMSE too high / model couldn't fit (red)
                    //   "phys"  = CdA outside physical bounds (orange)
                    //   "noisy" = solver bound-pegged or low confidence (yellow)
                    //   "data"  = error / missing result (slate)
                    let exclusionCategory: "fit" | "phys" | "noisy" | "data" | null = null;
                    if (r.error) {
                      reason = `Erreur : ${r.error}`;
                    } else if (r.result) {
                      nrmseVal = (r.result.rmse_w || 0) / Math.max(r.result.avg_power_w, 1);
                      reason = `${r.activity.name}\nCdA ${r.result.cda.toFixed(3)} • nRMSE ${(nrmseVal*100).toFixed(0)}% • ±${r.result.rmse_w.toFixed(0)}W`;
                      if (r.result.cda_raw != null && Math.abs(r.result.cda_raw - r.result.cda) > 0.02) {
                        reason += `\nCdA hors prior (vent+Crr régularisés) : ${r.result.cda_raw.toFixed(3)}`;
                      }
                      if ((r.result.prior_adaptive_factor ?? 1) > 1.05) {
                        reason += `\nPrior renforcé ×${(r.result.prior_adaptive_factor ?? 1).toFixed(1)}`;
                      }
                      if (r.result.power_meter_display) {
                        reason += `\nCapteur : ${r.result.power_meter_display}`;
                        if (r.result.power_meter_quality === "low") {
                          reason += " ⚠ mono-jambe ou calibration manquante";
                        }
                      }
                      if (r.result.solver_cross_check_delta != null && r.result.chung_cda != null) {
                        const d = r.result.solver_cross_check_delta;
                        const label = r.result.solver_confidence === "high" ? "accord solveurs"
                                    : r.result.solver_confidence === "medium" ? "désaccord léger"
                                    : r.result.solver_confidence === "low" ? "désaccord fort"
                                    : "non fiable (solveur à la borne)";
                        reason += `\nCross-check Chung VE: ${r.result.chung_cda.toFixed(3)} (Δ=${d.toFixed(3)} — ${label})`;
                        if (r.result.chung_cda_raw != null) {
                          reason += `\n  Chung hors prior: ${r.result.chung_cda_raw.toFixed(3)}`;
                        }
                      }
                      // Soft quality warning (doesn't exclude by itself):
                      // show it as a contextual note BEFORE the exclusion
                      // block so the user understands the ride's flags
                      // without confusing the tooltip's "reste comptée"
                      // language with the hard exclusion from another rule.
                      const _softStatuses = new Set([
                        "prior_dominated",
                        "sensor_miscalib_warn",
                        "model_mismatch_warn",
                        "insufficient_data",
                        "weak_estimate",
                      ]);
                      if (r.result.quality_status && _softStatuses.has(r.result.quality_status)) {
                        const label = r.result.quality_status === "prior_dominated"
                          ? "prior dominé"
                          : r.result.quality_status === "sensor_miscalib_warn"
                            ? "biais capteur modéré"
                            : r.result.quality_status === "model_mismatch_warn"
                              ? "modèle physique imparfait (vent API ou position inhabituelle)"
                              : r.result.quality_status === "weak_estimate"
                                ? "estimation peu précise (σ_CdA élevée)"
                                : "trop de points filtrés";
                        reason += `\nⓘ Signalement : ${label}`;
                      }
                      // Exhaustive exclusion explanation: enumerate every
                      // cause that contributes to the red chip so the user
                      // doesn't have to guess why a ride was dropped.
                      // Only include quality_reason for HARD statuses —
                      // soft statuses (sensor_miscalib_warn, prior_dominated,
                      // insufficient_data) explicitly say "reste comptée
                      // dans l'agrégat" in their message and must never be
                      // presented as an exclusion cause.
                      if (isBad) {
                        const causes: string[] = [];
                        const SOFT_STATUSES = new Set([
                          "ok",
                          "prior_dominated",
                          "sensor_miscalib_warn",
                          "model_mismatch_warn",
                          "insufficient_data",
                          "weak_estimate",
                        ]);
                        const isHardStatus = r.result.quality_status
                          && !SOFT_STATUSES.has(r.result.quality_status);
                        if (isHardStatus && r.result.quality_reason) {
                          causes.push(r.result.quality_reason);
                        }
                        if (nrmseVal > nrmseCutoff) {
                          causes.push(`nRMSE ${(nrmseVal*100).toFixed(0)}% > seuil ${maxNrmse}% (slider qualité)`);
                        }
                        if (r.result.cda < bikeBounds.minCda) {
                          causes.push(`CdA ${r.result.cda.toFixed(3)} < borne basse ${bikeBounds.minCda} (hors plage physique ${bikeBounds.label})`);
                        }
                        if (r.result.cda > bikeBounds.maxCda) {
                          causes.push(`CdA ${r.result.cda.toFixed(3)} > borne haute ${bikeBounds.maxCda} (hors plage physique ${bikeBounds.label})`);
                        }
                        if (minConfidence !== "off" && r.result.solver_confidence) {
                          const c = r.result.solver_confidence;
                          const triggers = minConfidence === "medium"
                            ? (c === "low" || c === "unknown")
                            : (c === "low" || c === "medium" || c === "unknown");
                          if (triggers) {
                            const label = c === "unknown"
                              ? 'non fiable (solveur à la borne)'
                              : `"${c}"`;
                            causes.push(`Confiance solveurs ${label} sous le seuil demandé "${minConfidence === "medium" ? "≥ medium" : "high only"}"`);
                          }
                        }
                        if (causes.length > 0) {
                          reason += `\n\n⚠ Exclue :\n  • ${causes.join("\n  • ")}`;
                        } else {
                          reason += `\n\n⚠ Exclue (raison non identifiée)`;
                        }
                        // Pick the dominant category — order by user-actionability:
                        // physical bound first (most diagnostic), then noisy
                        // solvers, then nRMSE fit failure, then quality_status.
                        if (r.result.cda < bikeBounds.minCda || r.result.cda > bikeBounds.maxCda) {
                          exclusionCategory = "phys";
                        } else if (
                          r.result.quality_status === "bound_hit"
                          || r.result.quality_status === "non_identifiable"
                          || r.result.quality_status === "solvers_pegged"
                          || r.result.solver_confidence === "low"
                          || r.result.solver_confidence === "unknown"
                        ) {
                          exclusionCategory = "noisy";
                        } else if (nrmseVal > nrmseCutoff) {
                          exclusionCategory = "fit";
                        } else if (r.result.quality_status === "sensor_miscalib" || r.result.quality_status === "model_mismatch") {
                          exclusionCategory = "noisy";
                        } else {
                          exclusionCategory = "fit";
                        }
                      }
                    } else if (r.error) {
                      exclusionCategory = "data";
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
                            ? exclusionCategory === "phys"
                              ? "bg-orange-900/20 text-orange-400/70 line-through border border-orange-900/50"
                              : exclusionCategory === "noisy"
                                ? "bg-yellow-900/20 text-yellow-400/70 line-through border border-yellow-900/50"
                                : exclusionCategory === "data"
                                  ? "bg-slate-800/30 text-slate-400/70 line-through border border-slate-700"
                                  : "bg-red-900/20 text-red-400/60 line-through border border-red-900/40"
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
                            {(r.result.prior_adaptive_factor ?? 1) > 2.0 ? (
                              <span className="opacity-80 text-coral" title={`prior très fortement renforcé ×${(r.result.prior_adaptive_factor ?? 1).toFixed(1)} — données peu informatives`}>⚡⚡</span>
                            ) : (r.result.prior_adaptive_factor ?? 1) > 1.05 && (
                              <span className="opacity-70 text-warn" title="prior renforcé">⚡</span>
                            )}
                            {r.result.quality_status === "prior_dominated" && (
                              <span className="opacity-70 text-warn" title="résultat dominé par le prior — données peu informatives">ⓘ</span>
                            )}
                            {r.result.solver_confidence === "low" && (
                              <span
                                className="opacity-80 text-coral"
                                title={`solveurs en désaccord — wind=${r.result.cda.toFixed(3)} vs chung=${r.result.chung_cda?.toFixed(3) ?? "—"} (Δ=${(r.result.solver_cross_check_delta ?? 0).toFixed(3)})`}
                              >⚠</span>
                            )}
                            {r.result.solver_confidence === "medium" && (
                              <span
                                className="opacity-60 text-warn"
                                title={`solveurs en désaccord léger — Δ=${(r.result.solver_cross_check_delta ?? 0).toFixed(3)} (wind vs chung)`}
                              >≈</span>
                            )}
                            {r.result.solver_confidence === "unknown" && r.result.chung_cda != null && (
                              <span
                                className="opacity-70 text-muted"
                                title={`cross-check non fiable — un solveur a touché une borne physique (wind=${r.result.cda.toFixed(3)}, chung=${r.result.chung_cda.toFixed(3)})`}
                              >?</span>
                            )}
                          </>
                        )}
                        {isBad && r.result && <span className="opacity-40">{r.result.cda.toFixed(3)}</span>}
                        {isBad && !r.result && <span className="opacity-40">err.</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Retenue (cliquer → détail)
                  </span>
                  <span className="flex items-center gap-1" title="nRMSE trop élevé : le modèle physique ne reproduit pas la puissance mesurée">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Fit raté (nRMSE)
                  </span>
                  <span className="flex items-center gap-1" title="CdA estimé hors des bornes physiques pour ce type de vélo">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Hors plage physique
                  </span>
                  <span className="flex items-center gap-1" title="Solveur en désaccord, borne touchée, ou Hessienne mal conditionnée">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Solveur peu fiable
                  </span>
                  <span className="flex items-center gap-1" title="Erreur d'analyse — fichier corrompu ou pré-traitement échoué">
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-500" /> Erreur
                  </span>
                </div>
                <p className="text-[10px] text-muted mt-2 leading-relaxed">
                  Une sortie est exclue si nRMSE &gt; {maxNrmse}%, si le CdA estimé tombe hors
                  de [{BIKE_TYPE_CONFIG[bikeType].minCda}–{BIKE_TYPE_CONFIG[bikeType].maxCda} m²],
                  ou si le solveur tape une borne / est non-identifiable (Hessienne mal
                  conditionnée). Survolez une sortie exclue pour voir la raison exacte.
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
