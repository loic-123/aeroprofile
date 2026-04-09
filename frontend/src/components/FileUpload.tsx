import { useState, useRef } from "react";
import { Upload, Loader2, ChevronDown, ChevronRight, FileText, X } from "lucide-react";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS, CRR_PRESETS, type BikeType } from "../types";

interface Props {
  onAnalyze: (
    files: File[],
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number; useCache?: boolean; bikeType?: BikeType; positionIdx?: number },
  ) => void;
  loading: boolean;
  error: string | null;
}

export default function FileUpload({ onAnalyze, loading, error }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [mass, setMass] = useState<number>(80);
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [positionIdx, setPositionIdx] = useState(2); // default: "Aéro (drops)"
  const [advanced, setAdvanced] = useState(false);
  const [eta, setEta] = useState(0.977);
  const [crrFixed, setCrrFixed] = useState<string>("");

  const handleBikeType = (bt: BikeType) => {
    setBikeType(bt);
  };
  const [windFactor, setWindFactor] = useState(0.7);
  const [useCache, setUseCache] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    const accepted = newFiles.filter((f) => /\.(fit|gpx|tcx)$/i.test(f.name));
    setFiles((prev) => [...prev, ...accepted]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const submit = () => {
    if (files.length === 0 || !mass) return;
    const crrVal = crrFixed ? parseFloat(crrFixed.replace(",", ".")) : 0;
    const crr = crrVal > 0 ? crrVal : null;
    onAnalyze(files, mass, { crr_fixed: crr, eta, wind_height_factor: windFactor, useCache, bikeType, positionIdx });
  };

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
        <p className="text-muted">
          Déposez un ou <strong>plusieurs</strong> fichiers .FIT / .GPX / .TCX
        </p>
        <p className="text-muted text-xs mt-1">
          Plusieurs sorties = résultat moyenné plus précis (les mauvaises sont
          exclues automatiquement)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.gpx,.tcx"
          multiple
          className="hidden"
          onChange={onSelect}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono bg-panel border border-border text-text"
            >
              <FileText size={11} />
              {f.name.length > 30 ? f.name.slice(0, 27) + "…" : f.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="text-muted hover:text-coral ml-1"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 bg-panel border border-border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold">Paramètres</h3>

        {/* Row 1: Mass + Bike type */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Masse totale (cycliste + vélo)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value))}
                className="w-full bg-bg border border-border rounded px-3 py-2 font-mono focus:outline-none focus:border-teal"
                min={30}
                max={200}
                step={0.1}
              />
              <span className="text-muted text-sm">kg</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Type de vélo</label>
            <div className="flex gap-1">
              {(Object.entries(BIKE_TYPE_CONFIG) as [BikeType, typeof BIKE_TYPE_CONFIG[BikeType]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleBikeType(key)}
                  title={cfg.description}
                  className={`flex-1 px-3 py-2 text-sm rounded transition ${
                    bikeType === key
                      ? "bg-teal text-white font-semibold"
                      : "bg-bg border border-border text-muted hover:text-text"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Crr preset + Position slider */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Pneus (Crr)</label>
            <select
              value={crrFixed}
              onChange={(e) => setCrrFixed(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-2 font-mono text-sm"
            >
              {CRR_PRESETS.map((p) => (
                <option key={p.crr} value={p.crr === 0 ? "" : String(p.crr)}>
                  {p.crr === 0 ? "Auto (estimé)" : `${p.crr.toFixed(4)} — ${p.label}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Position sur le vélo :
              <span className="text-teal font-semibold ml-1">{POSITION_PRESETS[positionIdx].label}</span>
              {POSITION_PRESETS[positionIdx].cdaPrior > 0 ? (
                <span className="ml-1">(prior CdA ≈ {POSITION_PRESETS[positionIdx].cdaPrior})</span>
              ) : (
                <span className="ml-1">(pas de prior — estimation libre)</span>
              )}
            </label>
            <input
              type="range"
              min={0}
              max={POSITION_PRESETS.length - 1}
              step={1}
              value={positionIdx}
              onChange={(e) => setPositionIdx(parseInt(e.target.value))}
              className="w-full accent-teal"
            />
            <div className="flex justify-between text-[10px] text-muted mt-0.5">
              {POSITION_PRESETS.map((p, i) => (
                <span
                  key={i}
                  className={`cursor-pointer ${i === positionIdx ? "text-teal font-semibold" : ""}`}
                  onClick={() => setPositionIdx(i)}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="flex items-center text-sm text-muted hover:text-text"
        >
          {advanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Options avancées
        </button>

        {advanced && (
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
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
            <div className="flex items-center gap-2">
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
                Cache local {useCache ? "(activé — résultats instantanés si déjà analysé)" : "(désactivé — re-analyse tout)"}
              </label>
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
        disabled={files.length === 0 || loading}
        className="mt-6 w-full bg-teal hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Analyse en cours…{" "}
            {files.length > 1 && `(${files.length} fichiers)`}
          </>
        ) : files.length > 1 ? (
          `Analyser ${files.length} sorties`
        ) : (
          "Analyser"
        )}
      </button>
    </div>
  );
}
