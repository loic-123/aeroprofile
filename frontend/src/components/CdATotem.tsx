/**
 * CdA Totem — compare the rider's CdA to a real-world object.
 * "Aerodynamically, you are a dolphin 🐬"
 */

import { useTranslation } from "react-i18next";

interface TotemEntry {
  maxCda: number;
  emoji: string;
  key: string;
}

const TOTEMS: TotemEntry[] = [
  { maxCda: 0.18, emoji: "🏎️", key: "t0" },
  { maxCda: 0.22, emoji: "🐧", key: "t1" },
  { maxCda: 0.26, emoji: "🦅", key: "t2" },
  { maxCda: 0.30, emoji: "🐬", key: "t3" },
  { maxCda: 0.34, emoji: "⚽", key: "t4" },
  { maxCda: 0.38, emoji: "🎿", key: "t5" },
  { maxCda: 0.42, emoji: "🦁", key: "t6" },
  { maxCda: 0.48, emoji: "🧱", key: "t7" },
  { maxCda: 0.55, emoji: "🐻", key: "t8" },
  { maxCda: 9.99, emoji: "🚪", key: "t9" },
];

function getTotem(cda: number): TotemEntry {
  for (const t of TOTEMS) {
    if (cda <= t.maxCda) return t;
  }
  return TOTEMS[TOTEMS.length - 1];
}

export default function CdATotem({ cda }: { cda: number }) {
  const { t } = useTranslation();
  const totem = getTotem(cda);
  return (
    <div className="bg-panel border border-border rounded-lg p-5 text-center">
      <div className="text-5xl mb-3">{totem.emoji}</div>
      <div className="text-lg font-bold">
        {t("totem.headline")}
      </div>
      <div className="text-2xl font-bold text-teal mt-1">
        {totem.emoji} {t(`totem.${totem.key}.name`)}
      </div>
      <p className="text-sm text-muted mt-2 max-w-md mx-auto">
        {t(`totem.${totem.key}.desc`)}
      </p>
      <div className="text-xs text-muted mt-3 font-mono">
        CdA = {cda.toFixed(3)} m²
      </div>
    </div>
  );
}
