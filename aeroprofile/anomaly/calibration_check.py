"""Detect CdA/Crr anomalies that suggest power-meter calibration issues."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

import numpy as np

from aeroprofile.physics.power_model import power_model
from aeroprofile.physics.constants import ETA_DEFAULT

Severity = Literal["error", "warning", "info"]


@dataclass
class Anomaly:
    severity: Severity
    code: str
    title: str
    message: str
    value: float | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def detect_anomalies(
    cda: float,
    crr: float,
    cda_ci: tuple[float, float],
    residuals: np.ndarray,
    df,
    mass: float,
    eta: float = ETA_DEFAULT,
) -> list[Anomaly]:
    anomalies: list[Anomaly] = []
    valid = df[df["filter_valid"]].reset_index(drop=True)

    # 1. CdA out of range
    if cda < 0.15:
        anomalies.append(
            Anomaly(
                "error",
                "cda_too_low",
                "CdA physiquement impossible (trop bas)",
                f"CdA = {cda:.3f} m², alors qu'un coureur en position de CLM "
                "professionnel atteint ~0.18. Un CdA plus bas est physiquement "
                "improbable pour un cycliste seul. Causes probables : (1) votre "
                "capteur de puissance lit TROP HAUT (sur-calibré) — recalibrez-le "
                "(zero offset) ; (2) poids saisi trop élevé ; (3) beaucoup de "
                "drafting pendant la sortie.",
                value=cda,
            )
        )
    elif cda > 0.55:
        anomalies.append(
            Anomaly(
                "error",
                "cda_too_high",
                "CdA physiquement impossible (trop haut)",
                f"CdA = {cda:.3f} m², alors qu'une position très droite sur VTT "
                "est ~0.50. Un CdA plus haut est très improbable. Causes probables : "
                "(1) votre capteur lit TROP BAS (sous-calibré) — recalibrez-le ; "
                "(2) poids saisi TROP FAIBLE ; (3) freinages prolongés non filtrés ; "
                "(4) vent réel bien plus fort que les données météo API.",
                value=cda,
            )
        )

    # 2. Crr out of range
    if crr < 0.002:
        anomalies.append(
            Anomaly(
                "warning",
                "crr_too_low",
                "Crr anormalement bas",
                f"Crr = {crr:.4f}, en dessous des boyaux vélodrome (0.002–0.003). "
                "Ce n'est probablement pas réaliste : soit le solveur n'arrive pas "
                "à séparer CdA et Crr (pas assez de variété montée/plat), soit le "
                "modèle compense une autre erreur. Essayez de fixer Crr "
                "manuellement (options avancées) à une valeur typique (0.004 route).",
                value=crr,
            )
        )
    elif crr > 0.008:
        anomalies.append(
            Anomaly(
                "warning",
                "crr_too_high",
                "Crr élevé",
                f"Crr = {crr:.4f}, au-dessus d'un Crr route standard (0.004–0.006). "
                "Causes possibles : (1) pneus sous-gonflés (vérifiez la pression) ; "
                "(2) route très granuleuse ou dégradée ; (3) pneu VTT / gravel ; "
                "(4) le solveur compense une sous-estimation du CdA (drafting, "
                "vent de face non capturé par la météo API). Si la sortie était "
                "sur route lisse avec pneus bien gonflés, regardez plutôt la "
                "qualité du capteur de puissance.",
                value=crr,
            )
        )

    # 3. CI too wide
    ci_width = cda_ci[1] - cda_ci[0]
    if not np.isnan(ci_width) and ci_width > 0.10:
        anomalies.append(
            Anomaly(
                "warning",
                "cda_ci_wide",
                "Estimation imprécise",
                f"Intervalle de confiance 95% du CdA = {ci_width:.3f} m² de large. "
                "Les données ne permettent pas de mesurer le CdA avec précision. "
                "Pour améliorer : faites une sortie avec plus de segments longs à "
                "vitesse constante (>25 km/h, plat, pas de drafting), ou de plus "
                "longue durée.",
                value=ci_width,
            )
        )

    # 4. Residual bias
    mean_res = float(np.mean(residuals))
    if mean_res > 10:
        anomalies.append(
            Anomaly(
                "warning",
                "residual_bias_positive",
                "Biais positif des résidus",
                f"Le modèle prédit en moyenne ~{mean_res:.0f} W DE PLUS que ce "
                "que votre capteur a mesuré. Interprétation : soit le CdA réel "
                "est plus bas (vous êtes plus aéro que ce que le solveur pense), "
                "soit votre capteur sous-estime la puissance d'environ "
                f"{mean_res:.0f} W — pensez à le recalibrer avant la prochaine sortie.",
                value=mean_res,
            )
        )
    elif mean_res < -10:
        anomalies.append(
            Anomaly(
                "warning",
                "residual_bias_negative",
                "Biais négatif des résidus",
                f"Le modèle prédit en moyenne ~{abs(mean_res):.0f} W DE MOINS que "
                "ce que votre capteur a mesuré. Interprétation : soit votre CdA "
                "est plus élevé que ce que le solveur pense (position moins aéro), "
                "soit votre capteur surestime la puissance d'environ "
                f"{abs(mean_res):.0f} W.",
                value=mean_res,
            )
        )

    # 5. Temporal drift: CdA per quartile
    if len(valid) >= 80:
        try:
            q = np.array_split(valid, 4)
            cdas = []
            for sub in q:
                res = _quick_cda(sub, crr, mass, eta)
                if res is not None:
                    cdas.append(res)
            if len(cdas) == 4:
                drift = abs(cdas[3] - cdas[0]) / max(cdas[0], 1e-6)
                if drift > 0.15:
                    anomalies.append(
                        Anomaly(
                            "warning",
                            "cda_drift",
                            "CdA instable dans le temps",
                            f"Le CdA a dérivé de {drift*100:.0f}% entre le début "
                            f"(Q1 : {cdas[0]:.3f}) et la fin (Q4 : {cdas[3]:.3f}) "
                            "de la sortie. Causes possibles : (1) votre capteur "
                            "de puissance se décalibre à chaud (dérive thermique) ; "
                            "(2) changement de position (aéro vs relevé) ; "
                            "(3) changement de conditions (vent qui tourne, pluie) ; "
                            "(4) fatigue qui fait se relever le cycliste.",
                            value=drift,
                        )
                    )
        except Exception:
            pass

    # 6. Climb vs descent asymmetry
    climb = valid[valid["gradient"] > 0.01]
    desc = valid[valid["gradient"] < -0.01]
    if len(climb) > 30 and len(desc) > 30:
        cda_up = _quick_cda(climb, crr, mass, eta)
        cda_down = _quick_cda(desc, crr, mass, eta)
        if cda_up and cda_down:
            diff = abs(cda_up - cda_down) / max((cda_up + cda_down) / 2, 1e-6)
            if diff > 0.20:
                anomalies.append(
                    Anomaly(
                        "warning",
                        "climb_descent_asymmetry",
                        "Incohérence montée/descente",
                        f"Le CdA calculé diffère beaucoup en montée ({cda_up:.3f}) "
                        f"et en descente ({cda_down:.3f}), soit {diff*100:.0f}% "
                        "d'écart. Physiquement le CdA devrait être similaire "
                        "dans les deux cas. Causes probables : (1) votre poids "
                        "saisi est faux (fait pencher la gravité dans une "
                        "direction) ; (2) l'altitude GPS/baromètre est bruitée "
                        "ou en dérive ; (3) le rendement de transmission η est "
                        "mal réglé ; (4) freinages en descente non filtrés.",
                        value=diff,
                    )
                )

    # 7. Offset quantification if CdA anomaly
    if cda < 0.15 or cda > 0.55:
        typical_cda = 0.35
        typical_crr = 0.005
        p_model = power_model(
            valid["v_ground"].to_numpy(),
            valid["v_air"].to_numpy(),
            valid["gradient"].to_numpy(),
            valid["acceleration"].to_numpy(),
            mass,
            typical_cda,
            typical_crr,
            valid["rho"].to_numpy(),
            eta,
        )
        offset = float(np.mean(valid["power"].to_numpy() - p_model))
        anomalies.append(
            Anomaly(
                "info",
                "offset_estimate",
                "Offset probable du capteur",
                f"Offset estimé : {offset:+.0f}W. Avez-vous calibré votre capteur avant la sortie ?",
                value=offset,
            )
        )

    if not anomalies:
        anomalies.append(
            Anomaly(
                "info",
                "no_anomaly",
                "Aucune anomalie détectée",
                "Les valeurs CdA/Crr sont dans les plages attendues. Capteur cohérent.",
            )
        )
    return anomalies


def _quick_cda(df_subset, crr: float, mass: float, eta: float) -> float | None:
    """Fast CdA-only estimate on a subset, with Crr fixed."""
    from scipy.optimize import least_squares
    from aeroprofile.physics.power_model import residual_power

    if len(df_subset) < 10:
        return None

    V = df_subset["v_ground"].to_numpy()
    Va = df_subset["v_air"].to_numpy()
    g = df_subset["gradient"].to_numpy()
    a = df_subset["acceleration"].to_numpy()
    rho = df_subset["rho"].to_numpy()
    P = df_subset["power"].to_numpy()

    def res(x):
        return residual_power((x[0], crr), V, Va, g, a, mass, rho, P, eta)

    try:
        r = least_squares(res, x0=(0.35,), bounds=([0.10], [0.70]), method="trf")
        return float(r.x[0])
    except Exception:
        return None
