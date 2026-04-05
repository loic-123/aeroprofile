import { useState } from "react";
import FileUpload from "./components/FileUpload";
import ResultsDashboard from "./components/ResultsDashboard";
import { analyze } from "./api/client";
import type { AnalysisResult } from "./types";
import { Wind } from "lucide-react";

export default function App() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (
    file: File,
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const r = await analyze({ file, mass_kg, ...opts });
      setResult(r);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Wind className="text-teal" size={24} />
        <h1 className="text-xl font-bold tracking-tight">AeroProfile</h1>
        <span className="text-muted text-sm ml-2">
          CdA / Crr depuis votre fichier d'activité
        </span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {!result && (
          <FileUpload onAnalyze={handleAnalyze} loading={loading} error={error} />
        )}
        {result && (
          <>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="mb-4 text-sm text-muted hover:text-text"
            >
              ← Nouvelle analyse
            </button>
            <ResultsDashboard result={result} />
          </>
        )}
      </main>
    </div>
  );
}
