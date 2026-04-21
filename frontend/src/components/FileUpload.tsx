import { useState, useRef, useEffect, useId } from "react";
import { Upload, Loader2, ChevronDown, ChevronRight, FileText, X } from "lucide-react";
import { BIKE_TYPE_CONFIG, POSITION_PRESETS_BY_BIKE, CRR_PRESETS, type BikeType } from "../types";
import { Button } from "./ui";

interface Props {
  onAnalyze: (
    files: File[],
    mass_kg: number,
    opts: { crr_fixed?: number | null; eta?: number; wind_height_factor?: number; useCache?: boolean; bikeType?: BikeType; positionIdx?: number; maxNrmse?: number; manual_wind_ms?: number; manual_wind_dir_deg?: number },
  ) => void;
  loading: boolean;
  error: string | null;
  /** Optional initial values from the active profile. The component uses
   *  them as the first useState() value, so forcing a re-mount (via a
   *  `key` prop on the parent) applies a freshly loaded profile. */
  initialMass?: number;
  initialBikeType?: BikeType;
  initialPositionIdx?: number;
  initialCrrFixed?: number | null;
  initialMaxNrmse?: number;
  /** Exposes the current form state to the parent so the "Save to profile"
   *  button can snapshot it without duplicating the state machine. */
  onSettingsChange?: (s: {
    mass: number;
    bikeType: BikeType;
    positionIdx: number;
    crrFixed: number | null;
    maxNrmse: number;
  }) => void;
}

export default function FileUpload({
  onAnalyze,
  loading,
  error,
  initialMass,
  initialBikeType,
  initialPositionIdx,
  initialCrrFixed,
  initialMaxNrmse,
  onSettingsChange,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [mass, setMass] = useState<number>(initialMass ?? 80);
  const [bikeType, setBikeType] = useState<BikeType>(initialBikeType ?? "road");
  const [positionIdx, setPositionIdx] = useState(initialPositionIdx ?? 2);
  const [advanced, setAdvanced] = useState(false);
  const [eta, setEta] = useState(0.977);
  const [crrFixed, setCrrFixed] = useState<string>(
    initialCrrFixed != null ? String(initialCrrFixed) : "0.0032",
  );

  const handleBikeType = (bt: BikeType) => {
    setBikeType(bt);
    const presets = POSITION_PRESETS_BY_BIKE[bt];
    if (positionIdx >= presets.length) setPositionIdx(0);
  };
  const [windFactor, setWindFactor] = useState(0.7);
  const [maxNrmse, setMaxNrmse] = useState(initialMaxNrmse ?? 45);
  // Optional manual wind override. Empty string = use Open-Meteo (default).
  const [manualWindKmh, setManualWindKmh] = useState<string>("");
  const [manualWindDir, setManualWindDir] = useState<string>("");

  useEffect(() => {
    if (!onSettingsChange) return;
    onSettingsChange({
      mass,
      bikeType,
      positionIdx,
      crrFixed: crrFixed && crrFixed !== "" ? parseFloat(crrFixed.replace(",", ".")) : null,
      maxNrmse,
    });
  }, [mass, bikeType, positionIdx, crrFixed, maxNrmse, onSettingsChange]);
  const [useCache, setUseCache] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generated ids for <label htmlFor> bindings. useId() gives stable,
  // SSR-safe ids that don't clash across multiple FileUpload instances.
  const massId = useId();
  const crrId = useId();
  const positionId = useId();
  const etaId = useId();
  const windId = useId();
  const nrmseId = useId();
  const cacheId = useId();
  const windKmhId = useId();
  const windDirId = useId();

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

  const openFileDialog = () => inputRef.current?.click();

  const onDropzoneKey = (e: React.KeyboardEvent) => {
    // Space / Enter on the drop zone opens the file dialog — matches
    // the behaviour a native <button> would have.
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      openFileDialog();
    }
  };

  const submit = () => {
    if (files.length === 0 || !mass) return;
    const crrVal = crrFixed ? parseFloat(crrFixed.replace(",", ".")) : 0;
    const crr = crrVal > 0 ? crrVal : null;
    const windKmh = manualWindKmh ? parseFloat(manualWindKmh.replace(",", ".")) : NaN;
    const windDir = manualWindDir ? parseFloat(manualWindDir.replace(",", ".")) : NaN;
    const manual_wind_ms = Number.isFinite(windKmh) && windKmh > 0 ? windKmh / 3.6 : undefined;
    const manual_wind_dir_deg = Number.isFinite(windDir) && windDir >= 0 && windDir <= 360 ? windDir : undefined;
    const bothOrNeither = manual_wind_ms != null && manual_wind_dir_deg != null;
    onAnalyze(files, mass, {
      crr_fixed: crr, eta, wind_height_factor: windFactor, useCache, bikeType, positionIdx,
      maxNrmse: maxNrmse >= 100 ? 999 : maxNrmse / 100,
      manual_wind_ms: bothOrNeither ? manual_wind_ms : undefined,
      manual_wind_dir_deg: bothOrNeither ? manual_wind_dir_deg : undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Drop zone: focusable, activates with click OR Space/Enter for
          keyboard users. role="button" gives AT users the right mental
          model. aria-label describes the action. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Déposer ou sélectionner des fichiers .FIT / .GPX / .TCX"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={openFileDialog}
        onKeyDown={onDropzoneKey}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
          dragging ? "border-primary bg-panel" : "border-border hover:border-muted"
        }`}
      >
        <Upload className="mx-auto mb-3 text-muted" size={32} aria-hidden />
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
          aria-label="Sélecteur de fichiers d'activité"
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="Fichiers sélectionnés">
          {files.map((f, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-mono bg-panel border border-border text-text"
            >
              <FileText size={11} aria-hidden />
              <span className="truncate max-w-[180px]">{f.name.length > 30 ? f.name.slice(0, 27) + "…" : f.name}</span>
              <button
                type="button"
                aria-label={`Retirer ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="text-muted hover:text-danger ml-1 transition-colors"
              >
                <X size={11} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 bg-panel border border-border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold">Paramètres</h3>

        {/* Row 1: Mass + Bike type */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          <div>
            <label htmlFor={massId} className="block text-xs text-muted mb-1">
              Masse totale (cycliste + vélo)
            </label>
            <div className="flex items-center gap-2">
              <input
                id={massId}
                type="number"
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value))}
                className="w-full bg-bg border border-border rounded px-3 py-2 font-mono focus:outline-none focus:border-primary"
                min={30}
                max={200}
                step={0.1}
                aria-describedby={`${massId}-unit`}
              />
              <span id={`${massId}-unit`} className="text-muted text-sm">kg</span>
            </div>
          </div>
          <div>
            <fieldset>
              <legend className="block text-xs text-muted mb-1">Type de vélo</legend>
              <div className="flex gap-1" role="radiogroup" aria-label="Type de vélo">
                {(Object.entries(BIKE_TYPE_CONFIG) as [BikeType, typeof BIKE_TYPE_CONFIG[BikeType]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={bikeType === key}
                    onClick={() => handleBikeType(key)}
                    title={cfg.description}
                    className={`flex-1 px-3 py-2 text-sm rounded transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-panel ${
                      bikeType === key
                        ? "bg-primary text-primary-fg font-semibold"
                        : "bg-bg border border-border text-muted hover:text-text"
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {/* Row 2: Crr preset + Position slider */}
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          <div>
            <label htmlFor={crrId} className="block text-xs text-muted mb-1">
              Pneus (Crr)
            </label>
            <select
              id={crrId}
              value={crrFixed}
              onChange={(e) => setCrrFixed(e.target.value)}
              className={`w-full bg-bg border rounded px-2 py-2 font-mono text-sm ${
                !crrFixed ? "border-warn/50" : "border-border"
              }`}
            >
              {CRR_PRESETS.map((p) => (
                <option key={p.crr} value={p.crr === 0 ? "" : String(p.crr)}>
                  {p.crr === 0 ? "Auto (estimé)" : `${p.crr.toFixed(4)} — ${p.label}`}
                </option>
              ))}
            </select>
            {!crrFixed && (
              <p className="text-[10px] text-warn mt-1">
                Fixer le Crr donne un CdA plus stable. Sélectionnez vos pneus si vous les connaissez.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={positionId} className="block text-xs text-muted mb-1">
              Position sur le vélo :
              <span className="text-primary font-semibold ml-1">{POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].label}</span>
              {POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].cdaPrior > 0 ? (
                <span className="ml-1">(prior CdA ≈ {POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].cdaPrior})</span>
              ) : (
                <span className="ml-1">(pas de prior — estimation libre)</span>
              )}
            </label>
            <input
              id={positionId}
              type="range"
              min={0}
              max={POSITION_PRESETS_BY_BIKE[bikeType].length - 1}
              step={1}
              value={positionIdx}
              onChange={(e) => setPositionIdx(parseInt(e.target.value))}
              className="w-full accent-primary"
              aria-valuetext={POSITION_PRESETS_BY_BIKE[bikeType][positionIdx].label}
            />
            <div className="flex justify-between text-[10px] text-muted mt-0.5">
              {POSITION_PRESETS_BY_BIKE[bikeType].map((p, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setPositionIdx(i)}
                  className={`cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-0.5 ${
                    i === positionIdx ? "text-primary font-semibold" : ""
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cache toggle — visible */}
        <div className="flex items-center gap-2">
          <button
            id={cacheId}
            type="button"
            role="switch"
            aria-checked={useCache}
            aria-label="Cache local des analyses"
            onClick={() => setUseCache(!useCache)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
              useCache ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-base ${
                useCache ? "translate-x-4" : ""
              }`}
              aria-hidden
            />
          </button>
          <label htmlFor={cacheId} className="text-xs text-muted select-none">
            Cache local {useCache ? "(activé)" : "(désactivé — re-analyse tout)"}
          </label>
        </div>

        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          aria-expanded={advanced}
          aria-controls="advanced-options"
          className="flex items-center text-sm text-muted hover:text-text transition-colors"
        >
          {advanced ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          Options avancées
        </button>

        {advanced && (
          <div id="advanced-options" className="mt-3 space-y-3 text-sm">
            <div>
              <label htmlFor={nrmseId} className="block text-xs text-muted mb-1">
                Seuil nRMSE max : <span className="text-primary font-mono font-semibold">{maxNrmse > 95 ? "désactivé (toutes)" : `${maxNrmse}%`}</span>
                <span className="ml-2 text-muted">
                  ({maxNrmse > 95 ? "aucun filtre qualité" : maxNrmse < 30 ? "très strict" : maxNrmse < 45 ? "strict" : maxNrmse < 60 ? "modéré" : "permissif"})
                </span>
              </label>
              <input id={nrmseId} type="range" min={20} max={100} step={5} value={maxNrmse}
                onChange={(e) => setMaxNrmse(parseInt(e.target.value))}
                className="w-full accent-primary"
                aria-valuetext={maxNrmse > 95 ? "désactivé" : `${maxNrmse}%`}
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>20% (strict)</span>
                <span>Toutes</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={etaId} className="block text-xs text-muted mb-1">η transmission</label>
                <input
                  id={etaId}
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
                <label htmlFor={windId} className="block text-xs text-muted mb-1">Facteur vent 10m→1m</label>
                <input
                  id={windId}
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
            <div>
              <p className="text-xs text-muted mb-1">
                Vent mesuré (optionnel, remplace Open-Meteo)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={windKmhId} className="block text-[10px] text-muted mb-0.5">
                    Vitesse au sol (km/h)
                  </label>
                  <input
                    id={windKmhId}
                    type="number"
                    inputMode="decimal"
                    value={manualWindKmh}
                    onChange={(e) => setManualWindKmh(e.target.value)}
                    placeholder="vide = API"
                    className="w-full bg-bg border border-border rounded px-2 py-1 font-mono"
                    step={1}
                    min={0}
                    max={150}
                  />
                </div>
                <div>
                  <label htmlFor={windDirId} className="block text-[10px] text-muted mb-0.5">
                    Direction d'où il vient (°, 0=N 90=E)
                  </label>
                  <input
                    id={windDirId}
                    type="number"
                    inputMode="decimal"
                    value={manualWindDir}
                    onChange={(e) => setManualWindDir(e.target.value)}
                    placeholder="vide = API"
                    className="w-full bg-bg border border-border rounded px-2 py-1 font-mono"
                    step={5}
                    min={0}
                    max={360}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted mt-1">
                Renseigne ces deux champs si le verdict affiche "vent fragile" ou si tu as une mesure fiable (station, Windy, Tempest). Laisse vide pour garder Open-Meteo.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 p-3 border border-danger bg-danger-subtle rounded text-danger text-sm"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        onClick={submit}
        disabled={files.length === 0}
        loading={loading}
        variant="primary"
        size="lg"
        className="mt-6 w-full"
      >
        {loading
          ? files.length > 1
            ? `Analyse en cours… (${files.length} fichiers)`
            : "Analyse en cours…"
          : files.length > 1
            ? `Analyser ${files.length} sorties`
            : "Analyser"}
      </Button>
    </div>
  );
}
