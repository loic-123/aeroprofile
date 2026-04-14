# AeroProfile

Open-source tool that computes a cyclist's **CdA** (aerodynamic drag area) and **Crr** (rolling resistance coefficient) from a power-meter activity file (`.fit`, `.gpx`, `.tcx`), with automatic historical wind correction via Open-Meteo.

Live demo: **https://aeroprofile.onrender.com**

**What makes it different**

- Analyses *any* regular ride — no need for a controlled protocol (no velodrome, no loops, no pre-arranged out-and-back).
- **3 solvers in cascade**: Wind-Inverse (jointly estimates wind + CdA), Chung Virtual Elevation, Martin LS — with automatic selection based on fit quality.
- **Iterative VE refinement (hybrid)**: 2-pass algorithm using both drift rate and absolute drift to exclude divergent segments, with a 30% safety cap to avoid over-trimming. Re-solves on clean data only.
- **Yaw-angle correction**: CdA reported is the zero-yaw "wind tunnel" value, corrected for crosswind effects (Crouch et al. 2014).
- **Per-point drafting filter**: detects and excludes segments where CdA_instantaneous < 0.12 for ≥30s (physically impossible solo).
- **Variable η(P)**: drivetrain efficiency varies with power per Spicer et al. (2001).
- **Martin 1998 complete**: wheel-bearing losses + wheel inertia (+0.14 kg) + 5s power smoothing.
- **Bike type selector** (Route / CLM-Triathlon / VTT-Gravel) with per-type CdA plausibility bounds for automatic ride exclusion.
- **4 analysis modes**:
  - **Single/multi-file upload** with drag & drop, local cache, quality-weighted averaging
  - **Multi-rider comparison** with drafting detection and W/CdA ranking
  - **Intervals.icu integration** — connect your account, filter rides by date/distance/D+, analyze a year of data in one click
  - **11 methodology articles** with KaTeX-rendered LaTeX formulas explaining every step of the pipeline
- **CdA Totem** — fun comparison of your CdA to a real-world object ("You're a dolphin 🐬").
- **VE exclusion zones** visible as grey bands on the altitude chart.
- Detects likely **power-meter calibration issues** and quantifies the probable offset in watts.

## Quick start

### Install

```bash
pip install -e .
```

### CLI

```bash
aeroprofile analyze ride.fit --mass 80
aeroprofile analyze ride.gpx --mass 75 --crr 0.004
aeroprofile analyze ride.fit --mass 80 --format json > results.json
```

### Backend API

```bash
uvicorn aeroprofile.api.app:app --reload
# POST multipart/form-data to http://localhost:8000/api/analyze
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

## Pipeline overview

```
 .FIT / .GPX / .TCX
        │
        ▼
┌──────────────────┐
│   1. PARSE       │  FIT semicircles→deg, GPX power extensions,
│                  │  TCX Garmin namespaces → unified RideData
└────────┬─────────┘
         ▼
┌──────────────────┐
│   2. DERIVE      │  Savitzky-Golay altitude smoothing (win=31)
│                  │  5 s rolling mean on power (Martin 1998)
│                  │  Gradient, acceleration, bearing per point
└────────┬─────────┘
         ▼
┌──────────────────┐
│   3. WEATHER     │  Open-Meteo Historical / Forecast API
│                  │  Tiled fetching (3 tiles, 10 km spacing)
│                  │  u/v vector interpolation (no 359°→1° alias)
│                  │  Log-law 10 m → 1.3 m rider height
└────────┬─────────┘
         ▼
┌──────────────────┐
│   4. FILTER      │  12 boolean filters (P<50W, |a|>0.3,
│                  │  yaw>10°/s, steep climb/descent, GPS jump,
│                  │  power spike, unsteady speed CV, …)
│                  │  Keep only contiguous blocks ≥ 30 s
└────────┬─────────┘
         ▼
┌──────────────────────────────────────────────────┐
│   5. SOLVER CASCADE                              │
│                                                  │
│   ┌─────────────────────┐                        │
│   │  A. Martin LS       │  heading variance      │
│   │     (only for linear│  < 0.25 only            │
│   │      rides, velodr.)│──── if not ──► skip     │
│   └─────────────────────┘              │         │
│                                        ▼         │
│   ┌─────────────────────┐                        │
│   │  B. Wind-Inverse    │  PRIMARY solver —      │
│   │     (CdA + Crr +    │  jointly fits wind     │
│   │      wind/segment)  │  per segment to data   │
│   │     Chung VE obj.   │  R² best? ──────► ✓    │
│   └─────────────────────┘              │         │
│                no / R² < 0.3           ▼         │
│   ┌─────────────────────┐                        │
│   │  C. Chung VE        │  Last-resort fallback  │
│   │     (CdA + Crr,     │  on the energy-balance │
│   │      wind = API)    │  altitude objective ─► ✓│
│   └─────────────────────┘                        │
│                                                  │
│   Each solver runs up to 3 passes per ride:      │
│     Pass 0 — MLE (no prior, for "raw" display)   │
│     Pass 1 — base adaptive prior (0.3·√N)        │
│     Pass 2 — boosted prior if σ_Hess/σ_prior > 1 │
│                                                  │
│   All solvers: η=0.977, wheel bearings,          │
│   wheel inertia (+0.14 kg), per-point ρ          │
└──────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────┐
│   6. QUALITY GATE + SENSOR DIAGNOSTICS          │
│                                                  │
│   · bound_hit / non_identifiable / prior_dom.   │
│   · Power-meter classification (sensor DB)      │
│   · Calibration bias ratio (flat/pedaling)      │
└──────────────────────────────────────────────────┘
         ▼
┌──────────────────┐
│   7. REPORT      │  CdA ± Hessian CI (+ conformal CI from history)
│                  │  CdA by gradient (flat/climb/descent)
│                  │  8 anomaly categories + drafting detection
│                  │  Sensor warning banner + bias badge
│                  │  7 plots + MapLibre route + posture icon
└──────────────────┘
```

## How it works — details

### 1. Parse & derive

Multi-format parser (FIT, GPX with power extensions, TCX with Garmin namespaces) produces a unified `RideData`. The pipeline then computes per-point derivatives: Savitzky-Golay-smoothed altitude, gradient, acceleration, bearing, and a 5-second centred rolling mean on power (per Martin 1998).

### 2. Weather

For each ride we fetch **tiled historical weather** from Open-Meteo: one tile every **5 km** along the route (up to **20 tiles**, fetched sequentially with 300 ms delay to stay under rate limits). A 100 km ride gets ~20 weather anchor points — enough to capture valley/ridge wind gradients that a single centroid would miss. Temperature, humidity, surface pressure and wind are interpolated onto each sample via u/v-vector blending (so the 359°→1° wrap doesn't alias to 180°). Wind at 10 m is rescaled to rider height (1.3 m) with a logarithmic profile `v(z) = v_ref · ln(z/z₀) / ln(10/z₀)`, z₀ = 0.03 m in open terrain.

**Important**: even with tiled weather, Open-Meteo's ~10 km grid resolution means the wind at the rider can differ by 2-5 m/s from the API value — which is why the wind-inverse solver (see below) is so impactful.

### 3. Physics

We solve the Martin, Milliken, Cobb, McFadden & Coggan (1998) power equation, augmented with the paper's wheel-bearing losses and wheel-inertia terms:

```
P × η = P_aero + P_roll + P_grav + P_accel + P_bearings

  P_aero      = ½ · CdA · ρ · V_air² · V_ground
  P_roll      = Crr · m · g · cos(θ) · V_ground
  P_grav      = m · g · sin(θ) · V_ground
  P_accel     = (m + 0.14) · a · V_ground     [0.14 kg = wheel I/r²]
  P_bearings  = V · (91 + 8.7·V) × 10⁻³       [Dahn et al.]

η = 0.977 (drivetrain), ρ per-point from altitude + T + RH + surface pressure.
```

### 4. Filters

Each sample is tagged with 13 boolean filters (including per-point drafting detection). Defaults follow the Debraux/Chung consensus:

- `power < 50 W` (Martin threshold)
- `|acceleration| > 0.3 m/s²` (unsteady)
- `|yaw_rate| > 10°/s` (cornering)
- `gradient > +8%` (climbs dominated by gravity, low aero SNR)
- `gradient < -8%` (steep descents with braking/terminal velocity)
- rolling speed CV > 15% over 15 s
- power spikes > 3·NP, GPS jumps > 50 m, negative V_air, low speed < 3 m/s, stopped, zero power
- CdA_instantaneous < 0.12 for ≥30s continuous blocks at speed > 8 m/s (drafting detection)

Only **contiguous blocks of ≥ 30 s** of valid samples are kept. Mid-grade descents (-3% to -8%) are kept by default because their high V_air gives a strong aero signal.

After the initial solve, a **hybrid iterative refinement** (pass 2) detects and excludes segments where the virtual elevation diverges from reality, using two complementary criteria:
- **Drift rate** `d(drift)/dt > max(0.10, D+/duration × 4)` m/s — catches active divergence
- **Absolute drift** `|drift| > max(80 m, D+ × 12%)` — catches accumulated bias

If >30% of valid points would be excluded, refinement is skipped (model is globally poor). Excluded segments are shown as grey zones on the altitude chart.

### 5. Solver

Three estimators, tried in cascade (best R² wins):

1. **Wind-Inverse** (preferred) — jointly estimates **(CdA, Crr, wind speed, wind direction)** per 30-minute segment inside a Chung VE objective. The Open-Meteo wind serves as a Gaussian prior (σ = 2 m/s per component) so the solver adjusts the wind to what the data actually says rather than trusting a 10 km grid cell. Requires heading variance > 0.25 (the rider changed direction enough for wind to be identifiable separately from CdA). On rides with heading variety this typically **doubles the R²** (e.g. 0.50 → 0.98) by removing the dominant error source.

2. **Chung VE** (fallback) — minimises `Σ(altitude_real − altitude_virtual)²` from the integrated energy balance, per-block aligned so gaps don't drift. Wind is taken from the API (not estimated). Used when heading variance is too low (linear climbs, straight roads) or when wind-inverse doesn't improve on it.

3. **Martin LS** (baseline) — `scipy.optimize.least_squares` on per-point power residuals, multi-start (3 seeds), trust-region reflective.

All three share weak Gaussian priors on Crr ~ N(0.0035, 0.0012²) and CdA ~ N(0.30, 0.12²) to stabilise ill-conditioned fits. Confidence intervals come from the Jacobian at the MAP estimate (prior rows excluded).

**Adaptive prior weighting.** Each solver runs up to three passes per ride:
1. **Pass 0** — MLE (prior weight = 0) to expose a raw CdA for display.
2. **Pass 1** — base prior weight `0.3·√N` (Gelman BDA3 default).
3. **Pass 2** — if `σ_Hess(CdA) / σ_prior > 1`, the prior weight is scaled by that ratio and the solver reruns. This prevents bound-hit on noisy rides where the data carry less information than the prior (James–Stein / ridge-adaptive shrinkage).

The UI displays `cda_raw` (MLE) alongside the posterior CdA when they differ by > 0.02, and shows a `⚡ prior renforcé ×N.N` badge when Pass 2 was needed.

**Quality gate (automatic exclusion).** A ride is marked `quality_status = "bound_hit"` or `"non_identifiable"` — and excluded from aggregation — when:
- The solver's CdA or Crr estimate sits on a physical bound (degenerate: the solver *wanted* to leave the plausible range), or
- `σ_Hess(CdA) > 0.05` — the Hessian is too ill-conditioned to separate CdA from the other parameters.

Rides are **not** gated by nRMSE in the backend: a fuzzy fit with well-identified parameters is still informative. The user's "nRMSE threshold" slider in the UI is the only nRMSE filter — keeping the user in control of which rides count toward the aggregate.

### 6. Reporting

The dashboard reports:

- CdA and Crr with 95% intervals
- **RMSE in watts** as the headline error metric (more interpretable than R² on varied rides)
- **CdA by gradient regime** — separate estimates on flat, climbs, descents (asymmetry is diagnostic of wind error or real position change)
- Seven plots — altitude (real vs Chung-virtual), rolling CdA, power decomposition (aero/rolling/gravity/accel), P_model vs P_measured scatter, residuals histogram, CdA vs speed, and the route on a MapLibre basemap
- Eight anomaly categories: out-of-range CdA/Crr, wide CI, residual bias (quantified in W), temporal drift, climb/descent asymmetry, offset estimate, drafting suspicion
- A posture illustration matched to the estimated CdA, and derived watts-to-ride-at-V figures

### 7. Power meter diagnostics

AeroProfile reads the power-meter identity from each ride (from Intervals.icu's `power_meter` field, which mirrors the FIT ANT+ product string) and flags two failure modes that are invisible to the solver alone:

1. **Sensor class** — a short database classifies common meters into high / medium / low quality categories. Single-side crank meters (4iiii Precision, Stages left) are "low" because they measure one leg and double it, and drift with temperature unless zero-offset is run before every ride. Dual-side pedals (Favero Assioma, Garmin Rally) and power spiders (SRM, Quarq) are "high". Home-trainer reported power is "medium".
2. **Calibration bias ratio** — on the flat-pedaling portions of the ride (|gradient|<2%, P>50W), we compute the power predicted by the bike-type prior (CdA_prior, Crr=0.005) and divide the measured mean by the theoretical mean. A ratio >1.35 is almost always a mis-calibrated sensor reading high. This signal is independent of the solver — a well-fitting ride with a biased sensor still gets flagged.

Both indicators surface in the main dashboard banner (`PowerMeterBanner` component) and as a coloured sensor chip on multi-ride chips. The history view persists the majority sensor label and median bias across each aggregated analysis, and offers a sensor filter so the user can isolate the rides made with a specific meter.

### 8. Ride-to-ride stability timeline (history)

The history page computes a **rolling standard deviation of CdA over a window of 10 consecutive rides**, plotted over time with coloured background bands per sensor. A sudden drop in the rolling σ corresponds to a sensor swap or a calibration fix; a sudden rise reveals the opposite. The chart makes it easy to see *when* the user's data became reliable, independently of the absolute CdA value.

### 9. Profiles: saved setups with one-click recall

A single AeroProfile installation is often used to analyse several cyclists or several setups (your road bike vs TT bike, pre-position-change vs post). A profile is a **saved setup** — it remembers every field you would otherwise retype on each analysis:

- **Upload mode** — mass, bike type, position preset, Crr setting, nRMSE threshold.
- **Intervals mode** — all of the above, plus your Intervals.icu API key and athlete id, plus the entire ride-filter state (distance range, max D+, pente moyenne max, min duration, exclude-group toggle).

The "Moi" profile is pre-seeded with sensible defaults (75 kg, road, Aéro drops, Crr auto, nRMSE 45%) so a fresh install has one profile ready to go. The **ProfilePicker** toolbar at the top of each mode has:

- **Profile chips** — click any chip to load that profile's settings into the current form.
- **"Nouveau"** — clones the current form state into a brand-new profile.
- **"Sauvegarder"** — writes the current form state back into the active profile (green flash confirms the save).
- **"Recharger"** — reloads the active profile without switching profiles (undoes any unsaved tweaks).

Each profile's **key is also used as the `athleteKey`** on every history entry it produces. This keeps the rolling-σ timeline and the conformal prediction calibration set **per-rider**: a history entry from profile "Laurette" will not contaminate the stability chart of profile "Moi". Legacy entries without an athlete key are migrated best-effort by parsing their label.

Beyond the athlete dimension, each history entry also records:

- **`bikeKey` / `bikeLabel`** — bike identifier from Intervals.icu's `gear.{id,name}` field. Stable across rides with the same bike, so the user can filter "my road bike" vs "my TT bike".
- **`powerMeterLabel`** — the majority power meter observed in the aggregated rides.

The history page exposes three independent checkbox filter blocks (Profil / Capteur / Vélo) that compose via intersection. The rolling-σ timeline is restricted to the currently filtered entries, so the chart reflects actual within-rider variance rather than cross-rider noise.

### 10. Conformal prediction interval (split CP)

Classical confidence intervals on CdA come from the Hessian at the solver's optimum, which assumes gaussian residuals and an interior minimum. Both assumptions routinely break on noisy rides: when the solver sits on a bound, the Hessian is artificially narrow and gives a false sense of precision.

AeroProfile provides a distribution-free alternative using **split conformal prediction** (Vovk et al. 2005; Angelopoulos & Bates 2021). The calibration set is the user's own past "ok" rides from history, filtered to match the current ride's athlete (and optionally the same sensor and bike). The nonconformity score is `|CdA_i − median|`, and the empirical quantile `q̂ = Quantile(s_i, ⌈(1−α)(n+1)⌉/n)` yields a half-width with a formally guaranteed coverage of at least `1−α` over the rider's ride population.

Implementation details:

- Minimum calibration set size: 30 rides. Below that the feature is silently disabled and the dashboard falls back to the Hessian CI.
- Progressive filter relaxation: tries the tightest filter (athlete + sensor + bike) first, then drops the bike, then keeps only the athlete, before giving up.
- The conformal interval is displayed as a second line under the Hessian CI in the main dashboard (`IC conforme low–high (n=N)` in info colour).

Because conformal prediction only guarantees marginal coverage (over the population of rides, not per individual ride), it is **not** a substitute for the solver's own CI — it complements it by catching the cases where the solver is overconfident.

## Compare mode

Upload several activity files at once (one per rider). AeroProfile runs each analysis in parallel, then:

- Ranks riders on best aero (lowest CdA), best rolling (lowest Crr), and overall drag at 40 km/h with each rider's own mass
- Shows a full comparison table with CdA, Crr, drag force, W/kg and R² per rider
- **Detects drafting between riders** — if two riders have the same average speed (±5%) but CdA differs by >15%, the lower-CdA one was almost certainly behind the other
- Shows each rider's posture silhouette side-by-side

## Physical reference

Typical CdA (m²) per position (Debraux et al. 2011):

| Position | CdA |
|---|---|
| TT pro (Superman) | 0.17 – 0.20 |
| TT amateur | 0.21 – 0.25 |
| Road, drops | 0.28 – 0.32 |
| Road, hoods | 0.32 – 0.38 |
| Road, tops | 0.38 – 0.45 |
| Upright / MTB | 0.45 – 0.55 |

Typical Crr:

| Tyre / surface | Crr |
|---|---|
| Velodrome tubular | 0.002 – 0.003 |
| Tubeless clincher, tarmac | 0.003 – 0.004 |
| Standard clincher | 0.004 – 0.006 |
| Rough tarmac | 0.006 – 0.008 |
| Gravel | 0.007 – 0.010 |

## Known limits

AeroProfile is a **field-estimation tool**, not a wind-tunnel replacement. It works best when:

- The ride has a variety of speeds and gradients (separates CdA from Crr)
- The power meter is calibrated and the rider's mass is correct (±2 kg)
- The ride is solo or of known drafting pattern
- The wind is light enough to be captured by Open-Meteo's ~10 km grid

Expected RMSE on unconstrained rides is **15-60 W** depending on drafting, wind error, and altitude noise. Martin et al.'s 1998 validation paper reports SEE = 2.7 W on a velodrome under controlled conditions — that ceiling is unreachable on open roads.

When R² is below 0 the tool marks CdA and Crr as "non-reliable" rather than showing an authoritative-looking number.

## Deploy

A single-service Render deployment is provided via `render.yaml`. FastAPI serves both the API (`/api/*`) and the built frontend (`frontend/dist/`) from the same domain.

## Tests & CI

```bash
pytest -q
```

26 unit tests cover parsers, physics, solver synthetic-recovery, filters, and weather interpolation. GitHub Actions runs tests and builds the frontend on every push.

## References

- Martin, Milliken, Cobb, McFadden & Coggan (1998). *Validation of a Mathematical Model for Road Cycling Power.* J Applied Biomechanics 14(3):276–291.
- Chung, R. *Estimating CdA with a power meter* — virtual elevation method.
- Debraux, Grappe, Manolova, Bertucci (2011). *Aerodynamic drag in cycling: methods of assessment.* Sports Biomechanics 10(3):197–218.
- Open-Meteo Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api

## License

MIT

