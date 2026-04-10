/**
 * CdA and Crr reference tables with the rider's value highlighted
 * in the matching row.
 */

import InfoTooltip from "./InfoTooltip";

const CDA_RANGES: { label: string; low: number; high: number; desc: string }[] = [
  { label: "CLM pro (Superman)", low: 0.17, high: 0.20, desc: "Prolongateurs, dos plat, casque aéro" },
  { label: "CLM amateur", low: 0.20, high: 0.25, desc: "Prolongateurs, bras tendus" },
  { label: "Route, drops aéro", low: 0.25, high: 0.30, desc: "Drops, dos plat, bons réflexes aéro" },
  { label: "Route, cocottes", low: 0.30, high: 0.35, desc: "Position standard sur cocottes (hoods)" },
  { label: "Route, mains en haut", low: 0.35, high: 0.42, desc: "Buste relevé, mains sur le cintre" },
  { label: "Position droite / VTT", low: 0.42, high: 0.55, desc: "VTT, vélo ville, position très droite" },
];

const CRR_RANGES: { label: string; low: number; high: number; desc: string }[] = [
  { label: "Boyaux vélodrome", low: 0.002, high: 0.003, desc: "Piste, pression max, surface lisse" },
  { label: "Tubeless clincher, asphalte", low: 0.003, high: 0.004, desc: "GP5000 TL, Corsa, Pro One, etc." },
  { label: "Clincher standard", low: 0.004, high: 0.006, desc: "Pneu route classique avec chambre" },
  { label: "Asphalte dégradé", low: 0.006, high: 0.008, desc: "Route granuleuse, pavés, réparations" },
  { label: "Gravel / pneu large", low: 0.007, high: 0.010, desc: "Pneu ≥ 35 mm, chemin stabilisé" },
];

function RowHighlight({
  ranges,
  value,
  unit,
  fmt,
}: {
  ranges: typeof CDA_RANGES;
  value: number;
  unit: string;
  fmt: (v: number) => string;
}) {
  // Find matching range. Use [low, high) for all except last which uses [low, high]
  let match = ranges.findIndex((r, i) =>
    i === ranges.length - 1
      ? value >= r.low && value <= r.high
      : value >= r.low && value < r.high
  );
  // If no exact match, find the closest range
  if (match === -1) {
    let minDist = Infinity;
    for (let i = 0; i < ranges.length; i++) {
      const mid = (ranges[i].low + ranges[i].high) / 2;
      const d = Math.abs(value - mid);
      if (d < minDist) { minDist = d; match = i; }
    }
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wide">
          <th className="py-2 pr-2">Position / type</th>
          <th className="py-2 text-right">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {ranges.map((r, i) => {
          const active = i === match;
          return (
            <tr
              key={i}
              className={`border-b border-border/30 last:border-0 ${
                active ? "bg-teal/10" : ""
              }`}
            >
              <td className="py-1.5 pr-2">
                <span className={active ? "text-teal font-semibold" : "text-text"}>
                  {r.label}
                </span>
                {active && (
                  <span className="ml-2 text-xs bg-teal/20 text-teal px-1.5 py-0.5 rounded font-mono">
                    ← vous : {fmt(value)}
                  </span>
                )}
                <div className="text-xs text-muted">{r.desc}</div>
              </td>
              <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">
                {fmt(r.low)} – {fmt(r.high)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ReferenceTable({
  cda,
  crr,
}: {
  cda: number;
  crr: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center">
          Référence CdA (m²)
          <InfoTooltip text="Plages typiques de CdA issues de Debraux et al. 2011 et des mesures en soufflerie. Votre valeur est mise en évidence dans la plage correspondante. Le CdA dépend de la position sur le vélo, de la morphologie, et de l'équipement (casque, tenue)." />
        </h3>
        <p className="text-xs text-muted mb-3">
          Où se situe votre CdA par rapport aux positions de référence ?
        </p>
        <RowHighlight
          ranges={CDA_RANGES}
          value={cda}
          unit="CdA (m²)"
          fmt={(v) => v.toFixed(2)}
        />
      </div>

      <div className="bg-panel border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center">
          Référence Crr
          <InfoTooltip text="Plages typiques de coefficient de résistance au roulement. Dépend du pneu (modèle, pression, largeur), du revêtement, et de la température. Un Crr bas = pneu qui roule bien sur surface lisse." />
        </h3>
        <p className="text-xs text-muted mb-3">
          Où se situe votre Crr par rapport aux pneus/surfaces de référence ?
        </p>
        <RowHighlight
          ranges={CRR_RANGES}
          value={crr}
          unit="Crr"
          fmt={(v) => v.toFixed(3)}
        />
      </div>
    </div>
  );
}
