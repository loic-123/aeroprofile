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
import { useTranslation } from "react-i18next";

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

interface Posture {
  key: string;
  icon: string;
}

function postureFromCda(cda: number): Posture {
  if (cda < 0.22) return { key: "ttPro", icon: "game-icons:cycling" };
  if (cda < 0.26) return { key: "ttAmateur", icon: "game-icons:cycling" };
  if (cda < 0.33) return { key: "roadDrops", icon: "mdi:bike-fast" };
  if (cda < 0.39) return { key: "roadHoods", icon: "mdi:bike" };
  if (cda < 0.46) return { key: "roadTops", icon: "fa6-solid:person-biking" };
  return { key: "upright", icon: "tabler:bike" };
}

export default function PositionSchematic({ cda, label, size = 160 }: Props) {
  const { t } = useTranslation();
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
        <div className="text-sm font-semibold">{t(`postureSchematic.${posture.key}.name`)}</div>
        <div className="text-xs text-muted">{t(`postureSchematic.${posture.key}.description`)}</div>
      </div>
    </div>
  );
}
