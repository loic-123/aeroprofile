/**
 * Cyclist posture illustration, picked by CdA bucket.
 *
 * Primary source : custom PNGs under /public/positions/, generated with
 * Nano Banana (Gemini 2.5 Flash Image) for visual consistency with the
 * dark UI. Filenames are 1:1 with the posture key:
 *   /positions/tt-pro.png      /positions/tt-amateur.png
 *   /positions/road-drops.png  /positions/road-hoods.png
 *   /positions/road-tops.png   /positions/upright.png
 *
 * Fallback : if a PNG is missing (onError), the component falls back to
 * the matching Iconify icon so deployments that haven't yet copied the
 * assets still render something.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

interface Posture {
  key: string;
  // PNG filename under /public/positions/
  png: string;
  // Iconify fallback icon (loaded if the PNG is missing)
  icon: string;
}

function postureFromCda(cda: number): Posture {
  if (cda < 0.22) return { key: "ttPro", png: "tt-pro.png", icon: "game-icons:cycling" };
  if (cda < 0.26) return { key: "ttAmateur", png: "tt-amateur.png", icon: "game-icons:cycling" };
  if (cda < 0.33) return { key: "roadDrops", png: "road-drops.png", icon: "mdi:bike-fast" };
  if (cda < 0.39) return { key: "roadHoods", png: "road-hoods.png", icon: "mdi:bike" };
  if (cda < 0.46) return { key: "roadTops", png: "road-tops.png", icon: "fa6-solid:person-biking" };
  return { key: "upright", png: "upright.png", icon: "tabler:bike" };
}

export default function PositionSchematic({ cda, label, size = 160 }: Props) {
  const { t } = useTranslation();
  const posture = postureFromCda(cda);
  const [pngBroken, setPngBroken] = useState(false);

  // Load the iconify-icon web component once (used only if PNG is missing).
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
        className="flex items-center justify-center bg-bg border border-border rounded-lg overflow-hidden"
        style={{ width: size, height: size }}
      >
        {!pngBroken ? (
          <img
            src={`/positions/${posture.png}`}
            alt={t(`postureSchematic.${posture.key}.name`)}
            width={size}
            height={size}
            className="w-full h-full object-contain"
            onError={() => setPngBroken(true)}
          />
        ) : (
          /* @ts-expect-error iconify-icon is a custom element */
          <iconify-icon
            icon={posture.icon}
            width={Math.floor(size * 0.72)}
            height={Math.floor(size * 0.72)}
            style={{ color: "#1D9E75" }}
          />
        )}
      </div>
      <div className="text-center mt-2 max-w-[200px]">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="text-sm font-semibold">{t(`postureSchematic.${posture.key}.name`)}</div>
        <div className="text-xs text-muted">{t(`postureSchematic.${posture.key}.description`)}</div>
      </div>
    </div>
  );
}
