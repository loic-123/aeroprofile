export type BikeType = "road" | "tt" | "mtb";

export const BIKE_TYPE_CONFIG: Record<BikeType, { label: string; minCda: number; maxCda: number; defaultCrr: number; crrHint: string; description: string }> = {
  road: { label: "Route", minCda: 0.22, maxCda: 0.50, defaultCrr: 0.0033, crrHint: "GP5000 S TR / tubeless haut de gamme", description: "Vélo de route (drops → tops)" },
  tt: { label: "CLM / Triathlon", minCda: 0.15, maxCda: 0.32, defaultCrr: 0.0026, crrHint: "Tubulaire ou tubeless compétition, velodrome/lisse", description: "Prolongateurs / position aéro" },
  mtb: { label: "VTT / Gravel", minCda: 0.30, maxCda: 0.65, defaultCrr: 0.0060, crrHint: "Pneu 40mm+ sur terrain mixte", description: "Position relevée, pneus larges" },
};

export interface CrrPreset {
  label: string;
  crr: number;
}

export const CRR_PRESETS: CrrPreset[] = [
  { label: "Auto (estimé par le solveur)", crr: 0 },
  { label: "Tubulaire vélodrome", crr: 0.0022 },
  { label: "Tubeless compétition (GP5000 S TR, Pro One TLR)", crr: 0.0030 },
  { label: "Tubeless route (GP5000, Corsa)", crr: 0.0035 },
  { label: "Clincher standard (chambre butyl)", crr: 0.0045 },
  { label: "Endurance / training (4Season, Gatorskin)", crr: 0.0055 },
  { label: "Gravel 40mm (sentier compact)", crr: 0.0070 },
  { label: "VTT (terre / racines)", crr: 0.0100 },
];

export interface PositionPreset {
  label: string;
  cdaPrior: number;
  cdaSigma: number;
}

export const POSITION_PRESETS_BY_BIKE: Record<BikeType, PositionPreset[]> = {
  road: [
    { label: "Je ne sais pas", cdaPrior: 0, cdaSigma: 0 },
    { label: "Très aéro",        cdaPrior: 0.24, cdaSigma: 0.06 },
    { label: "Aéro (drops)",     cdaPrior: 0.30, cdaSigma: 0.08 },
    { label: "Modérée (cocottes)", cdaPrior: 0.34, cdaSigma: 0.08 },
    { label: "Relâchée (tops)",  cdaPrior: 0.40, cdaSigma: 0.10 },
  ],
  tt: [
    { label: "Je ne sais pas", cdaPrior: 0, cdaSigma: 0 },
    { label: "Pro (superman)",   cdaPrior: 0.18, cdaSigma: 0.03 },
    { label: "Aéro (prolongateurs)", cdaPrior: 0.21, cdaSigma: 0.04 },
    { label: "Modérée (hoods)",  cdaPrior: 0.25, cdaSigma: 0.05 },
    { label: "Relâchée",        cdaPrior: 0.29, cdaSigma: 0.05 },
  ],
  mtb: [
    { label: "Je ne sais pas", cdaPrior: 0, cdaSigma: 0 },
    { label: "Agressive (XC)",   cdaPrior: 0.35, cdaSigma: 0.06 },
    { label: "Modérée",         cdaPrior: 0.42, cdaSigma: 0.08 },
    { label: "Relâchée",        cdaPrior: 0.50, cdaSigma: 0.08 },
    { label: "Très droite",     cdaPrior: 0.55, cdaSigma: 0.10 },
  ],
};

// Backward compat
export const POSITION_PRESETS = POSITION_PRESETS_BY_BIKE.road;

export interface Anomaly {
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  message: string;
  value: number | null;
}

export interface ProfileData {
  distance_km: number[];
  altitude_real: number[];
  altitude_virtual: number[];
  cda_rolling: (number | null)[];
  power_measured: number[];
  power_modeled: number[];
  p_aero: number[];
  p_gravity: number[];
  p_rolling: number[];
  p_accel: number[];
  wind_speed_ms: number[];
  wind_dir_deg: number[];
  rho: number[];
  filter_valid: boolean[];
  filter_ve_valid?: boolean[];
  lat: number[];
  lon: number[];
}

export interface HierarchicalRideSummary {
  label: string;
  cda: number;
  cda_sigma: number;
  r_squared: number;
  nrmse: number;
  avg_power_w: number;
  avg_speed_kmh: number;
  valid_points: number;
  ride_date: string;
  excluded: boolean;
  exclusion_reason?: string;
}

export interface HierarchicalAnalysisResult {
  mu_cda: number;
  mu_cda_ci_low: number;
  mu_cda_ci_high: number;
  tau: number;
  crr: number;
  crr_ci_low: number;
  crr_ci_high: number;
  n_rides: number;
  n_points_total: number;
  rides: HierarchicalRideSummary[];
}

export interface AnalysisResult {
  cda: number;
  cda_ci_low: number;
  cda_ci_high: number;
  crr: number;
  crr_ci_low: number;
  crr_ci_high: number;
  r_squared: number;
  crr_was_fixed: boolean;
  solver_method: string;
  solver_note: string;
  quality_status?: "ok" | "bound_hit" | "non_identifiable" | "high_nrmse" | "prior_dominated";
  quality_reason?: string;
  prior_adaptive_factor?: number;
  cda_raw?: number | null;
  cda_raw_ci_low?: number | null;
  cda_raw_ci_high?: number | null;
  weather_source?: string;
  power_meter_raw?: string | null;
  power_meter_display?: string | null;
  power_meter_quality?: "high" | "medium" | "low" | "unknown";
  power_meter_warning?: string;
  power_bias_ratio?: number | null;
  power_bias_n_points?: number;
  cda_climb: number | null;
  cda_descent: number | null;
  cda_flat: number | null;
  heading_variance: number;
  rmse_w: number;
  mae_w: number;
  weather_ok: boolean;
  ride_date: string;
  ride_distance_km: number;
  ride_duration_s: number;
  ride_elevation_gain_m: number;
  avg_speed_kmh: number;
  avg_power_w: number;
  avg_rho: number;
  avg_wind_speed_ms: number;
  avg_wind_dir_deg: number;
  source_format: string;
  total_points: number;
  valid_points: number;
  filter_summary: Record<string, number>;
  anomalies: Anomaly[];
  profile: ProfileData;
}
