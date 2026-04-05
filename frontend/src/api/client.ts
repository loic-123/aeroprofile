import type { AnalysisResult } from "../types";

export interface AnalyzeParams {
  file: File;
  mass_kg: number;
  crr_fixed?: number | null;
  eta?: number;
  wind_height_factor?: number;
}

export async function analyze(params: AnalyzeParams): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("file", params.file);
  fd.append("mass_kg", String(params.mass_kg));
  if (params.crr_fixed != null) fd.append("crr_fixed", String(params.crr_fixed));
  if (params.eta != null) fd.append("eta", String(params.eta));
  if (params.wind_height_factor != null)
    fd.append("wind_height_factor", String(params.wind_height_factor));

  const res = await fetch("/api/analyze", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
