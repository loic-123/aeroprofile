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
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { collection, stats } = useMemo(
    () => buildCdASegments(profile),
    [profile],
  );

  // Precompute bounds once per profile — avoids Math.min/max spread calls
  // at every effect run.
  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    const lats = profile.lat;
    const lons = profile.lon;
    if (!lats?.length || !lons?.length) return null;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (let i = 0; i < lats.length; i++) {
      if (lats[i] < minLat) minLat = lats[i];
      if (lats[i] > maxLat) maxLat = lats[i];
      if (lons[i] < minLon) minLon = lons[i];
      if (lons[i] > maxLon) maxLon = lons[i];
    }
    if (!Number.isFinite(minLon)) return null;
    return [[minLon, minLat], [maxLon, maxLat]];
  }, [profile]);

  // Create the map ONCE per container. Route data updates don't
  // tear-and-rebuild the map — we just patch the source.
  useEffect(() => {
    if (!ref.current || !bounds) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      bounds,
      fitBoundsOptions: { padding: 30, animate: false },
      // Performance knobs: cap zoom so dense vector tiles at z>15 aren't
      // requested, disable antialias (we don't have fine labels at
      // small-to-medium zooms) and let MapLibre drop expired tiles.
      maxZoom: 15,
      antialias: false,
      refreshExpiredTiles: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route-cda", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "route-invalid",
        type: "line",
        source: "route-cda",
        filter: ["!=", ["get", "valid"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3F3F46", "line-width": 2, "line-opacity": 0.6 },
      });

      map.addLayer({
        id: "route-cda",
        type: "line",
        source: "route-cda",
        filter: ["==", ["get", "valid"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-width": 3.5, "line-color": "#10B981" },
      });

      // Throttle mousemove with rAF so we don't trigger a React state
      // update on every native mousemove event (16 ms minimum between
      // updates on a 60 Hz display).
      let rafPending = false;
      let lastEvent: maplibregl.MapLayerMouseEvent | null = null;
      map.on("mousemove", ["route-cda", "route-invalid"], (e) => {
        lastEvent = e;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          const ev = lastEvent;
          lastEvent = null;
          if (!ev) return;
          const f = ev.features?.[0];
          if (!f) return;
          map.getCanvas().style.cursor = "crosshair";
          const props = f.properties as { cda: number | null; distance_km: number };
          setHover({
            cda: props.cda,
            distanceKm: props.distance_km,
            x: ev.point.x,
            y: ev.point.y,
          });
        });
      });
      const clearHover = () => {
        map.getCanvas().style.cursor = "";
        setHover(null);
      };
      map.on("mouseleave", "route-cda", clearHover);
      map.on("mouseleave", "route-invalid", clearHover);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Depend only on bounds *presence* — route data updates flow through
    // the next effect by patching the source, without tearing down the
    // WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds != null]);

  // Patch the route source + re-bind palette stops when the ride data
  // changes, without tearing down the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("route-cda") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(collection as any);
      if (map.getLayer("route-cda")) {
        map.setPaintProperty("route-cda", "line-color", [
          "interpolate",
          ["linear"],
          ["get", "cda"],
          stats.q10,
          "#10B981",
          stats.median,
          "#F59E0B",
          stats.q90,
          "#EF4444",
        ] as any);
      }
      if (bounds) {
        map.fitBounds(bounds, { padding: 30, animate: false });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [collection, stats, bounds]);

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
