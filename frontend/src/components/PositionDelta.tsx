import { POSITION_PRESETS_BY_BIKE, BIKE_TYPE_CONFIG, type BikeType } from "../types";
import { useBlog } from "./BlogLayout";
import InfoTooltip from "./InfoTooltip";

interface Props {
  cda: number;
  bikeType: BikeType;
  positionIdx?: number;
}

export function PositionDelta({ cda, bikeType, positionIdx }: Props) {
  const blog = useBlog();
  const presets = POSITION_PRESETS_BY_BIKE[bikeType];
  const idx = positionIdx ?? 0;
  const preset = presets[idx];

  if (!preset || preset.cdaPrior <= 0) return null;

  const delta = cda - preset.cdaPrior;
  const pct = (delta / preset.cdaPrior) * 100;
  const better = delta < 0;
  const absDelta = Math.abs(delta);

  const aeroPresets = presets
    .filter((p) => p.cdaPrior > 0 && p.cdaPrior < preset.cdaPrior)
    .sort((a, b) => a.cdaPrior - b.cdaPrior);
  const nextAero = aeroPresets[0];
  const potentialGain = nextAero ? cda - nextAero.cdaPrior : null;

  const bikeLabel = BIKE_TYPE_CONFIG[bikeType].label.toLowerCase();

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted font-semibold flex items-center gap-1">
          Position de référence
          <InfoTooltip text="La référence est le prior bayésien utilisé par le solveur — pas une vérité terrain. Elle représente la valeur moyenne attendue pour cette position sur ce type de vélo, issue de la littérature (Debraux et al. 2011) et des mesures soufflerie." />
        </div>
        <div className="text-xs text-muted font-mono">
          {preset.label.toLowerCase()} · {bikeLabel}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 font-mono text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Ton CdA</div>
          <div className="text-text">{cda.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Référence</div>
          <div className="text-muted-strong">{preset.cdaPrior.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Δ</div>
          <div className={better ? "text-accent" : "text-warn"}>
            {better ? "-" : "+"}
            {absDelta.toFixed(3)}
            <span className="text-muted ml-1.5 text-xs">
              ({better ? "-" : "+"}
              {Math.abs(pct).toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {nextAero && potentialGain != null && potentialGain > 0 && (
        <div className="text-xs text-muted leading-relaxed border-t border-border/40 pt-2.5">
          Une position plus aéro comme{" "}
          <span className="text-text">{nextAero.label.toLowerCase()}</span> (réf.{" "}
          <span className="font-mono text-text">{nextAero.cdaPrior.toFixed(3)}</span>){" "}
          pourrait te faire gagner jusqu'à{" "}
          <span className="font-mono text-accent">{potentialGain.toFixed(3)} m²</span>{" "}
          - si ton corps suit.{" "}
          <button
            type="button"
            onClick={() => blog.go("bayesian-priors")}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
          >
            Pourquoi un prior ?
          </button>
        </div>
      )}
    </div>
  );
}
