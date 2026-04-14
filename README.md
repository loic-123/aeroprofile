# AeroProfile

Open-source tool that computes a cyclist's **CdA** (aerodynamic drag area) and **Crr** (rolling resistance coefficient) from a power-meter activity file (`.fit`, `.gpx`, `.tcx`), with automatic historical wind correction via Open-Meteo.

Live demo: **https://aeroprofile.onrender.com**

**What makes it different**

- Analyses *any* regular ride — no need for a controlled protocol (no velodrome, no loops, no pre-arranged out-and-back).
- **3 solvers in cascade**: Wind-Inverse (jointly estimates wind + CdA), Chung Virtual Elevation, Martin LS — with automatic selection based on fit quality.
- **Solver cross-check**: Chung VE runs on every ride as an independent control. The delta `|CdA_wind − CdA_chung|` is exposed in the UI as a confidence badge (high / medium / low) so the user sees when the estimate is robust to the wind-treatment choice.
- **Iterative VE refinement (hybrid) with acceptance check**: 2-pass algorithm using both drift rate and absolute drift to exclude divergent segments, with a 30% safety cap. The pass-2 result is only accepted if it doesn't introduce a new bound hit and R² doesn't regress by more than 0.05 — protecting against the silent-overwrite class of bug.
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
│   Each solver runs up to 3 internal passes:      │
│     Pass 0 — MLE conditional (CdA prior off,     │
│              wind + Crr priors stay active)      │
│     Pass 1 — base prior weight 0.3·√N            │
│     Pass 2 — boosted prior if σ_Hess/σ_prior > 1 │
│              (capped at ratio ≤ 3.0 to avoid     │
│               prior domination on noisy rides)   │
│                                                  │
│   All solvers: η=0.977, wheel bearings,          │
│   wheel inertia (+0.14 kg), per-point ρ          │
└──────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────┐
│   6. QUALITY GATE + SENSOR DIAGNOSTICS          │
│                                                  │
│   · bound_hit / non_identifiable / prior_dom.   │
│   · sensor_miscalib (hard + warn tiers)         │
│   · insufficient_data (<25% points kept)        │
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

After the initial solve, a **hybrid iterative refinement** (pass 2 VE) detects and excludes segments where the virtual elevation diverges from reality, using two complementary criteria:
- **Drift rate** `d(drift)/dt > max(0.10, D+/duration × 4)` m/s — catches active divergence
- **Absolute drift** `|drift| > max(80 m, D+ × 12%)` — catches accumulated bias

If >30% of valid points would be excluded, refinement is skipped (model is globally poor). Excluded segments are shown as grey zones on the altitude chart.

**Acceptance check**: the pass-2 re-solve result is only kept if (a) it doesn't introduce a new CdA bound hit that pass 1 wasn't on, and (b) its R² doesn't regress by more than 0.05 from pass 1. Otherwise we log `VE PASS2 rejected: <reason>` and keep the pass-1 result. This guards against a silent-overwrite bug where a noisy pass-2 solve on a trimmed subset would accept a degenerate bound-locked CdA.

### 5. Solver

Three estimators, tried in cascade (best R² wins):

1. **Wind-Inverse** (preferred) — jointly estimates **(CdA, Crr, wind speed, wind direction)** per 30-minute segment inside a Chung VE objective. The Open-Meteo wind serves as a Gaussian prior (σ = 2 m/s per component) so the solver adjusts the wind to what the data actually says rather than trusting a 10 km grid cell. Requires heading variance > 0.25 (the rider changed direction enough for wind to be identifiable separately from CdA). On rides with heading variety this typically **doubles the R²** (e.g. 0.50 → 0.98) by removing the dominant error source.

2. **Chung VE** (fallback) — minimises `Σ(altitude_real − altitude_virtual)²` from the integrated energy balance, per-block aligned so gaps don't drift. Wind is taken from the API (not estimated). Used when heading variance is too low (linear climbs, straight roads) or when wind-inverse doesn't improve on it.

3. **Martin LS** (baseline) — `scipy.optimize.least_squares` on per-point power residuals, multi-start (3 seeds), trust-region reflective.

All three share weak Gaussian priors on Crr ~ N(0.0035, 0.0012²) and CdA ~ N(0.30, 0.12²) to stabilise ill-conditioned fits (the CdA prior mean/sigma is also overridable per-ride by the position selector). Confidence intervals come from the full Laplace approximation at the MAP estimate: `Σ = s² · (JᵀJ)⁻¹` on the **complete** Jacobian (data rows + prior rows). Including the prior rows is necessary for Pass 2 — when the prior is adaptively boosted, the posterior Hessian is the sum of the data Hessian and the prior Hessian, so excluding prior rows would overstate σ_Hess and trigger spurious Pass 2 escalations.

**Adaptive prior weighting.** Each solver runs up to three passes per ride:
1. **Pass 0** — *CdA* prior weight = 0 (the wind prior toward Open-Meteo and the Crr prior stay active at their base weight to keep the problem well-posed, so this is a **conditional MLE** on CdA, not a pure MLE).
2. **Pass 1** — base prior weight `0.3·√N` (Gelman BDA3 default).
3. **Pass 2** — if `σ_Hess(CdA) / σ_prior > 1`, the CdA prior weight is scaled by that ratio and the solver reruns. This prevents bound-hit on noisy rides where the data carry less information than the prior (James–Stein / ridge-adaptive shrinkage). The scaling ratio is **capped at 3.0**: beyond that threshold the ride is effectively non-identifiable and should be flagged as such by the quality gate, not rescued by a prior that would crush the data.

The UI displays `cda_raw` (the Pass 0 conditional MLE) alongside the posterior CdA when they differ by > 0.02, labelled "CdA hors prior" — a reminder that only the CdA prior is removed in that pass, not all regularisation. A `⚡ prior renforcé ×N.N` badge marks rides where Pass 2 was needed.

**Solver cross-check (always on).** Chung VE runs on every ride as an independent control, in addition to its role as a fallback when wind_inverse has no usable result. Both solvers use the same R² on altitude reconstruction, so the cross-check delta `|CdA_wind − CdA_chung|` is a meaningful indicator of how much the result depends on the wind-treatment choice. The delta is classified into a confidence bucket (`high` < 0.02, `medium` 0.02–0.05, `low` ≥ 0.05) and surfaced as a badge on each ride chip. A filter in the Intervals page lets the user exclude rides below a chosen confidence level from the aggregate.

**Quality gate (automatic exclusion + soft warnings).** Each ride falls into one of these statuses, checked in this order:
1. **`sensor_miscalib`** (hard, excluded) — power-meter bias > ±20% on flat pedaling, OR > ±15% combined with a CdA bound hit. The solver's estimate is unusable; the issue is the sensor, not the algorithm.
2. **`bound_hit`** (excluded) — the solver's CdA estimate sits pile on a physical bound after the safety checks (degenerate: the solver *wanted* to leave the plausible range).
3. **`non_identifiable`** (excluded) — `σ_Hess(CdA) > 0.05` m² — the Hessian is too flat to separate CdA from the other parameters.
4. **`prior_dominated`** (kept with warn) — the Pass 0 MLE and Pass 1 MAP disagree by > 0.05 m². The estimate is still informative but heavily influenced by the position prior.
5. **`sensor_miscalib_warn`** (kept with warn) — power-meter bias ∈ [±10%, ±20%] on a ride where the solver still converged inside the bounds. The estimate is salvageable but carries a systematic bias proportional to the calibration offset.
6. **`insufficient_data`** (kept with warn) — fewer than 25% of the total points survived the segment filters (cherry-picked subset, probably urban / stop-heavy).
7. **`ok`** — no issue detected.

Soft statuses (prior_dominated, sensor_miscalib_warn, insufficient_data) are **kept** in the aggregate so the user doesn't lose data on borderline rides, but show a badge in the UI so the user knows the estimate is less trustworthy.

Rides are **not** gated by nRMSE in the backend: a fuzzy fit with well-identified parameters is still informative. The user's "nRMSE threshold" slider in the UI is the only nRMSE filter — keeping the user in control of which rides count toward the aggregate. An additional "solver agreement" filter lets the user optionally exclude rides whose Chung cross-check delta is too large.

**Exhaustive decision logging.** Every threshold, gate verdict, pass-2 trigger, cross-check classification and Hessian diagnostic is logged to `logs/session_*.log` with its inputs and reference values. A future reader (or a post-hoc diagnostic script) can reconstruct why the pipeline produced a given output without rerunning it.

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

The history page computes a **rolling standard deviation of CdA over a window of 10 consecutive rides**, plotted over time. Each point is coloured by the majority sensor in its σ window, and the line is smoothed with a Catmull-Rom cubic spline so trend changes are readable even on a noisy dataset. Horizontal reliability bands (green < 0.03, yellow 0.03–0.05, red > 0.05) give a quick visual cue of whether the current regime is good enough to detect a real CdA change.

A sudden drop in the rolling σ corresponds to a sensor swap or a calibration fix; a sudden rise reveals the opposite. The chart makes it easy to see *when* the user's data became reliable, independently of the absolute CdA value.

**Dedup on re-analysis.** When the same ride is analysed twice (e.g. after a Crr change or a pipeline fix), the timeline keeps only the most recent version of each `(athleteKey, rideDate)` pair — the older result is automatically replaced. Without this, re-running a batch would stack duplicate points on the same date and distort the rolling σ window.

### 8b. Per-sensor calibration bias histogram

Below the timeline, a **KDE bell curve per power meter** shows the distribution of the calibration bias ratio (measured ÷ theoretical watts on flat pedaling). A well-calibrated sensor centres on 1.0 with a tight spread; a drifting sensor shows a wide distribution; a systematically-biased sensor sits off-centre. The kernel bandwidth uses Silverman's rule with a floor at 0.03 so small per-sensor samples don't collapse into spikes. A vertical marker drops from each curve's estimated mean to the baseline for easy comparison.

### 9. Profiles: saved setups with one-click recall

A single AeroProfile installation is often used to analyse several cyclists or several setups (your road bike vs TT bike, pre-position-change vs post). A profile is a **saved setup** — it remembers every field you would otherwise retype on each analysis:

- **Upload mode** — mass, bike type, position preset, Crr setting, nRMSE threshold.
- **Intervals mode** — all of the above, plus your Intervals.icu API key and athlete id, plus the entire ride-filter state (distance range, max D+, pente moyenne max, min duration, exclude-group toggle).

The "Moi" profile is pre-seeded with sensible defaults (75 kg, road, Aéro drops, Crr fixed at 0.0032 = modern GP5000 tubeless, nRMSE 45%) so a fresh install has one profile ready to go. The "Auto" Crr mode is available in expert settings but no longer the default — on real-world rides the speed variety is rarely high enough to separate CdA from Crr reliably, and the Auto fallback ended up pinning ~70% of rides at Crr = 0.005 anyway. Fixing Crr to a tyre preset gives tighter CdA estimates and eliminates the Crr bound-hit class of failures entirely. The **ProfilePicker** toolbar at the top of each mode has:

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

### 11. Aggregate statistics (Method A and Method B)

AeroProfile reports two independent aggregate CdA values when more than one ride is analysed:

- **Method A — weighted mean.** Each ride contributes `w_i = valid_points_i × quality_weight_i` where `quality_weight_i` interpolates between 1.0 (worst nRMSE in the batch) and 3.0 (best). The aggregate is `Σ(w_i · CdA_i) / Σw_i`. The IC95 is computed from a **weighted** sample variance `Σ(w_i · (CdA_i − μ)²) / Σw_i` — consistent with the weighting of the mean (an earlier version used an unweighted variance, which made short rides pollute the uncertainty). The standard error is `σ_w / √n` for the mean's interval.

- **Method B — hierarchical random-effects (joint MLE).** When ≥ 5 valid rides are available, a single joint optimisation fits `(μ, τ, [Crr,] CdA_1, …, CdA_N)` where `CdA_i ~ N(μ, τ²)` and Crr is shared across rides. τ is bounded in `[0.005, 0.40]` — an earlier version capped it at 0.20, which was reached on virtually every real-world run because the ceiling was too low. The mu CI comes from the full Laplace approximation on the joint Jacobian. Below 5 rides the method is explicitly refused with a 422 — τ is ill-defined on too few rides and the user is told to rely on Method A instead.

Both methods share the same rule: rides marked `bound_hit`, `sensor_miscalib` or `non_identifiable` are excluded; rides marked `prior_dominated`, `sensor_miscalib_warn` or `insufficient_data` are kept but badged as lower-confidence.

### 12. Performance — Method B batches

Running Method B on a year of Intervals.icu rides used to take ~8 min on a warm cache (the rate-limit sleep between Open-Meteo tiles was unconditional, even for cache hits). Two changes cut this to ~30 s:

- **Skip sleep on cache hits**: `fetch_weather_tiled` tracks whether the previous tile was a real network call or a cache lookup, and only sleeps 300 ms between *network* calls.
- **Parallel preprocess**: `/analyze-batch` preprocesses up to 4 rides concurrently via an `asyncio.Semaphore(4)` instead of sequentially.
- **Shared preprocess cache**: `aeroprofile/api/preprocess_cache.py` holds an LRU of raw FIT bytes AND preprocessed `(df, ride)` tuples keyed by `(athlete, activity, mass, eta)`. When Method B runs right after a Method A loop over the same rides, the batch endpoint reuses everything instead of re-downloading and re-preprocessing.

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

