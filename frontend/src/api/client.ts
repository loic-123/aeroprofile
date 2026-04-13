import type { AnalysisResult, HierarchicalAnalysisResult } from "../types";

export interface AnalyzeParams {
  file: File;
  mass_kg: number;
  crr_fixed?: number | null;
  eta?: number;
  wind_height_factor?: number;
  bike_type?: string;
  cda_prior_mean?: number;
  cda_prior_sigma?: number;
  disable_prior?: boolean;
}

export async function analyze(params: AnalyzeParams): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("file", params.file);
  fd.append("mass_kg", String(params.mass_kg));
  if (params.crr_fixed != null) fd.append("crr_fixed", String(params.crr_fixed));
  if (params.eta != null) fd.append("eta", String(params.eta));
  if (params.wind_height_factor != null)
    fd.append("wind_height_factor", String(params.wind_height_factor));
  if (params.bike_type) fd.append("bike_type", params.bike_type);
  if (params.disable_prior) fd.append("disable_prior", "true");
  if (params.cda_prior_mean && params.cda_prior_mean > 0 && !params.disable_prior)
    fd.append("cda_prior_mean", String(params.cda_prior_mean));
  if (params.cda_prior_sigma && params.cda_prior_sigma > 0 && !params.disable_prior)
    fd.append("cda_prior_sigma", String(params.cda_prior_sigma));

  const res = await fetch("/api/analyze", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AnalyzeBatchParams {
  files: File[];
  mass_kg: number;
  crr_fixed?: number | null;
  eta?: number;
  bike_type?: string;
  max_nrmse?: number;
}

export async function analyzeBatch(params: AnalyzeBatchParams): Promise<HierarchicalAnalysisResult> {
  const fd = new FormData();
  for (const f of params.files) fd.append("files", f);
  fd.append("mass_kg", String(params.mass_kg));
  if (params.crr_fixed != null) fd.append("crr_fixed", String(params.crr_fixed));
  if (params.eta != null) fd.append("eta", String(params.eta));
  if (params.bike_type) fd.append("bike_type", params.bike_type);
  if (params.max_nrmse != null) fd.append("max_nrmse", String(params.max_nrmse));

  const res = await fetch("/api/analyze-batch", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
