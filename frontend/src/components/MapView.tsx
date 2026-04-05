import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { ProfileData } from "../types";

export default function MapView({ profile }: { profile: ProfileData }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const coords: [number, number][] = [];
    for (let i = 0; i < profile.lat.length; i++) {
      coords.push([profile.lon[i], profile.lat[i]]);
    }
    if (coords.length === 0) return;

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
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1D9E75", "line-width": 3 },
      });
    });

    return () => map.remove();
  }, [profile]);

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Parcours</h3>
      <div ref={ref} className="w-full h-96 rounded overflow-hidden" />
    </div>
  );
}
