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
  lat: number[];
  lon: number[];
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
