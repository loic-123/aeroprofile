# AeroProfile

Open-source tool that computes a cyclist's **CdA** (aerodynamic drag area) and **Crr** (rolling resistance coefficient) from a power-meter activity file (.FIT, .GPX, .TCX), with automatic historical wind correction via Open-Meteo.

**Unique value**: if the computed CdA/Crr are physically implausible, AeroProfile flags a likely power-meter calibration issue and quantifies the probable offset in watts.

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

### API

```bash
uvicorn aeroprofile.api.app:app --reload
# POST a file to http://localhost:8000/api/analyze
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## How it works

AeroProfile solves the Martin et al. (1998) cycling power equation:

```
P = (0.5 × CdA × ρ × V_air² × V_ground + Crr × m × g × cos(θ) × V_ground
     + m × g × sin(θ) × V_ground + m × a × V_ground) / η
```

Given measured power, speed, altitude/gradient, acceleration, and point-wise air density (computed from altitude/temperature/humidity) and wind-corrected air speed, a least-squares solver with multi-start finds the (CdA, Crr) pair that best fits the data.

Wind data is fetched automatically from Open-Meteo Historical API (no API key required), corrected from 10 m standard height to ~1 m rider height.

## License

MIT
