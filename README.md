# AeroProfile

Open-source tool that computes a cyclist's **CdA** (aerodynamic drag area) and **Crr** (rolling resistance coefficient) from a power-meter activity file (`.fit`, `.gpx`, `.tcx`), with automatic historical wind correction via Open-Meteo.

Live demo: **https://aeroprofile.onrender.com**

**What makes it different**

- Analyses *any* regular ride — no need for a controlled protocol (no velodrome, no loops, no pre-arranged out-and-back).
- Detects likely **power-meter calibration issues** and quantifies the probable offset in watts from residual bias.
- **Drafting detection** — flags when the CdA looks suspiciously low for a solo rider, and in compare mode identifies the "puller" vs "drafter" between riders on the same ride.
- **Compare mode** — upload several activity files and rank riders on aero, rolling efficiency, and total drag at 40 km/h. Each rider's posture is illustrated by a cyclist silhouette matched to their CdA.
- Two independent solvers (Martin LS and Chung Virtual Elevation) with automatic fallback based on fit quality.

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
│   │  A. Wind-Inverse    │  heading variance      │
│   │     (CdA + Crr +    │  > 0.25 ?              │
│   │      wind/segment)  │──── yes ───► try it     │
│   │     Chung VE obj.   │         R² best? ──► ✓ │
│   └─────────────────────┘              │         │
│                no / R² worse           ▼         │
│   ┌─────────────────────┐                        │
│   │  B. Chung VE        │  R² > 0.3              │
│   │     (CdA + Crr,     │  and better than       │
│   │      wind = API)    │  Martin LS? ──────► ✓  │
│   └─────────────────────┘              │         │
│                no / R² worse           ▼         │
│   ┌─────────────────────┐                        │
│   │  C. Martin LS       │  Multi-start TRF       │
│   │     (CdA + Crr,     │  with Bayesian priors  │
│   │      wind = API)    │  on CdA and Crr ──► ✓  │
│   └─────────────────────┘                        │
│                                                  │
│   All solvers: η=0.977, wheel bearings,          │
│   wheel inertia (+0.14 kg), per-point ρ          │
└──────────────────────────────────────────────────┘
         ▼
┌──────────────────┐
│   6. REPORT      │  CdA ± CI, Crr ± CI, RMSE (W), R²
│                  │  CdA by gradient (flat/climb/descent)
│                  │  8 anomaly categories + drafting detection
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

Each sample is tagged with 12 boolean filters. Defaults follow the Debraux/Chung consensus:

- `power < 50 W` (Martin threshold)
- `|acceleration| > 0.3 m/s²` (unsteady)
- `|yaw_rate| > 10°/s` (cornering)
- `gradient > +8%` (climbs dominated by gravity, low aero SNR)
- `gradient < -8%` (steep descents with braking/terminal velocity)
- rolling speed CV > 15% over 15 s
- power spikes > 3·NP, GPS jumps > 50 m, negative V_air, low speed < 3 m/s, stopped, zero power

Only **contiguous blocks of ≥ 30 s** of valid samples are kept. Mid-grade descents (-3% to -8%) are kept by default because their high V_air gives a strong aero signal.

### 5. Solver

Three estimators, tried in cascade (best R² wins):

1. **Wind-Inverse** (preferred) — jointly estimates **(CdA, Crr, wind speed, wind direction)** per 30-minute segment inside a Chung VE objective. The Open-Meteo wind serves as a Gaussian prior (σ = 2 m/s per component) so the solver adjusts the wind to what the data actually says rather than trusting a 10 km grid cell. Requires heading variance > 0.25 (the rider changed direction enough for wind to be identifiable separately from CdA). On rides with heading variety this typically **doubles the R²** (e.g. 0.50 → 0.98) by removing the dominant error source.

2. **Chung VE** (fallback) — minimises `Σ(altitude_real − altitude_virtual)²` from the integrated energy balance, per-block aligned so gaps don't drift. Wind is taken from the API (not estimated). Used when heading variance is too low (linear climbs, straight roads) or when wind-inverse doesn't improve on it.

3. **Martin LS** (baseline) — `scipy.optimize.least_squares` on per-point power residuals, multi-start (3 seeds), trust-region reflective.

All three share weak Gaussian priors on Crr ~ N(0.004, 0.0015²) and CdA ~ N(0.30, 0.12²) to stabilise ill-conditioned fits. Confidence intervals come from the Jacobian at the MAP estimate (prior rows excluded).

### 6. Reporting

The dashboard reports:

- CdA and Crr with 95% intervals
- **RMSE in watts** as the headline error metric (more interpretable than R² on varied rides)
- **CdA by gradient regime** — separate estimates on flat, climbs, descents (asymmetry is diagnostic of wind error or real position change)
- Seven plots — altitude (real vs Chung-virtual), rolling CdA, power decomposition (aero/rolling/gravity/accel), P_model vs P_measured scatter, residuals histogram, CdA vs speed, and the route on a MapLibre basemap
- Eight anomaly categories: out-of-range CdA/Crr, wide CI, residual bias (quantified in W), temporal drift, climb/descent asymmetry, offset estimate, drafting suspicion
- A posture illustration matched to the estimated CdA, and derived watts-to-ride-at-V figures

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
