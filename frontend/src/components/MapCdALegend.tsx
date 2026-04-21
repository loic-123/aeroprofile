import type { CdASegmentStats } from "../lib/mapSegments";

export function MapCdALegend({ stats }: { stats: CdASegmentStats }) {
  if (stats.count === 0) return null;

  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="text-[10px] uppercase tracking-widest text-muted font-semibold shrink-0">
        CdA
      </div>
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background:
            "linear-gradient(90deg, #10B981 0%, #F59E0B 50%, #EF4444 100%)",
        }}
        aria-hidden
      />
      <div className="shrink-0 flex gap-3 font-mono text-[10px] text-muted">
        <span>{stats.q10.toFixed(2)}</span>
        <span>{stats.median.toFixed(2)}</span>
        <span>{stats.q90.toFixed(2)}</span>
      </div>
    </div>
  );
}
