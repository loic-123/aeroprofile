# Test fixtures — expected results & context

## Riders

| Name | Mass (kg) | Expected aero (solo) | Notes |
|---|---|---|---|
| **Loic** | 76 | Most aero (CdA ~0.28–0.32) | Good drops/hoods position |
| **Yves** | 81 | Mid aero (CdA ~0.32–0.38) | Standard hoods |
| **Laurette** | 75 | Least aero (CdA ~0.38–0.48) | Relaxed/upright position |

**Expected ranking (solo, controlled conditions):**
`CdA_loic < CdA_yves < CdA_laurette`

## Files & reference results (2026-04-06)

### Same-ride pairs (gold standard for comparison)

#### Sud plat — Loic (76 kg) vs Yves (81 kg), 2026-04-05

| File | CdA | Crr | R² | RMSE | Method |
|---|---|---|---|---|---|
| `loic_sud_plat.fit` | 0.338 | 0.0050 | 0.98 | 76W | wind_inverse |
| `yves_sud_plat.fit` | 0.304 | 0.0050 | 0.98 | 76W | wind_inverse |

**Issue: ranking is INVERTED** — Yves appears more aero than Loic.
Cause: drafting asymmetry. Yves followed Loic's wheel more → lower
apparent CdA. The tool correctly models the physics (less air = less
drag) but cannot distinguish "actually aero" from "drafting someone
more aero". See drafting detection anomalies.

#### Nesque / Ventoux — Loic (76 kg) vs Yves (81 kg), 2026-04-04

| File | CdA | Crr | R² | RMSE | Method |
|---|---|---|---|---|---|
| `loic_nesque_ventoux.fit` | 0.350 | 0.0040 | 0.53 | 60W | chung_ve |
| `yves_nesque.fit` | 0.301 | 0.0037 | 0.51 | 57W | chung_ve |

**Issue: also inverted** — same drafting effect. Mountain rides with
linear heading → chung_ve fallback, R² ~0.5 (acceptable for mountains).

### Solo / independent rides

#### Bretagne — Loic (76 kg) vs Yves (81 kg), different dates

| File | CdA | Crr | R² | RMSE | Method | Date |
|---|---|---|---|---|---|---|
| `loic_bretagne.fit` | 0.395 | 0.0041 | 0.72 | 105W | wind_inverse | 2025-08-12 |
| `yves_bretagne.fit` | 0.378 | 0.0040 | 0.96 | 64W | wind_inverse | 2026-03-14 |

**Note**: Different dates → different wind conditions. CdA 0.39 vs 0.38
is within noise (not a meaningful difference). Loic's RMSE=105W is
high → suspect weather data quality on that date.

#### Loic Alpes (with Victor & Laurette) — Loic 76 kg, 2025-08-25

| File | CdA | Crr | R² | RMSE | Method |
|---|---|---|---|---|---|
| `loic_alpes_victor_laurette.fit` | 0.266 | 0.0040 | 0.50 | 41W | martin_ls |

CdA=0.27 is realistic for Loic solo on a mountain climb (drops, aero).
Low RMSE (41W) suggests good data quality despite mixed company.

#### Laurette — solo / mixed

| File | CdA | Crr | R² | RMSE | Method | Context |
|---|---|---|---|---|---|---|
| `laurette_valence.fit` | 0.454 | 0.0041 | 0.88 | 67W | wind_inverse | 4h endurance, relaxed |
| `laurette_cyclo_ain_draft.fit` | 0.395 | 0.0037 | 0.87 | 283W | wind_inverse | Cyclosportive, heavy drafting |

Valence: CdA=0.45 is realistic for Laurette in endurance upright position.
Cyclo-Ain: RMSE=283W is catastrophic → peloton drafting completely breaks
the model. CdA=0.40 is meaningless here.

## Key observations

1. **Drafting is the #1 confounder.** On every same-ride pair (sud_plat,
   nesque), the rider who drafted more has a lower apparent CdA. The
   expected ranking CdA_loic < CdA_yves is INVERTED because Yves drafted
   behind Loic.

2. **Solo rides give correct ordering.** Loic Alpes (0.27) < Yves Bretagne
   (0.38) < Laurette Valence (0.45) — matches the expected hierarchy.

3. **Mountain rides have lower R²** (~0.5 vs ~0.9 on flat) because of
   linear heading (no wind inverse possible) and altitude noise.

4. **Wind-inverse dramatically improves R²** on rides with heading variety:
   0.88–0.98 vs 0.50–0.53 without.

5. **Peloton rides are unusable** (Laurette Ain: RMSE=283W). The tool
   should detect and clearly flag this.

## What to fix

- Improve drafting detection to flag same-ride pairs explicitly.
- Consider a "solo segments only" filter that uses the power/speed ratio
  to exclude probable-drafting samples BEFORE the solver.
- On peloton rides, consider refusing to report a CdA rather than showing
  a misleading value with high RMSE.
