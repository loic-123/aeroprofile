/**
 * Cyclist posture illustration, picked by CdA bucket.
 *
 * Uses real icon sets from the Iconify CDN (loaded on demand, no npm dep):
 * - game-icons has excellent side-view cycling silhouettes
 * - mdi (Material Design) has a clean hoods-position bike
 * - fa6-solid has person-biking (upright position)
 * - noto-v1 has a detailed cyclist emoji
 *
 * Iconify serves the SVG on demand; nothing is bundled.
 */

import { useEffect } from "react";

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

interface Posture {
  name: string;
  description: string;
  icon: string;
}

function postureFromCda(cda: number): Posture {
  if (cda < 0.22)
    return {
      name: "CLM pro (Superman)",
      description: "Prolongateurs, dos plat, position CLM pro",
      // time trial tuck — cyclist fully horizontal
      icon: "game-icons:cycling",
    };
  if (cda < 0.26)
    return {
      name: "CLM amateur",
      description: "Prolongateurs, dos et bras tendus",
      icon: "game-icons:cycling",
    };
  if (cda < 0.33)
    return {
      name: "Route, mains en bas",
      description: "Mains en bas du cintre, dos modérément plat",
      icon: "mdi:bike-fast",
    };
  if (cda < 0.39)
    return {
      name: "Route, mains sur cocottes",
      description: "Position standard sur cocottes",
      icon: "mdi:bike",
    };
  if (cda < 0.46)
    return {
      name: "Route, position relevée",
      description: "Mains sur le haut du cintre, buste relevé",
      icon: "fa6-solid:person-biking",
    };
  return {
    name: "Position droite / VTT",
    description: "Position droite, type VTT ou vélo ville",
    icon: "tabler:bike",
  };
}

export default function PositionSchematic({ cda, label, size = 160 }: Props) {
  const posture = postureFromCda(cda);

  // Load the iconify-icon web component once.
  useEffect(() => {
    const id = "iconify-loader";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.src = "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js";
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center bg-bg border border-border rounded-lg"
        style={{ width: size, height: size }}
      >
        {/* @ts-expect-error iconify-icon is a custom element */}
        <iconify-icon
          icon={posture.icon}
          width={Math.floor(size * 0.72)}
          height={Math.floor(size * 0.72)}
          style={{ color: "#1D9E75" }}
        />
      </div>
      <div className="text-center mt-2 max-w-[200px]">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="text-sm font-semibold">{posture.name}</div>
        <div className="text-xs text-muted">{posture.description}</div>
      </div>
    </div>
  );
}
