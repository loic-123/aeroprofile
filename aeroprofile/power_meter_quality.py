"""Power meter classification and quality warning.

The goal of this module is NOT to rate individual sensors finely, but to
flag the two failure modes that most damage CdA estimates:

1. **Single-side crank meters** (4iiii Precision, Stages left, etc.):
   measure one leg and double it. Left/right asymmetry is real and varies
   with fatigue, so the reported "total" power drifts even within a ride.
   Most of them also need manual calibration before every ride to track
   temperature drift — something typical users rarely do.

2. **Trainer-reported power** (Tacx, Wahoo, Elite, …): accuracy varies
   wildly between models and is often calibrated against a reference
   initially, then drifts.

Everything else (dual-side pedals, spiders, dual-side crank with auto-cal)
is treated as "high" — good enough that CdA variance between rides is
dominated by wind/position rather than the sensor.

The name reported by Intervals.icu comes from the FIT file's ANT+ product
string, which is a `{MANUFACTURER_UPPER} {product_id}` pair. Different
product_ids within the same manufacturer can represent different physical
products, so we match on the full string where possible and fall back to
manufacturer-level heuristics.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PowerMeterInfo:
    raw_name: str | None               # Exactly what Intervals.icu returned
    display: str                        # User-facing label
    category: str                       # "pedal_dual" | "spider" | "crank_left" | …
    quality: str                        # "high" | "medium" | "low" | "unknown"
    warning: str                        # "" if none, else explanation text


_SINGLE_SIDE_WARNING = (
    "**Capteur mono-jambe.** Le 4iiii Precision mesure uniquement la "
    "jambe gauche et double le résultat. Toute asymétrie gauche/droite "
    "(fatigue, montée, effort) rend la puissance reportée imprécise. "
    "Il nécessite aussi une **calibration zero-offset à chaque départ** "
    "pour compenser la dérive de température — sans ça, le CdA peut "
    "varier de ±0.05 m² d'une sortie à l'autre."
)

# Exact-match DB. Keys are the Intervals.icu `power_meter` strings as
# observed empirically. Grow this as new sensors show up.
KNOWN: dict[str, dict] = {
    # Favero — family of dual-side pedal meters (Duo, Pro MX, Pro RS-2 …)
    # Intervals doesn't distinguish the commercial model, only the ANT+ id.
    "FAVERO_ELECTRONICS 22": {
        "display": "Favero Assioma (Duo / Pro)",
        "category": "pedal_dual",
        "quality": "high",
        "warning": "",
    },
    "FAVERO_ELECTRONICS 12": {
        "display": "Favero bePro (1ère génération)",
        "category": "pedal_dual",
        "quality": "high",
        # Early bePro units shipped without auto-calibration, but a Favero
        # firmware update (mid-2018) added the same auto zero-offset logic
        # as the Assioma line. On an up-to-date unit, the bePro performs
        # essentially at Assioma level — we observed 88% ok-rate and
        # σ(CdA)=0.04 on a 17-ride subset, matching the Assioma 22 data.
        "warning": "",
    },
    # 4iiii Precision — single-side crank. Several product_ids seen in the wild.
    "_4IIIIS 25": {
        "display": "4iiii Precision (manivelle gauche)",
        "category": "crank_left",
        "quality": "low",
        "warning": _SINGLE_SIDE_WARNING,
    },
    "_4IIIIS 26": {
        "display": "4iiii Precision (manivelle gauche)",
        "category": "crank_left",
        "quality": "low",
        "warning": _SINGLE_SIDE_WARNING,
    },
    # Trainers (name varies)
    "VERSA_DESIGN 35": {
        "display": "VersaDesign (home trainer)",
        "category": "trainer",
        "quality": "medium",
        "warning": (
            "Capteur intégré à un home trainer. La précision dépend du modèle "
            "et de la calibration. Utile en indoor, moins adapté pour estimer "
            "le CdA sur une sortie outdoor."
        ),
    },
}


def classify_power_meter(raw_name: str | None) -> PowerMeterInfo:
    """Classify a power meter from the Intervals.icu `power_meter` string."""
    if not raw_name:
        return PowerMeterInfo(
            raw_name=None,
            display="Capteur inconnu",
            category="unknown",
            quality="unknown",
            warning=(
                "Capteur de puissance non identifié. Si votre CdA varie beaucoup "
                "d'une sortie à l'autre, cela peut venir d'un capteur imprécis : "
                "mesure mono-jambe, calibration manquante, ou trainer peu précis."
            ),
        )
    name = raw_name.strip()

    # Exact match first
    if name in KNOWN:
        k = KNOWN[name]
        return PowerMeterInfo(
            raw_name=name,
            display=k["display"],
            category=k["category"],
            quality=k["quality"],
            warning=k["warning"],
        )

    # Fuzzy fallback by manufacturer token
    u = name.upper()
    if "FAVERO" in u:
        return PowerMeterInfo(name, f"Favero {name.split(' ',1)[-1]}",
                              "pedal_dual", "high", "")
    if "4IIII" in u:
        return PowerMeterInfo(name, f"4iiii (probable mono-jambe) {name}",
                              "crank_left", "low", _SINGLE_SIDE_WARNING)
    if "STAGES" in u:
        return PowerMeterInfo(
            name, f"Stages {name}", "crank_maybe_left", "medium",
            "Capteur Stages : si modèle mono-jambe (gauche), la précision est "
            "limitée (voir 4iiii Precision pour les détails). Les modèles LR "
            "double-jambe sont fiables.",
        )
    if any(k in u for k in ("SRM", "QUARQ", "POWER2MAX", "ROTOR", "SRAM RED")):
        return PowerMeterInfo(name, f"Spider {name}", "spider", "high", "")
    if "GARMIN" in u and any(k in u for k in ("RALLY", "VECTOR")):
        return PowerMeterInfo(name, f"Garmin {name}", "pedal_dual", "high", "")
    if any(k in u for k in ("TACX", "WAHOO", "KICKR", "ELITE", "SARIS", "NEO", "VERSA")):
        return PowerMeterInfo(
            name, f"Home trainer {name}", "trainer", "medium",
            "Capteur de home trainer : précision variable selon le modèle. "
            "Moins adapté que des pédales à l'estimation d'un CdA outdoor.",
        )

    # Unknown manufacturer — neutral warning
    return PowerMeterInfo(
        raw_name=name,
        display=name,
        category="other",
        quality="unknown",
        warning=(
            f"Capteur non reconnu ({name}). Si votre CdA varie beaucoup "
            "d'une sortie à l'autre, c'est peut-être dû à un capteur mono-jambe "
            "ou à un manque de calibration."
        ),
    )
