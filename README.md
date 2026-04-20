<div align="center">

# AeroProfile

**Estimate your cycling CdA from any ride. No velodrome. No protocol. Just upload a FIT file.**

[🚀 Try the live demo](https://aeroprofile.cc) · [📖 Methodology articles](https://aeroprofile.cc/#blog) · [🐛 Report an issue](https://github.com/loic-123/aeroprofile/issues)

[![tests](https://img.shields.io/badge/tests-32%20passing-brightgreen)](tests/) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![python](https://img.shields.io/badge/python-3.11%2B-blue)](pyproject.toml) [![stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-orange)](#stack)

</div>

---

## What it does

Upload a FIT / GPX / TCX file from any regular ride and AeroProfile tells you:

- Your **CdA** (aerodynamic drag area, m²) with a calibrated 95% confidence interval
- Your **Crr** (rolling resistance) on that ride's surface
- How your CdA splits by **flat / climb / descent** — diagnoses position change or wind error
- Whether your **power meter is drifting** — bias ratio on flat pedaling, independent of the solver
- How **fragile** the estimate is to Open-Meteo wind uncertainty (post-hoc sensitivity)
- The **stability** of your CdA across all your past rides (rolling σ timeline)

Upload several rides → get a **DerSimonian–Laird** hierarchical aggregate with HKSJ small-sample correction. Connect your **Intervals.icu** account → analyse a year of data in one click.

## Why another CdA tool

| | Aerolab (Golden Cheetah) | myWindsock | Notio / Aerosensor | **AeroProfile** |
|---|:---:|:---:|:---:|:---:|
| Open-source | ✅ | ❌ | ❌ | ✅ |
| Cost | free | from £5/month | from £600 (hardware) | free |
| Works on any regular ride | ⚠️ manual tuning | ✅ | ✅ | ✅ |
| Wind correction from weather API | ❌ | ✅ | n/a | ✅ (tiled, 5 km) |
| Joint wind + CdA inversion | ❌ | ❌ | n/a | ✅ |
| Calibrated uncertainty on CdA | ❌ | ❌ | ⚠️ | ✅ (Hessian + conformal) |
| Multi-ride meta-analysis | ❌ | ❌ | ❌ | ✅ (DL + HKSJ) |
| Quality gates (identifies bad rides) | ❌ | ❌ | n/a | ✅ (8 gates) |
| Published methodology | partial | marketing pages | marketing pages | ✅ (14 articles) |
| Power-meter drift detection | ❌ | ❌ | n/a | ✅ |
| Prior-invariance test | n/a | n/a | n/a | ✅ (shipped) |

AeroProfile is the **only open-source tool** that combines inverse-problem wind estimation, calibrated uncertainty, and multi-ride meta-analysis — with every methodological choice documented and testable.

## Quick start

### Use the web app (easiest)

[**aeroprofile.cc**](https://aeroprofile.cc) — drag-and-drop a FIT file, see your CdA in ~10 seconds. No account needed.

### Run it locally

```bash
git clone https://github.com/loic-123/aeroprofile
cd aeroprofile
pip install -e .

# CLI on a single ride
aeroprofile analyze ride.fit --mass 80

# Backend + frontend (dev)
uvicorn aeroprofile.api.app:app --reload
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

### Connect your Intervals.icu account

Paste your API key in the **Intervals** tab, filter your rides by date / distance / elevation, and hit Analyze. Runs in parallel with shared weather cache, so a year of rides takes ~30 seconds warm.

## How it's different — the 6 things that matter

### 1. Wind-Inverse solver

Open-Meteo wind at 10 km grid resolution is off by 2-5 m/s at the rider, and that error **dominates** the CdA estimate on moderately windy days. Most tools take the API wind at face value. AeroProfile jointly fits **CdA + per-segment wind** inside a Chung Virtual Elevation objective, using the API wind only as a soft Bayesian prior (σ = 2 m/s per component). On rides with heading variety this typically **doubles R²** (0.50 → 0.98) by removing the dominant error source.

### 2. Hierarchical multi-ride aggregation (DerSimonian–Laird + HKSJ)

When you analyse N rides of the same rider, AeroProfile runs a proper **random-effects meta-analysis** — not a naive average. It estimates the inter-ride CdA variability τ² in closed form (DerSimonian & Laird 1986), then combines per-ride estimates with weights `w_i = 1/(σ_i² + τ²)`. For small samples (2 ≤ N < 10), the Hartung–Knapp–Sidik–Jonkman correction (IntHout et al. 2014) widens the IC95 using a Student-t quantile — a subtle but important fix that most ML-based tools skip.

### 3. Prior invariance — a testable guarantee

The aggregate CdA over N rides **should not depend on which position prior the user picked**. AeroProfile exposes `cda_raw` (pass-0 MLE, prior-off) on every ride so the user can verify this invariance from their history. A regression test in `tests/test_wind_inverse.py` enforces it (`|Δ cda_raw| < 0.005` when only the prior changes). No other open-source tool publishes this kind of invariance guarantee.

### 4. Eight quality gates, hard vs soft

Not every ride can yield a good CdA — and silently averaging bad rides poisons the aggregate. AeroProfile catches 8 failure modes with gates:

- **Hard** (excluded): `solvers_pegged`, `sensor_miscalib`, `model_mismatch`, `bound_hit`, `non_identifiable`
- **Soft** (kept with warning): `weak_estimate`, `prior_dominated`, `sensor_miscalib_warn`, `model_mismatch_warn`, `insufficient_data`

Each ride chip in the UI is colour-coded by exclusion category (orange = bound, yellow = solver noise, red = bad fit, slate = error). The gate thresholds are documented and tested.

### 5. Open-Meteo wind sensitivity, per ride

ERA5 (the backbone of Open-Meteo's historical archive) has a documented −0.7% mean bias on wind speed and under-predicts high winds (Jourdier 2020; Copernicus ASR 2025). Instead of applying a blind correction, AeroProfile reruns Chung VE with wind × 1.05 post-hoc and shows the resulting Δ CdA — so the user sees whether **this specific ride** is wind-fragile (red) or robust (green).

### 6. Power-meter drift tracking — independent of the solver

On the flat-pedaling portions of each ride, AeroProfile computes `measured_P / theoretical_P(CdA_bike_type_default, Crr=0.005)` — a calibration bias ratio that doesn't depend on the solver. The history page shows a KDE of the ratio per sensor, so a drifting Assioma or a miscalibrated 4iiii is visible as a shift or widening of its bell curve over time. Sensor-quality-aware: high-quality meters get a `model_mismatch` flag instead of `sensor_miscalib` because they rarely drift.

## Pipeline overview

```
 .FIT / .GPX / .TCX
        │
        ▼
┌─────────────────────┐
│  1. PARSE           │  unified RideData
│  2. DERIVE          │  SavGol altitude, 5s power, gradient, bearing
│  3. WEATHER         │  Open-Meteo tiled (≤20 tiles @ 5 km spacing)
│  4. FILTER          │  13 filters, ≥30 s contiguous blocks
└──────────┬──────────┘
           ▼
┌─────────────────────────────────────────────┐
│  5. SOLVER CASCADE                          │
│  Martin LS  →  Wind-Inverse  →  Chung VE    │
│     (straight)  (primary)    (fallback +    │
│                               cross-check)  │
│  Each: Pass 0 (MLE) → Pass 1 → Pass 2 adap. │
└──────────┬──────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────┐
│  6. QUALITY GATES                           │
│  solvers_pegged · sensor_miscalib ·         │
│  model_mismatch · bound_hit ·               │
│  non_identifiable · weak_estimate ·         │
│  prior_dominated · insufficient_data        │
└──────────┬──────────────────────────────────┘
           ▼
┌─────────────────────┐
│  7. REPORT          │  CdA ± Hessian CI (+ conformal CI from history)
│                     │  CdA by gradient, wind sensitivity,
│                     │  8 anomaly categories, 7 plots, map
└─────────────────────┘

 N rides  →  Method A (inverse-var weighted mean)
          →  Method B hierarchical (DerSimonian–Laird + HKSJ small-k)
          →  Rolling-σ stability timeline  (+ per-sensor bias KDE)
```

## Stack

- **Backend**: Python 3.11, FastAPI, NumPy, pandas, scipy (TRF + least_squares), fitdecode, httpx
- **Frontend**: React 18, Vite, TailwindCSS, MapLibre GL, KaTeX (methodology articles)
- **Weather**: Open-Meteo historical + forecast APIs (tiled)
- **Tests**: pytest (32 passing, including hierarchical solver, wind-inverse recovery, prior invariance)
- **Deploy**: single FastAPI service serving the built React SPA

## How it's tested

```bash
pytest -q              # 32 tests: parsers, physics, solvers,
                       # hierarchical DL, wind-inverse invariance,
                       # filters, weather interpolation
cd frontend && npx tsc --noEmit && npm run build
```

Key test invariants:

- **CdA recovery** on synthetic rides within ±0.02 m² at 5 W injected noise
- **Prior invariance**: same ride under two different CdA priors → `|Δ cda_raw| < 0.005`
- **DL heterogeneity detection**: injected τ = 0.05 → solver reports τ ∈ [0.03, 0.08]
- **HKSJ CI width ratio**: IC95_HKSJ ≥ IC95_Gaussian for n < 10 on heterogeneous samples

## Contributing

Pull requests are welcome, especially:

- **New weather sources** (ERA5 direct, ECMWF, Météo-France AROME) — `aeroprofile/weather/`
- **New solvers** — `aeroprofile/solver/` (see `wind_inverse.py` for the canonical pattern)
- **Validation against wind-tunnel or velodrome datasets** — we currently validate on synthetic data only
- **UI translations** (currently French; English localization would help adoption)

## References — the papers we actually rely on

All 14 methodology articles in the app link back to specific papers. The core stack:

- **Martin, Milliken, Cobb, McFadden & Coggan (1998).** Validation of a Mathematical Model for Road Cycling Power. *J Applied Biomechanics* 14(3):276–291. → the forward power model
- **Chung, R. (2003, revised 2012).** *Estimating CdA with a power meter* (virtual elevation method). → the altitude-based inverse
- **DerSimonian & Laird (1986).** *Meta-analysis in clinical trials.* Controlled Clinical Trials 7(3):177–188. → multi-ride pooling
- **IntHout, Ioannidis & Borm (2014).** *The Hartung-Knapp-Sidik-Jonkman method for random effects meta-analysis is straightforward and considerably outperforms the standard DerSimonian-Laird method.* BMC Med Res Methodol 14:25. → small-k correction
- **Vovk et al. (2005); Angelopoulos & Bates (2021).** Conformal prediction. → distribution-free uncertainty from the user's own ride history
- **Debraux, Grappe, Manolova, Bertucci (2011).** Aerodynamic drag in cycling: methods of assessment. *Sports Biomechanics* 10(3):197–218. → CdA reference values
- **Crouch et al. (2014).** → yaw-angle correction
- **Spicer et al. (2001).** → drivetrain efficiency η(P)

## Author

**Loïc Briand** — [GitHub](https://github.com/loic-123)

If AeroProfile saves you a trip to the wind tunnel, star the repo ⭐ or drop a comment in an [issue](https://github.com/loic-123/aeroprofile/issues). Bug reports with a FIT file attached are gold.

## License

MIT — do whatever you want, just don't strip the attribution. If you build a commercial product on top, a credit link back to this repo is appreciated.

---

<details>
<summary><b>Deep dive — full pipeline details (click to expand)</b></summary>

<br>

### Parse & derive

Multi-format parser (FIT, GPX with power extensions, TCX with Garmin namespaces) produces a unified `RideData`. The pipeline then computes per-point derivatives: Savitzky-Golay-smoothed altitude, gradient, acceleration, bearing, and a 5-second centred rolling mean on power (per Martin 1998).

### Weather

For each ride we fetch **tiled historical weather** from Open-Meteo: one tile every **5 km** along the route (up to **20 tiles**, fetched sequentially with 300 ms delay to stay under rate limits). A 100 km ride gets ~20 weather anchor points — enough to capture valley/ridge wind gradients that a single centroid would miss. Temperature, humidity, surface pressure and wind are interpolated onto each sample via u/v-vector blending (so the 359°→1° wrap doesn't alias to 180°). Wind at 10 m is rescaled to rider height (1.3 m) with a logarithmic profile `v(z) = v_ref · ln(z/z₀) / ln(10/z₀)`, z₀ = 0.03 m in open terrain.

**Important**: even with tiled weather, Open-Meteo's ~10 km grid resolution means the wind at the rider can differ by 2-5 m/s from the API value — which is why the wind-inverse solver is so impactful.

### Physics

We solve the Martin et al. (1998) power equation, augmented with wheel-bearing losses and wheel-inertia:

```
P × η = P_aero + P_roll + P_grav + P_accel + P_bearings

  P_aero      = ½ · CdA · ρ · V_air² · V_ground
  P_roll      = Crr · m · g · cos(θ) · V_ground
  P_grav      = m · g · sin(θ) · V_ground
  P_accel     = (m + 0.14) · a · V_ground     [0.14 kg = wheel I/r²]
  P_bearings  = V · (91 + 8.7·V) × 10⁻³       [Dahn et al.]

η = 0.977 (drivetrain), ρ per-point from altitude + T + RH + surface pressure.
```

### Filters

13 boolean filters (power < 50 W, |acceleration| > 0.3 m/s², yaw rate > 10°/s, gradient out of ±8%, speed CV > 15%, power spikes, GPS jumps, negative V_air, drafting, …), plus contiguous blocks ≥ 30 s. After the initial solve, a **hybrid iterative VE refinement** excludes segments where virtual elevation diverges from reality (drift rate + absolute drift thresholds, 30% safety cap, pass-2 acceptance check on R² regression and bound hits).

### Solver cascade

- **Wind-Inverse** (primary) — jointly estimates (CdA, Crr, wind per 30-min segment) inside a Chung VE objective. Open-Meteo wind serves as a Gaussian prior (σ = 2 m/s / component). Requires heading variance > 0.25.
- **Chung VE** (fallback + always-on cross-check) — minimises Σ(altitude_real − altitude_virtual)² with API wind. Used when wind-inverse is unavailable, AND as an independent cross-check on every ride regardless.
- **Martin LS** (baseline) — per-point power residuals, multi-start TRF, for linear/velodrome rides.

All priors are weak Gaussian: Crr ~ N(0.0035, 0.0012²), CdA ~ N(0.30, 0.12²). CIs come from the full Laplace approximation at the MAP estimate (complete Jacobian including prior rows).

### Adaptive prior, three passes

- **Pass 0** — CdA prior off (wind + Crr priors stay, so it's a conditional MLE). Exposes `cda_raw` — invariant to CdA prior by construction.
- **Pass 1** — base prior weight `0.3·√N` (Gelman BDA3 default).
- **Pass 2** — if `σ_Hess(CdA) / σ_prior > 1`, the CdA prior weight is scaled by that ratio (capped at 3.0). Prevents bound-hit on noisy rides without crushing the data on informative ones.

A `⚡ prior renforcé ×N.N` badge in the UI marks rides where Pass 2 was needed.

### Solver cross-check

Chung VE runs on every ride. The delta `|CdA_wind − CdA_chung|` is classified into a confidence bucket (`high` < 0.02, `medium` 0.02–0.05, `low` ≥ 0.05) and exposed as a badge on each ride chip. A filter in the UI excludes rides below a chosen confidence level from the aggregate. When either solver sits at a physical bound, confidence becomes `unknown` (the agreement is an artefact of the bound, not a real signal).

### Quality gate order

1. **`solvers_pegged`** — both main solver AND Chung cross-check pile at a bound → ride fundamentally non-identifiable
2. **`sensor_miscalib` / `model_mismatch`** — bias > ±20% OR > ±15% + bound hit. Label depends on sensor quality class
3. **`bound_hit`** — kept solver at bound, Chung disagrees
4. **`non_identifiable`** — σ_Hess(CdA) > 0.05 m² (Hessian too flat)
5. **`weak_estimate`** — 0.03 < σ_Hess ≤ 0.05 (kept, flagged)
6. **`prior_dominated`** — `|cda_raw − cda| > 0.05` (kept, flagged)
7. **`sensor_miscalib_warn` / `model_mismatch_warn`** — bias ∈ [±10%, ±20%], solver in bounds
8. **`insufficient_data`** — filter retention < 25%

Soft statuses (weak_estimate, prior_dominated, *_warn, insufficient_data) are **kept** in the aggregate. The user's nRMSE threshold slider is the only nRMSE filter — keeping them in control.

### Aggregate statistics

- **Method A** — inverse-variance weighted mean, `w_i = (1/σ_i²) × quality_i`, where σ_i comes from the Hessian CI and quality_i interpolates [1, 3] by nRMSE rank. IC95 from weighted variance and effective sample size `n_eff = (Σw)²/Σw²` (Kish 1965). **Single helper** in `frontend/src/lib/aggregate.ts` used by all 4 call sites — so the CdA displayed equals the CdA persisted.
- **Method B** — DerSimonian–Laird random-effects, closed-form. σ_i floor at 0.010 to prevent one "lucky" ride from dominating. HKSJ small-k correction active for 2 ≤ n < 10 (Student-t quantile + q-factor widening). n_eff exposed alongside nominal N.

### Conformal prediction interval (split CP)

When the calibration set ≥ 30 of the user's own past "ok" rides is available (filtered by athlete, optionally sensor + bike), AeroProfile computes a distribution-free IC95 as `CdA ± q̂` where `q̂ = Quantile(|CdA_i − median|, ⌈0.95(n+1)⌉/n)`. Displayed as a second line under the Hessian CI, labelled `IC conforme (n=N)`. Doesn't replace the Hessian CI — complements it by catching over-confidence when the solver sits near a bound.

### Per-analysis logs

Every analysis opens a fresh `logs/session_*.log` file. Every threshold, gate verdict, pass-2 trigger, cross-check classification and Hessian diagnostic is logged with its inputs and reference values. `scripts/compare_runs.py` compares two runs positionally and reports per-ride deltas in CdA, cda_raw, σ_Hess, and quality_status — the tool used to validate the prior-invariance fix on real data.

</details>
