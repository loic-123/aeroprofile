/**
 * CdA and Crr reference tables with the rider's value highlighted
 * in the matching row.
 */

import { useTranslation } from "react-i18next";
import InfoTooltip from "./InfoTooltip";

interface Range {
  keyBase: string;
  low: number;
  high: number;
}

const CDA_RANGES: Range[] = [
  { keyBase: "refTable.cda.r0", low: 0.17, high: 0.20 },
  { keyBase: "refTable.cda.r1", low: 0.20, high: 0.25 },
  { keyBase: "refTable.cda.r2", low: 0.25, high: 0.30 },
  { keyBase: "refTable.cda.r3", low: 0.30, high: 0.35 },
  { keyBase: "refTable.cda.r4", low: 0.35, high: 0.42 },
  { keyBase: "refTable.cda.r5", low: 0.42, high: 0.55 },
];

const CRR_RANGES: Range[] = [
  { keyBase: "refTable.crr.r0", low: 0.002, high: 0.003 },
  { keyBase: "refTable.crr.r1", low: 0.003, high: 0.004 },
  { keyBase: "refTable.crr.r2", low: 0.004, high: 0.006 },
  { keyBase: "refTable.crr.r3", low: 0.006, high: 0.008 },
  { keyBase: "refTable.crr.r4", low: 0.007, high: 0.010 },
];

function RowHighlight({
  ranges,
  value,
  unit,
  fmt,
}: {
  ranges: Range[];
  value: number;
  unit: string;
  fmt: (v: number) => string;
}) {
  const { t } = useTranslation();
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
          <th className="py-2 pr-2">{t("refTable.colPosition")}</th>
          <th className="py-2 text-right">{unit}</th>
          <th className="py-2 text-right pl-2">{t("refTable.colDelta")}</th>
        </tr>
      </thead>
      <tbody>
        {ranges.map((r, i) => {
          const active = i === match;
          const mid = (r.low + r.high) / 2;
          const delta = mid - value;
          const better = delta > 0;
          return (
            <tr
              key={i}
              className={`border-b border-border/30 last:border-0 ${
                active ? "bg-teal/10" : ""
              }`}
            >
              <td className="py-1.5 pr-2">
                <span className={active ? "text-teal font-semibold" : "text-text"}>
                  {t(`${r.keyBase}.label`)}
                </span>
                {active && (
                  <span className="ml-2 text-xs bg-teal/20 text-teal px-1.5 py-0.5 rounded font-mono">
                    {t("refTable.colYou", { value: fmt(value) })}
                  </span>
                )}
                <div className="text-xs text-muted">{t(`${r.keyBase}.desc`)}</div>
              </td>
              <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">
                {fmt(r.low)} – {fmt(r.high)}
              </td>
              <td
                className={`py-1.5 text-right font-mono whitespace-nowrap pl-2 text-xs ${
                  active ? "text-muted" : better ? "text-warn" : "text-accent"
                }`}
              >
                {active ? "—" : `${better ? "+" : ""}${fmt(delta)}`}
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
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center">
          {t("refTable.cdaTitle")}
          <InfoTooltip text={t("tooltips.cdaRefRanges")} />
        </h3>
        <p className="text-xs text-muted mb-3">
          {t("refTable.cdaLead")}
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
          {t("refTable.crrTitle")}
          <InfoTooltip text={t("tooltips.crrRefRanges")} />
        </h3>
        <p className="text-xs text-muted mb-3">
          {t("refTable.crrLead")}
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
