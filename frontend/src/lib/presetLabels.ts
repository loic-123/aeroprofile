import type { TFunction } from "i18next";
import {
  BIKE_TYPE_CONFIG,
  CRR_PRESETS,
  POSITION_PRESETS_BY_BIKE,
  type BikeType,
  type CrrPreset,
  type PositionPreset,
} from "../types";

/** UI helpers that turn a preset (or a persisted FR label) into a localised
 *  display string.
 *
 *  Why these exist: presets carry both a stable `key` (used in localStorage)
 *  and a FR `label` (legacy fallback). Components must NOT read `.label`
 *  directly when they render — they should call these helpers so the value
 *  flips between FR and EN with the user's language toggle.
 *
 *  History entries persisted before the i18n migration only have the FR
 *  label, no `key`. The helpers below also recognise the legacy strings
 *  and map them back to the canonical key, so old entries render correctly
 *  in both languages without any one-off migration script. */

const _BIKE_LEGACY_TO_KEY: Record<string, BikeType> = {
  // FR (canonical until 2026-04)
  "Route": "road",
  "CLM / Triathlon": "tt",
  "VTT / Gravel": "mtb",
  // EN equivalents (in case a future build flipped the canonical labels)
  "Road": "road",
  "TT / Triathlon": "tt",
  "MTB / Gravel": "mtb",
};

const _POSITION_LEGACY_TO_KEY: Record<string, string> = {
  // road
  "Très aéro": "veryAero",
  "Aéro (drops)": "aeroDrops",
  "Modérée (cocottes)": "moderateHoods",
  "Relâchée (tops)": "uprightTops",
  // tt
  "Pro (superman)": "proSuperman",
  "Aéro (prolongateurs)": "aeroBars",
  "Modérée (hoods)": "moderateHoods",
  "Relâchée": "upright",
  // mtb
  "Agressive (XC)": "aggressiveXC",
  "Modérée": "moderate",
  "Très droite": "veryUpright",
  // shared
  "Je ne sais pas": "unknown",
};

export function bikeTypeLabel(t: TFunction, bt: BikeType): string {
  return t(`bikeType.${bt}`, { defaultValue: BIKE_TYPE_CONFIG[bt].label });
}

export function positionLabel(t: TFunction, preset: PositionPreset | undefined | null): string {
  if (!preset) return "";
  return t(`position.${preset.key}`, { defaultValue: preset.label });
}

export function crrPresetLabel(t: TFunction, preset: CrrPreset): string {
  return t(`crrPreset.${preset.key}`, { defaultValue: preset.label });
}

/** Translate a legacy persisted FR label (history entries written before
 *  the i18n migration) back to a localised display string. Falls through
 *  to the input itself if no mapping is found, so post-migration entries
 *  (where `bikeKey` / `positionKey` are stored separately) and unknown
 *  custom strings still render. */
export function legacyBikeLabel(t: TFunction, label: string | undefined | null): string {
  if (!label) return "";
  const key = _BIKE_LEGACY_TO_KEY[label];
  return key ? t(`bikeType.${key}`, { defaultValue: label }) : label;
}

export function legacyPositionLabel(t: TFunction, label: string | undefined | null): string {
  if (!label) return "";
  const key = _POSITION_LEGACY_TO_KEY[label];
  return key ? t(`position.${key}`, { defaultValue: label }) : label;
}

/** Build the "Vélo X" / "Mixte (N vélos)" display string used by the
 *  Intervals batch path. Uses i18n keys so it switches with the locale. */
export function multiBikeLabel(t: TFunction, count: number): string {
  return t("bikeType.mixed", { count });
}

// Re-export presets so callers don't need a second import line.
export { BIKE_TYPE_CONFIG, CRR_PRESETS, POSITION_PRESETS_BY_BIKE };
