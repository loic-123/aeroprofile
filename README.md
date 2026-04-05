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

## How it works

### 1. Parse & derive

Multi-format parser (FIT, GPX with power extensions, TCX with Garmin namespaces) produces a unified `RideData`. The pipeline then computes per-point derivatives: Savitzky-Golay-smoothed altitude, gradient, acceleration, bearing, and a 5-second centred rolling mean on power (per Martin 1998).

### 2. Weather

For each ride we fetch **tiled historical weather** from Open-Meteo: 5 km tiles along the route (up to 6 tiles) to capture spatial variation in wind. Temperature, humidity, surface pressure and wind are interpolated onto each sample (u/v-vector blending so the 359°→1° wrap doesn't alias). Wind at 10 m is rescaled to rider height (1.3 m) with a logarithmic profile `v(z) = v_ref · ln(z/z₀) / ln(10/z₀)`, z₀ = 0.03 m in open terrain.

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

Two independent estimators:

- **Martin LS** — `scipy.optimize.least_squares` on per-point power residuals, multi-start (3 seeds), trust-region reflective, with weak Gaussian priors on Crr ~ N(0.004, 0.0015²) and CdA ~ N(0.30, 0.12²) to stabilise ill-conditioned fits.
- **Chung VE** — minimises `Σ(altitude_real − altitude_virtual)²` from the integrated energy balance, per-block aligned so gaps don't drift. The same priors are applied.

Pipeline runs Martin first and falls back to Chung when Martin's R² < 0.3 and Chung's R² is better. Confidence intervals come from the Jacobian at the MAP estimate (prior rows excluded).

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
