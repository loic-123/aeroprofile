import { useState, useRef } from "react";
import { Upload, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  onAnalyze: (
    file: File,
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number },
  ) => void;
  loading: boolean;
  error: string | null;
}

export default function FileUpload({ onAnalyze, loading, error }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [mass, setMass] = useState<number>(80);
  const [advanced, setAdvanced] = useState(false);
  const [eta, setEta] = useState(0.976);
  const [crrFixed, setCrrFixed] = useState<string>("");
  const [windFactor, setWindFactor] = useState(0.7);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const submit = () => {
    if (!file || !mass) return;
    const crr = crrFixed ? parseFloat(crrFixed) : null;
    onAnalyze(file, mass, { crr_fixed: crr, eta, wind_height_factor: windFactor });
  };

  const format = file ? file.name.split(".").pop()?.toUpperCase() : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
          dragging ? "border-teal bg-panel" : "border-border hover:border-muted"
        }`}
      >
        <Upload className="mx-auto mb-3 text-muted" size={32} />
        {file ? (
          <div>
            <p className="font-mono text-sm">{file.name}</p>
            <p className="text-muted text-xs mt-1">
              Format détecté : <span className="text-teal">{format}</span>
            </p>
          </div>
        ) : (
          <p className="text-muted">
            Déposez un fichier .FIT / .GPX / .TCX ou cliquez pour sélectionner
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.gpx,.tcx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <div className="mt-6 bg-panel border border-border rounded-lg p-5">
        <label className="block text-sm mb-1">
          Masse totale (cycliste + vélo) en kg
        </label>
        <input
          type="number"
          value={mass}
          onChange={(e) => setMass(parseFloat(e.target.value))}
          className="w-full bg-bg border border-border rounded px-3 py-2 font-mono focus:outline-none focus:border-teal"
          min={30}
          max={200}
          step={0.1}
        />

        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="mt-4 flex items-center text-sm text-muted hover:text-text"
        >
          {advanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Options avancées
        </button>

        {advanced && (
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs text-muted mb-1">η transmission</label>
              <input
                type="number"
                value={eta}
                onChange={(e) => setEta(parseFloat(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono"
                step={0.001}
                min={0.9}
                max={1.0}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Crr fixe (vide=auto)</label>
              <input
                type="text"
                value={crrFixed}
                onChange={(e) => setCrrFixed(e.target.value)}
                placeholder="auto"
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Facteur vent 10m→1m</label>
              <input
                type="number"
                value={windFactor}
                onChange={(e) => setWindFactor(parseFloat(e.target.value))}
                className="w-full bg-bg border border-border rounded px-2 py-1 font-mono"
                step={0.05}
                min={0.3}
                max={1.0}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 border border-coral bg-coral/10 rounded text-coral text-sm">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!file || loading}
        className="mt-6 w-full bg-teal hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Analyse en cours…
          </>
        ) : (
          "Analyser"
        )}
      </button>
    </div>
  );
}
