import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useTranslation } from "react-i18next";
import type { ProfileData } from "../types";
import { buildCdASegments } from "../lib/mapSegments";
import { MapCdALegend } from "./MapCdALegend";

interface HoverState {
  cda: number | null;
  distanceKm: number;
  x: number;
  y: number;
}

export default function MapView({ profile }: { profile: ProfileData }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const { collection, stats } = useMemo(
    () => buildCdASegments(profile),
    [profile],
  );

  useEffect(() => {
    if (!ref.current) return;
    if (collection.features.length === 0) return;

    const lats = profile.lat;
    const lons = profile.lon;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];

    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      bounds,
      fitBoundsOptions: { padding: 30 },
    });

    map.on("load", () => {
      map.addSource("route-cda", {
        type: "geojson",
        data: collection as any,
      });

      // Filtered / invalid segments — drawn in muted grey under the coloured
      // segments so the route still reads as a continuous shape.
      map.addLayer({
        id: "route-invalid",
        type: "line",
        source: "route-cda",
        filter: ["!=", ["get", "valid"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3F3F46", "line-width": 2, "line-opacity": 0.6 },
      });

      // Valid segments coloured by rolling CdA on a p10/p50/p90 gradient.
      map.addLayer({
        id: "route-cda",
        type: "line",
        source: "route-cda",
        filter: ["==", ["get", "valid"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-width": 3.5,
          "line-color": [
            "interpolate",
            ["linear"],
            ["get", "cda"],
            stats.q10,
            "#10B981",
            stats.median,
            "#F59E0B",
            stats.q90,
            "#EF4444",
          ],
        },
      });

      map.on("mousemove", ["route-cda", "route-invalid"], (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "crosshair";
        const props = f.properties as { cda: number | null; distance_km: number };
        setHover({
          cda: props.cda,
          distanceKm: props.distance_km,
          x: e.point.x,
          y: e.point.y,
        });
      });
      map.on("mouseleave", "route-cda", () => {
        map.getCanvas().style.cursor = "";
        setHover(null);
      });
      map.on("mouseleave", "route-invalid", () => {
        map.getCanvas().style.cursor = "";
        setHover(null);
      });
    });

    return () => map.remove();
  }, [collection, stats, profile]);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t("charts.mapTitle")}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
          {stats.count > 0 ? t("charts.mapSegments", { count: stats.count }) : t("charts.mapNoCda")}
        </span>
      </div>
      <div className="relative flex-1 min-h-[320px]">
        <div ref={ref} className="w-full h-full min-h-[320px] rounded overflow-hidden" />
        {hover && (
          <div
            className="pointer-events-none absolute bg-bg/95 border border-border rounded px-2 py-1 text-xs font-mono shadow-e2 whitespace-nowrap"
            style={{
              left: Math.min(hover.x + 12, 320),
              top: Math.max(hover.y - 30, 4),
            }}
          >
            <span className="text-muted">km </span>
            <span className="text-text">{hover.distanceKm.toFixed(1)}</span>
            <span className="text-muted ml-2">CdA </span>
            <span className={hover.cda == null ? "text-muted" : "text-accent"}>
              {hover.cda == null ? t("chartsLegend.cdaFiltered") : hover.cda.toFixed(3)}
            </span>
          </div>
        )}
      </div>
      <MapCdALegend stats={stats} />
    </div>
  );
}
