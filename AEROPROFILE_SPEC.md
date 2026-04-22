# AeroProfile — Spécification technique définitive

> **Ce document est la spécification complète du projet AeroProfile.**
> Il est destiné à Claude Code comme brief pour coder l'intégralité du projet.
> Lis-le entièrement avant de commencer à coder quoi que ce soit.

---

## 1. Vision du projet

### Qu'est-ce que AeroProfile ?

AeroProfile est un outil **open-source** (licence AGPL-3.0-or-later) qui calcule le **coefficient de traînée aérodynamique (CdA)** et la **résistance au roulement (Crr)** d'un cycliste à partir d'un fichier d'activité contenant des données de puissance (capteur de puissance obligatoire).

Formats supportés : **.FIT**, **.GPX** (avec extension power), **.TCX** — c'est-à-dire tous les formats courants qui transportent des données de puissance cyclisme.

L'outil récupère automatiquement les **données de vent historiques** (vitesse + direction) via l'API gratuite Open-Meteo pour chaque point GPS de la sortie, et résout le système physique pour extraire CdA et Crr.

**Valeur ajoutée unique** : si les valeurs CdA/Crr calculées sont aberrantes, l'outil **alerte l'utilisateur d'une potentielle erreur de calibration** de son capteur de puissance, en quantifiant l'offset probable en watts.

### Pourquoi ce projet ?

Les outils existants (MyCdA.app, Fast Aero Lab, AeroStar) exigent un **protocole de test spécifique** : boucles sur circuit fermé, vélodrome, laps à vitesses contrôlées. Aucun outil open-source ne permet d'analyser une **sortie normale** (cyclosportive, entraînement, randonnée) avec correction automatique du vent.

Le seul outil qui s'en approche est le "CdA Calculator" de jjrw96 (ShinyApps), mais il ne supporte que le GPX, n'a pas de détection d'anomalies, et son solveur est basique.

### Utilisateur cible

Cyclistes avec capteur de puissance qui veulent :
1. Connaître leur CdA pour optimiser leur position
2. Vérifier la cohérence de leur capteur de puissance
3. Comparer l'aéro entre deux sorties (changement de position, de roues, de casque...)

---

## 2. Architecture technique

### Stack

- **Backend / moteur de calcul** : Python 3.12+
- **API** : FastAPI
- **Frontend** : React + Vite + TypeScript + Tailwind CSS + Recharts
- **Carte** : maplibre-gl (open-source, pas de clé API)
- **API météo** : Open-Meteo Historical (gratuit, pas de clé API)
- **Parsing** : fitparse (FIT), gpxpy (GPX), lxml (TCX)
- **Optimisation** : scipy.optimize.least_squares
- **CLI** : click
- **Licence** : AGPL-3.0-or-later
- **Nom** : `aeroprofile`

### Arborescence

```
aeroprofile/
├── README.md
├── LICENSE                         # AGPL-3.0-or-later
├── pyproject.toml
├── requirements.txt
│
├── aeroprofile/                    # Package Python principal
│   ├── __init__.py
│   │
│   ├── parsers/                    # Parsing multi-format
│   │   ├── __init__.py
│   │   ├── models.py              # Dataclasses RideData / RidePoint
│   │   ├── fit_parser.py           # .FIT → RideData
│   │   ├── gpx_parser.py           # .GPX → RideData
│   │   ├── tcx_parser.py           # .TCX → RideData
│   │   └── auto_parser.py          # Détection auto du format + dispatch
│   │
│   ├── weather/                    # Données météo
│   │   ├── __init__.py
│   │   ├── open_meteo.py           # Client API Open-Meteo Historical
│   │   └── interpolation.py        # Interpolation temporelle vent/temp
│   │
│   ├── physics/                    # Modèle physique
│   │   ├── __init__.py
│   │   ├── constants.py            # g, R_air, R_vapor, etc.
│   │   ├── air_density.py          # Calcul ρ
│   │   ├── wind.py                 # Bearing, V_air, headwind
│   │   └── power_model.py          # Équation Martin et al. (1998)
│   │
│   ├── solver/                     # Optimisation CdA/Crr
│   │   ├── __init__.py
│   │   ├── optimizer.py            # least_squares multi-start + CI
│   │   └── virtual_elevation.py    # Méthode Chung (validation visuelle)
│   │
│   ├── filters/                    # Filtrage des données
│   │   ├── __init__.py
│   │   ├── segment_filter.py       # Tous les filtres
│   │   └── drafting_detector.py    # Détection drafting (nice to have)
│   │
│   ├── anomaly/                    # Détection d'anomalies
│   │   ├── __init__.py
│   │   └── calibration_check.py    # Plages, dérive, asymétrie, offset
│   │
│   ├── pipeline.py                 # Orchestrateur : fichier → résultats
│   │
│   ├── api/                        # API FastAPI
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── routes.py
│   │   └── schemas.py              # Pydantic models
│   │
│   └── cli.py                      # Interface CLI (click)
│
├── frontend/                       # React + Vite + TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ParameterForm.tsx
│   │   │   ├── ResultsDashboard.tsx
│   │   │   ├── AnomalyAlerts.tsx
│   │   │   ├── AltitudeChart.tsx
│   │   │   ├── CdARollingChart.tsx
│   │   │   ├── PowerDecomposition.tsx
│   │   │   ├── PowerScatter.tsx
│   │   │   ├── ResidualsHistogram.tsx
│   │   │   ├── SpeedCdAScatter.tsx
│   │   │   └── MapView.tsx
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── types/
│   │       └── index.ts
│   └── index.html
│
├── tests/
│   ├── test_parsers.py
│   ├── test_physics.py
│   ├── test_solver.py
│   ├── test_filters.py
│   ├── test_weather.py
│   └── fixtures/                   # Fichier FIT de test
│
└── .github/
    └── workflows/
        └── ci.yml                  # Tests + lint
```

### Dépendances Python

```
fitparse>=1.2.0          # Parse fichiers .FIT
gpxpy>=1.6.0             # Parse fichiers .GPX
lxml>=5.0.0              # Parse fichiers .TCX (XML)
scipy>=1.12.0            # Optimisation (least_squares)
numpy>=1.26.0            # Calcul numérique
pandas>=2.2.0            # DataFrames
httpx>=0.27.0            # Client HTTP async pour Open-Meteo
fastapi>=0.110.0         # API web
uvicorn>=0.29.0          # Serveur ASGI
python-multipart>=0.0.9  # Upload de fichiers FastAPI
pydantic>=2.6.0          # Validation données
click>=8.1.0             # CLI
```

### Dépendances Frontend

```
react, react-dom
typescript, vite
recharts                    # Graphiques
maplibre-gl, react-map-gl   # Carte open-source
tailwindcss
lucide-react                # Icônes
```

---

## 3. Modèle physique — LE CŒUR DU PROJET

### 3.1. Équation de puissance (Martin et al., 1998)

```
P_measured × η = P_aero + P_rolling + P_gravity + P_accel

Où :
  P_aero    = 0.5 × CdA × ρ × V_air² × V_ground
  P_rolling = Crr × m × g × cos(θ) × V_ground
  P_gravity = m × g × sin(θ) × V_ground
  P_accel   = m × a × V_ground
```

**ATTENTION** : P_aero utilise `V_air²` (vitesse relative à l'air, au carré) multipliée par `V_ground` (vitesse au sol). C'est PAS `V_air³`. La force aéro dépend de V_air, mais la puissance = force × V_ground.

Variables :
- `CdA` : coefficient aéro × surface frontale (m²) — **à déterminer**
- `Crr` : coefficient de résistance au roulement — **à déterminer**
- `ρ` : densité de l'air (kg/m³) — calculée par point
- `V_air` : vitesse cycliste par rapport à l'air (m/s) — corrigée du vent
- `V_ground` : vitesse au sol (m/s) — du fichier d'activité
- `m` : masse totale cycliste + vélo (kg) — saisie utilisateur
- `g` : 9.80665 m/s²
- `θ` : angle pente = arctan(gradient)
- `a` : accélération (m/s²) = ΔV/Δt
- `η` : rendement transmission = 0.976 par défaut (configurable)

### 3.2. Densité de l'air (ρ)

Calculer pour CHAQUE point (ρ varie de ~1.05 à ~1.25 selon altitude et température, soit ~15% d'impact direct sur le CdA).

```python
def compute_rho(altitude_m, temperature_celsius, humidity_percent=50.0, surface_pressure_hpa=None):
    T_kelvin = temperature_celsius + 273.15
    
    # Pression : utiliser surface_pressure si disponible (Open-Meteo), sinon ISA
    if surface_pressure_hpa is not None:
        P_atm = surface_pressure_hpa * 100  # hPa → Pa
    else:
        P_atm = 101325 * (1 - 0.0065 * altitude_m / 288.15) ** 5.2561
    
    # Pression de vapeur (Magnus)
    e_sat = 611.2 * exp(17.67 * temperature_celsius / (temperature_celsius + 243.5))
    e = (humidity_percent / 100.0) * e_sat
    
    # Densité (loi gaz parfaits corrigée humidité)
    rho = (P_atm - 0.3783 * e) / (287.05 * T_kelvin)
    return rho
```

### 3.3. Vent et V_air

```python
def compute_bearing(lat1, lon1, lat2, lon2):
    """Cap du cycliste en degrés (0=Nord, 90=Est)."""
    dlon = radians(lon2 - lon1)
    lat1_r, lat2_r = radians(lat1), radians(lat2)
    x = sin(dlon) * cos(lat2_r)
    y = cos(lat1_r) * sin(lat2_r) - sin(lat1_r) * cos(lat2_r) * cos(dlon)
    return (degrees(atan2(x, y)) + 360) % 360

def compute_v_air(v_ground, bearing_deg, wind_speed_ms, wind_dir_deg, wind_height_factor=0.7):
    """
    Calcule la vitesse effective de l'air.
    
    wind_dir_deg : direction D'OÙ vient le vent (convention météo, 0=Nord)
    wind_height_factor : correction 10m → 1m (0.7 par défaut en terrain dégagé)
    """
    wind_at_rider = wind_speed_ms * wind_height_factor
    
    headwind = wind_at_rider * cos(radians(wind_dir_deg - bearing_deg))
    v_air = v_ground + headwind
    return v_air  # Peut être négatif → filtrer ces points
```

**CORRECTION VENT 10m → 1m** : L'API Open-Meteo donne le vent à 10m de hauteur (standard météo). Un cycliste est à ~1m du sol. En terrain dégagé, le profil de vent logarithmique donne un facteur ~0.7. Ce facteur est configurable (0.5 en zone urbaine/forestière, 0.8 en rase campagne).

### 3.4. Lissage altitude et gradient (CRITIQUE)

L'altitude barométrique est bruitée (±0.2m typique). 10 cm d'erreur sur 1 seconde à 45 km/h = 0.8% de pente fantôme = 78W d'erreur dans le bilan.

```python
from scipy.signal import savgol_filter

# Savitzky-Golay : préserve mieux les ruptures de pente que la moyenne mobile
df['alt_smooth'] = savgol_filter(df['altitude'], window_length=31, polyorder=3)

# Gradient
df['gradient'] = df['alt_smooth'].diff() / df['distance'].diff().replace(0, np.nan)
df['gradient'] = df['gradient'].clip(-0.25, 0.25)  # ±25% max
df['gradient'] = df['gradient'].fillna(0)
```

### 3.5. Accélération

```python
df['speed_smooth'] = savgol_filter(df['speed'], window_length=7, polyorder=2)
dt = df['timestamp'].diff().dt.total_seconds().replace(0, np.nan)
df['acceleration'] = df['speed_smooth'].diff() / dt
df['acceleration'] = df['acceleration'].clip(-3.0, 3.0)
df['acceleration'] = df['acceleration'].fillna(0)
```

---

## 4. Modules détaillés

### 4.1. Parsers (`aeroprofile/parsers/`)

#### Schéma commun de sortie

Quel que soit le format d'entrée, le parser produit un `RideData` :

```python
@dataclass
class RidePoint:
    timestamp: datetime          # UTC
    latitude: float              # degrés décimaux
    longitude: float             # degrés décimaux
    altitude: float              # mètres (baro si dispo)
    speed: float                 # m/s
    power: float                 # watts
    cadence: Optional[float] = None
    heart_rate: Optional[float] = None
    temperature: Optional[float] = None
    distance: float = 0.0       # mètres cumulés

@dataclass
class RideData:
    points: list[RidePoint]
    sport: str = "cycling"
    start_time: datetime = None
    source_format: str = ""     # "fit", "gpx", "tcx"
    device: Optional[str] = None
```

#### FIT Parser (`fit_parser.py`)

```python
# Bibliothèque : fitparse
# Conversion semicircles → degrés : degrees = semicircles × (180 / 2^31)
#
# Champs des messages 'record' :
#   timestamp, position_lat, position_long, enhanced_altitude,
#   enhanced_speed, power, cadence, heart_rate, temperature, distance
#
# Cas edge :
#   - position_lat = None → exclure le point
#   - power = None → mettre 0
#   - Timestamps dupliqués → garder le dernier
#   - Gaps > 5s → marquer comme discontinuité
```

#### GPX Parser (`gpx_parser.py`)

```python
# Bibliothèque : gpxpy
#
# La puissance N'EST PAS dans les champs standard GPX.
# Elle est dans les extensions, avec un namespace variable selon le fabricant :
#   <power>230</power>
#   <ns3:Watts>230</ns3:Watts>
#   <gpxtpx:power>230</gpxtpx:power>
#
# Parcourir TOUTES les extensions de chaque trackpoint.
# Chercher récursivement un élément dont le tag contient "power" ou "watts" (case-insensitive).
#
# La vitesse doit être calculée si absente :
#   speed = haversine(point_n, point_n+1) / delta_time
#
# L'altitude est dans <ele> (GPS vertical, moins précis que baro).
# La température peut être dans les extensions Garmin TPv2.
```

#### TCX Parser (`tcx_parser.py`)

```python
# Format XML avec namespaces obligatoires.
#
# Structure :
#   TrainingCenterDatabase > Activities > Activity > Lap > Track > Trackpoint
#
# Champs :
#   <Time>2026-04-05T07:00:50.000Z</Time>
#   <Position><LatitudeDegrees>45.83</LatitudeDegrees><LongitudeDegrees>5.45</LongitudeDegrees></Position>
#   <AltitudeMeters>206.6</AltitudeMeters>
#   <DistanceMeters>0.0</DistanceMeters>
#   <HeartRateBpm><Value>131</Value></HeartRateBpm>
#   <Cadence>80</Cadence>
#   <Extensions><ns3:TPX><ns3:Speed>1.54</ns3:Speed><ns3:Watts>92</ns3:Watts></ns3:TPX></Extensions>
#
# Déclarer les namespaces proprement avec lxml ou ElementTree, sinon rien n'est trouvé.
# Namespace Garmin typique : "http://www.garmin.com/xmlschemas/ActivityExtension/v2"
```

#### Auto-détection (`auto_parser.py`)

```python
def parse_file(filepath: str) -> RideData:
    """Détecte le format par extension et dispatch vers le bon parser."""
    ext = Path(filepath).suffix.lower()
    if ext == '.fit':
        return parse_fit(filepath)
    elif ext == '.gpx':
        return parse_gpx(filepath)
    elif ext == '.tcx':
        return parse_tcx(filepath)
    else:
        raise ValueError(f"Format non supporté : {ext}. Formats acceptés : .fit, .gpx, .tcx")
```

#### Validation post-parsing

Après parsing, vérifier :
- Au moins 60 points avec puissance > 0
- GPS présent sur > 90% des points
- Résolution temporelle médiane ≤ 2 secondes
- Distance totale > 1 km
- Sport = cycling (si le champ existe)
- Sinon → erreur explicite retournée à l'utilisateur

### 4.2. Weather (`aeroprofile/weather/`)

#### Client Open-Meteo (`open_meteo.py`)

```python
async def fetch_weather(lat: float, lon: float, date: str) -> dict:
    """
    Appelle l'API Open-Meteo pour récupérer les données météo horaires.
    
    Endpoint principal : https://archive-api.open-meteo.com/v1/archive
    Fallback (<5 jours) : https://api.open-meteo.com/v1/forecast?...&past_days=7
    
    Paramètres :
        latitude, longitude, start_date, end_date (même jour)
        hourly: temperature_2m, relativehumidity_2m, surface_pressure,
                windspeed_10m, winddirection_10m, windgusts_10m
        timezone: auto
    
    ATTENTION :
        - windspeed_10m est en km/h → diviser par 3.6 pour m/s
        - winddirection_10m = direction D'OÙ vient le vent (convention météo)
        - Données horaires (24 points/jour) → interpolation nécessaire
        - Résolution spatiale ~10km → vent local non capturé (vallée, forêt)
    
    Pour le MVP : un seul appel au centroïde du parcours.
    V2 : multiple appels pour parcours longs (>50km), interpolation spatiale.
    """
```

#### Interpolation temporelle (`interpolation.py`)

```python
def interpolate_weather(hourly_data: dict, timestamps: list[datetime]) -> pd.DataFrame:
    """
    Interpole les données horaires pour chaque seconde de la sortie.
    
    PIÈGE DIRECTION DU VENT :
    On ne peut PAS interpoler les angles directement (359° → 1° donnerait 180°).
    
    Procédure :
    1. Décomposer en composantes vectorielles :
       u = -wind_speed * sin(radians(wind_dir))   # composante Est
       v = -wind_speed * cos(radians(wind_dir))   # composante Nord
    2. Interpoler u et v séparément (interpolation linéaire)
    3. Recomposer :
       wind_speed = sqrt(u² + v²)
       wind_dir = (degrees(atan2(-u, -v)) + 360) % 360
    
    Retourne un DataFrame avec colonnes :
    wind_speed_ms, wind_dir_deg, temperature_c, humidity_pct, surface_pressure_hpa
    """
```

### 4.3. Physics (`aeroprofile/physics/`)

```python
# constants.py
G = 9.80665           # m/s²
R_AIR = 287.05        # J/(kg·K) constante gaz air sec
R_VAPOR = 461.5       # J/(kg·K) constante gaz vapeur d'eau
ETA_DEFAULT = 0.976   # Rendement transmission

# power_model.py
def power_model(V_ground, V_air, gradient, acceleration, mass, CdA, Crr, rho, eta=0.976):
    """Retourne la puissance modélisée en watts. Vectorisé numpy."""
    theta = np.arctan(gradient)
    P_aero  = 0.5 * CdA * rho * V_air**2 * V_ground
    P_roll  = Crr * mass * G * np.cos(theta) * V_ground
    P_grav  = mass * G * np.sin(theta) * V_ground
    P_accel = mass * acceleration * V_ground
    return (P_aero + P_roll + P_grav + P_accel) / eta

def residual_power(params, V_ground, V_air, gradient, acceleration, mass, rho, P_measured, eta=0.976):
    """Vecteur de résidus (P_modèle - P_mesuré) pour chaque point. Pour least_squares."""
    CdA, Crr = params
    P_model = power_model(V_ground, V_air, gradient, acceleration, mass, CdA, Crr, rho, eta)
    return P_model - P_measured
```

### 4.4. Solver (`aeroprofile/solver/`)

#### Approche principale : least_squares multi-start

```python
from scipy.optimize import least_squares

def solve_cda_crr(df, mass, eta=0.976):
    """
    Résout CdA et Crr par moindres carrés.
    
    Utilise least_squares avec méthode 'trf' (Trust Region Reflective) :
    - Gère les bornes naturellement
    - Fournit le Jacobien pour calculer les IC analytiquement
    - Plus rapide et précis que minimize + bootstrap pour ce problème
    
    Multi-start : 3 points de départ pour éviter les minima locaux.
    """
    
    bounds_lower = [0.15, 0.002]
    bounds_upper = [0.60, 0.010]
    
    starts = [(0.25, 0.003), (0.35, 0.005), (0.45, 0.007)]
    best = None
    
    for x0 in starts:
        result = least_squares(
            residual_power, x0=x0,
            args=(df['v_ground'], df['v_air'], df['gradient'],
                  df['acceleration'], mass, df['rho'], df['power']),
            bounds=(bounds_lower, bounds_upper),
            method='trf',
        )
        if best is None or result.cost < best.cost:
            best = result
    
    cda, crr = best.x
    ci = confidence_intervals(best)
    r_squared = compute_r_squared(best.fun, df['power'])
    
    return SolverResult(cda=cda, crr=crr, ci=ci, r_squared=r_squared, residuals=best.fun)


def confidence_intervals(result):
    """
    IC 95% depuis la matrice Jacobienne de least_squares.
    
    - Variance résiduelle : s² = cost / (n - p)
    - Covariance : C = s² × (J^T × J)^(-1)
    - IC 95% : param ± 1.96 × sqrt(diag(C))
    """
    J = result.jac
    n = len(result.fun)
    p = len(result.x)
    s2 = result.cost / (n - p)
    cov = s2 * np.linalg.inv(J.T @ J)
    se = np.sqrt(np.diag(cov))
    return {
        'cda': (result.x[0] - 1.96*se[0], result.x[0] + 1.96*se[0]),
        'crr': (result.x[1] - 1.96*se[1], result.x[1] + 1.96*se[1]),
    }
```

#### Détection corrélation CdA/Crr

```python
def check_speed_variety(df):
    """
    Si la sortie n'a pas assez de variété de vitesse, CdA et Crr sont
    indistinguables (corrélés). Détecter ce cas.
    """
    speed_std = df['v_ground'].std()
    if speed_std < 1.5:  # < ~5.4 km/h d'écart-type
        return True, ("Variété de vitesse insuffisante pour séparer CdA et Crr. "
                      "Crr sera fixé à 0.005 (valeur par défaut route). "
                      "Pour résoudre les deux, faites une sortie avec montées ET plat rapide.")
    return False, ""
```

#### Virtual Elevation (méthode Chung, pour validation visuelle)

```python
def virtual_elevation(df, CdA, Crr, mass, eta=0.976):
    """
    Calcule l'altitude 'virtuelle' depuis le bilan d'énergie.
    Si CdA/Crr sont corrects, altitude virtuelle ≈ altitude GPS.
    L'écart sert de métrique de qualité et de graphique dans le frontend.
    """
    v_elev = np.zeros(len(df))
    for i in range(1, len(df)):
        dt = (df['timestamp'].iloc[i] - df['timestamp'].iloc[i-1]).total_seconds()
        if dt <= 0: continue
        
        v = df['v_ground'].iloc[i]
        v_air = df['v_air'].iloc[i]
        rho = df['rho'].iloc[i]
        P = df['power'].iloc[i]
        
        E_input = P * eta * dt
        E_aero = 0.5 * CdA * rho * v_air**2 * v * dt
        E_roll = Crr * mass * G * v * dt
        E_accel = 0.5 * mass * (df['v_ground'].iloc[i]**2 - df['v_ground'].iloc[i-1]**2)
        
        E_potential = E_input - E_aero - E_roll - E_accel
        delta_h = E_potential / (mass * G)
        v_elev[i] = v_elev[i-1] + delta_h
    
    return v_elev
```

### 4.5. Filters (`aeroprofile/filters/`)

**CRITIQUE** — La qualité du résultat dépend du filtrage. Chaque filtre = colonne booléenne dans le DataFrame.

```python
def apply_filters(df):
    """
    Ajoute des colonnes de filtrage :
    
    - filter_stopped        : V_ground < 1.0 m/s (~3.6 km/h)
    - filter_low_speed      : V_ground < 4.0 m/s (~14.4 km/h, CdA indétectable)
    - filter_no_power       : power == 0 et V_ground > 3 m/s (roue libre)
    - filter_braking        : acceleration < -1.5 m/s²
    - filter_hard_accel     : acceleration > 1.5 m/s²
    - filter_steep_climb    : gradient > 0.08 (>8%, gravité >> aéro)
    - filter_steep_descent  : gradient < -0.08
    - filter_sharp_turn     : |Δbearing| > 20°/s
    - filter_negative_v_air : V_air ≤ 0 (vent arrière > vitesse sol)
    - filter_gps_jump       : distance entre 2 points > 50m (artefact GPS)
    - filter_power_spike    : power > 3 × normalized_power (spike capteur)
    
    Colonne finale : filter_valid = NOT(any filter above)
    Après filtrage, ne garder que les blocs continus ≥ 10 secondes.
    """
```

#### Détection drafting (nice to have, V2)

```python
# Heuristique : si P_measured << P_model_solo (>25% en dessous)
# à haute vitesse (>30 km/h) sur le plat → probable drafting
# Aussi : CdA instantané < 0.18 en position route → physiquement impossible seul
# → Flaguer pour l'utilisateur, ne pas exclure automatiquement
```

### 4.6. Anomaly (`aeroprofile/anomaly/`)

La feature qui différencie AeroProfile des autres outils.

```python
def detect_anomalies(cda, crr, ci, residuals, df):
    """
    Retourne une liste d'anomalies avec sévérité (error/warning/info).
    
    1. CdA hors plage physique
       - < 0.15 → ERROR: "CdA impossible. Capteur surcalibré (lit trop haut)."
       - > 0.55 → ERROR: "CdA impossible. Capteur sous-calibré (lit trop bas) ou poids saisi trop faible."
    
    2. Crr hors plage
       - < 0.002 → WARNING: "Crr anormalement bas."
       - > 0.008 → WARNING: "Crr élevé. Pneus sous-gonflés ou terrain non asphalté ?"
    
    3. IC trop large
       - IC 95% CdA > 0.10 → WARNING: "Estimation imprécise. Pas assez de segments exploitables."
    
    4. Biais directionnel des résidus
       - mean(résidus) > 10W → WARNING: "Biais positif. Capteur pourrait lire ~{mean}W trop bas."
       - mean(résidus) < -10W → WARNING: "Biais négatif. Capteur pourrait lire ~{|mean|}W trop haut."
    
    5. Dérive temporelle
       - Calculer CdA par quart de sortie (Q1, Q2, Q3, Q4).
       - Si CdA dérive de >15% entre Q1 et Q4 → WARNING: "CdA instable, possible dérive de calibration."
    
    6. Asymétrie montée/descente
       - CdA_montée vs CdA_descente différence > 20%
       → WARNING: "Incohérence montée/descente. Erreur de poids ou d'altitude possible."
    
    7. Quantification offset (si anomalie CdA détectée)
       - offset_W = mean(P_measured - P_model_with_typical_CdA)
       - "Offset estimé : {offset_W:+.0f}W. Avez-vous calibré votre capteur avant la sortie ?"
    """
```

### 4.7. Pipeline (`aeroprofile/pipeline.py`)

Orchestrateur qui enchaîne tous les modules :

```python
async def analyze(filepath, mass_kg, crr_fixed=None, eta=0.976, wind_height_factor=0.7):
    """
    Pipeline complète :
    
    1. auto_parser.parse_file(filepath) → RideData
    2. Convertir RideData → DataFrame pandas
    3. Calculer dérivées : gradient (Savitzky-Golay), accélération, bearing
    4. fetch_weather(lat_center, lon_center, date) → données horaires
    5. interpolate_weather() → vent/temp/humidity/pressure par seconde
    6. compute_v_air() et compute_rho() pour chaque point
    7. apply_filters() → DataFrame filtré
    8. check_speed_variety() → si insuffisant, fixer Crr
    9. solve_cda_crr() → CdA, Crr, IC, résidus, R²
    10. virtual_elevation() → altitude virtuelle
    11. detect_anomalies() → alertes
    12. Packager dans AnalysisResult
    """
```

---

## 5. API Backend (FastAPI)

### Endpoints

```
POST /api/analyze
  Body: multipart/form-data
    file: .fit / .gpx / .tcx
    mass_kg: float
    crr_fixed: float | null
    eta: float = 0.976
    wind_height_factor: float = 0.7
  Response: AnalysisResult (JSON)

GET /api/health
  Response: { "status": "ok" }
```

### Modèle de réponse

```python
class AnalysisResult(BaseModel):
    # Résultats principaux
    cda: float
    cda_ci_low: float
    cda_ci_high: float
    crr: float
    crr_ci_low: float
    crr_ci_high: float
    r_squared: float
    
    # Contexte sortie
    ride_date: str
    ride_distance_km: float
    ride_duration_s: float
    ride_elevation_gain_m: float
    avg_speed_kmh: float
    avg_power_w: float
    avg_rho: float
    avg_wind_speed_ms: float
    avg_wind_dir_deg: float
    source_format: str
    
    # Segments
    total_points: int
    valid_points: int
    filter_summary: dict[str, int]     # { "filter_stopped": 423, ... }
    
    # Anomalies
    anomalies: list[Anomaly]
    
    # Données pour graphiques (sous-échantillonnées si > 5000 points)
    profile: ProfileData
    
class ProfileData(BaseModel):
    distance_km: list[float]
    altitude_real: list[float]
    altitude_virtual: list[float]
    cda_rolling: list[float | None]    # CdA glissant 10 min
    power_measured: list[float]
    power_modeled: list[float]
    p_aero: list[float]
    p_gravity: list[float]
    p_rolling: list[float]
    wind_speed_ms: list[float]
    wind_dir_deg: list[float]
    rho: list[float]
    filter_valid: list[bool]
    lat: list[float]
    lon: list[float]
```

---

## 6. CLI

```bash
# Usage basique
aeroprofile analyze ride.fit --mass 80

# Crr fixé
aeroprofile analyze ride.fit --mass 80 --crr 0.004

# Fichier GPX
aeroprofile analyze ride.gpx --mass 75

# Output JSON
aeroprofile analyze ride.fit --mass 80 --format json > results.json

# Debug verbose
aeroprofile analyze ride.fit --mass 80 --verbose
```

Output attendu :
```
🚴 AeroProfile — Analyse aérodynamique
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fichier  : ride.fit
Format   : FIT (Garmin)
Date     : 2026-04-05
Distance : 84.8 km | D+ : 1312 m | Durée : 3h20

📡 Récupération données vent... OK (Open-Meteo)
   Vent moyen : 12 km/h NO | ρ moyen : 1.145 kg/m³

🔬 Analyse sur 7,241 points (60.4% du total après filtrage)
   Points exclus : 4,743
     - arrêt / très lent    : 1,540
     - roue libre            :   892
     - pente forte (>8%)     : 1,203
     - accélération / freinage:  688
     - GPS / spikes          :   420

📊 Résultats
   CdA = 0.342 m²  [IC 95% : 0.318 — 0.366]
   Crr = 0.0041     [IC 95% : 0.0032 — 0.0050]
   R²  = 0.847

⚠️  Alertes
   Aucune anomalie détectée. Capteur cohérent.
```

---

## 7. Frontend

### Composants

#### `FileUpload.tsx`
- Zone drag & drop pour .FIT / .GPX / .TCX
- Indication du format détecté après upload
- Formulaire paramètres :
  - Masse totale (kg) — input numérique, obligatoire
  - Section "Options avancées" dépliable : η, Crr fixe, facteur vent
- Bouton "Analyser" → spinner pendant calcul

#### `ResultsDashboard.tsx`
- **Stat cards** : CdA ± IC, Crr ± IC, R², ρ moyen, vent moyen
- Layout en sections scrollables

#### `AnomalyAlerts.tsx`
- Cards colorées : ERROR = rouge, WARNING = orange, INFO = bleu
- Titre + explication + chiffre (ex: "Offset estimé : −8W")
- Suggestion d'action

#### `AltitudeChart.tsx`
- Altitude réelle vs altitude virtuelle (validation Chung) vs distance
- Zones filtrées en gris, zones utilisées en couleur

#### `CdARollingChart.tsx`
- CdA glissant 10 min au fil de la distance
- Ligne horizontale = CdA moyen estimé
- Bandes IC 95%

#### `PowerDecomposition.tsx`
- Stacked area chart : P_aero + P_gravity + P_rolling + P_accel vs distance
- Permet de voir quelle force domine où

#### `PowerScatter.tsx`
- Scatter plot P_modèle vs P_mesuré
- Droite y=x en pointillé (fit parfait)
- Coloration par vitesse ou gradient

#### `ResidualsHistogram.tsx`
- Distribution des résidus (doit être centrée sur 0, gaussienne)
- Si biaisé → indique un problème systématique

#### `SpeedCdAScatter.tsx`
- CdA instantané vs vitesse
- Si corrélation visible → problème Crr ou vent

#### `MapView.tsx`
- Parcours sur carte maplibre-gl
- Coloré par CdA instantané (vert = bon, rouge = haut)
- Flèches de vent aux points horaires

### Design

- **Thème sombre** par défaut (cohérent avec Intervals.icu, Strava dark)
- **Palette** : fond #0a0a0f, teal #1D9E75 (valeurs normales), coral #E8654A (alertes), bleu #3B82F6 (info)
- **Typo** : JetBrains Mono pour les chiffres, DM Sans pour le texte
- **Responsive** : desktop-first, fonctionnel sur mobile

---

## 8. Tests

### Tests unitaires obligatoires

```python
# test_physics.py
def test_power_flat_no_wind():
    """Plat, pas de vent, 30 km/h, 80kg → ~150-200W."""
    P = power_model(V_ground=8.33, V_air=8.33, gradient=0, acceleration=0,
                    mass=80, CdA=0.35, Crr=0.004, rho=1.2)
    assert 140 < P < 220

def test_power_climb():
    """Montée 8%, 12 km/h, 80kg → gravité domine → 200-280W."""
    P = power_model(V_ground=3.33, V_air=3.33, gradient=0.08, acceleration=0,
                    mass=80, CdA=0.35, Crr=0.004, rho=1.15)
    assert 200 < P < 280

def test_power_descent():
    """Descente -5%, 50 km/h, pas de pédalage → P négatif."""
    P = power_model(V_ground=13.89, V_air=13.89, gradient=-0.05, acceleration=0,
                    mass=80, CdA=0.35, Crr=0.004, rho=1.2)
    assert P < 0

def test_headwind_increases_power():
    """Vent de face 20 km/h → V_air augmente → puissance augmente >50%."""
    P_calm = power_model(8.33, 8.33, 0, 0, 80, 0.35, 0.004, 1.2)
    P_wind = power_model(8.33, 8.33+5.56, 0, 0, 80, 0.35, 0.004, 1.2)
    assert P_wind > P_calm * 1.5

def test_rho_sea_level():
    """ρ au niveau de la mer, 15°C, 50% humidity → ~1.22."""
    rho = compute_rho(0, 15, 50)
    assert 1.20 < rho < 1.24

def test_rho_altitude():
    """ρ à 1500m, 25°C → ~1.05."""
    rho = compute_rho(1500, 25, 50)
    assert 1.02 < rho < 1.08

# test_solver.py
def test_solver_synthetic():
    """Données synthétiques CdA=0.35 Crr=0.004 + bruit → solveur retrouve ±10%."""
    # Générer 1000 points avec V aléatoire 15-45 km/h, gradient aléatoire -3%..+5%
    # P = power_model(..., CdA=0.35, Crr=0.004, ...) + bruit gaussien ±20W
    # Résoudre → CdA dans [0.315, 0.385], Crr dans [0.003, 0.005]
    ...

# test_parsers.py
def test_fit_parser():
    """Parser le fichier de test → >10000 points, GPS complet, puissance > 0."""
    data = parse_fit("tests/fixtures/i137344348_Cyclo_dans_lAin_.fit")
    assert len(data.points) > 10000
    assert all(p.latitude is not None for p in data.points)
    assert sum(1 for p in data.points if p.power > 0) > 5000

# test_filters.py
def test_stopped_filtered():
    """Points à V=0 exclus."""
    ...

def test_steep_climb_filtered():
    """Points à gradient > 8% exclus."""
    ...
```

---

## 9. Valeurs de référence CdA et Crr

### CdA typiques (m²)

| Position | CdA |
|---|---|
| CLM pro (Superman) | 0.17 – 0.20 |
| CLM amateur bien réglé | 0.21 – 0.25 |
| Route, mains en bas (drops) | 0.28 – 0.32 |
| Route, mains sur cocottes (hoods) | 0.32 – 0.38 |
| Route, position relevée | 0.38 – 0.45 |
| Position très droite / VTT | 0.45 – 0.55 |

### Crr typiques

| Pneu / surface | Crr |
|---|---|
| Boyaux vélodrome | 0.002 – 0.003 |
| Pneu route tubeless (GP5000, etc.) | 0.003 – 0.004 |
| Pneu route clincher standard | 0.004 – 0.006 |
| Route granuleuse / dégradée | 0.006 – 0.008 |
| Gravel / pneu large | 0.007 – 0.010 |

---

## 10. Ordre de développement

### Phase 1 — Core Python fonctionnel (CLI)

1. `parsers/models.py` — Dataclasses RideData/RidePoint
2. `parsers/fit_parser.py` — Parser FIT complet
3. `parsers/gpx_parser.py` — Parser GPX avec extraction puissance extensions
4. `parsers/tcx_parser.py` — Parser TCX avec namespaces
5. `parsers/auto_parser.py` — Auto-détection format
6. `physics/constants.py` + `physics/air_density.py`
7. `physics/wind.py` + `physics/power_model.py`
8. `weather/open_meteo.py` — Client HTTP (httpx) avec fallback forecast
9. `weather/interpolation.py` — Interpolation temporelle vectorielle
10. `filters/segment_filter.py` — Tous les filtres
11. `solver/optimizer.py` — least_squares multi-start + CI Jacobienne
12. `solver/virtual_elevation.py` — Méthode Chung
13. `anomaly/calibration_check.py` — 7 types d'anomalies
14. `pipeline.py` — Orchestrateur
15. `cli.py` — Interface CLI (click)
16. Tests unitaires (test_physics, test_solver, test_parsers, test_filters)

**Validation** : `aeroprofile analyze fixture.fit --mass 80` fonctionne et retourne CdA ∈ [0.28, 0.42].

### Phase 2 — API + Frontend

17. `api/schemas.py` — Pydantic models
18. `api/routes.py` — Endpoint /api/analyze
19. `api/app.py` — FastAPI app
20. Frontend : FileUpload + ParameterForm
21. Frontend : ResultsDashboard + stat cards
22. Frontend : Graphiques (Recharts) un par un
23. Frontend : AnomalyAlerts
24. Frontend : MapView (maplibre-gl)

### Phase 3 — Polish

25. Détection drafting (nice to have)
26. Export résultats JSON / CSV
27. CI/CD GitHub Actions
28. README complet + documentation + exemples
29. Logo + landing page

---

## 11. Données de test

Fichier FIT de référence : `i137344348_Cyclo_dans_lAin_.fit` (353 KB)

- 84.8 km dans l'Ain, France (45.83°N, 5.45°E)
- 11 984 points à 1 seconde
- D+ 1312m, altitude 198m → 1010m
- Puissance moy 190W, max 616W, NP 192W, FTP 240W
- Cadence moy 80 rpm
- Bonne variété vitesses (10–54 km/h)
- 63 min segments quasi-plats > 25 km/h (idéal CdA)
- 38 min montée lente 10–15 km/h (pour séparer Crr)
- Date : 5 avril 2026, 07:00–10:20 UTC

**Résultat attendu** : CdA ∈ [0.28, 0.42], Crr ∈ [0.003, 0.007]. Si CdA > 0.55 ou < 0.15 → bug dans le modèle.

---

## 12. Références scientifiques

1. **Martin, J.C., Milliken, D.L., Cobb, J.E., McFadden, K.L., & Coggan, A.R. (1998).** "Validation of a Mathematical Model for Road Cycling Power." *Journal of Applied Biomechanics*, 14(3), 276–291.

2. **Chung, R.** "Estimating CdA with a power meter." — Méthode Virtual Elevation.

3. **Martin, J.C., et al. (2006).** "Aerodynamic drag area of cyclists determined with field-based measures." *Sportscience* 10: 68-69.

4. **Open-Meteo API** : https://open-meteo.com/en/docs/historical-weather-api

---

## 13. Pièges critiques — Récapitulatif

| Piège | Conséquence si ignoré | Solution |
|---|---|---|
| FIT semicircles | GPS totalement faux | `deg = semi × (180 / 2³¹)` |
| GPX power dans extensions | Pas de puissance → projet inutilisable | Chercher récursivement "power"/"watts" dans toutes les extensions |
| TCX namespaces XML | lxml ne trouve rien | Déclarer les namespaces Garmin |
| P_aero = V_air² × V_ground | Si V_air³ → CdA faux de ~20% | Relire Martin et al. |
| ρ calculé une seule fois | 15% d'erreur CdA en montagne | Calculer par point |
| Vent Open-Meteo en km/h | Vent doublé → CdA complètement faux | ÷ 3.6 |
| Vent à 10m de hauteur | CdA surestimé de ~10-15% | × 0.7 pour corriger |
| Interpolation angle vent | 359°→1° → 180° | Décomposer u,v avant interpolation |
| Altitude non lissée | 78W fantômes par 10cm d'erreur | Savitzky-Golay window=31 |
| CdA/Crr corrélés | Résultat indéterminé | Détecter + fixer Crr si vitesse monotone |
| Minimum local solveur | CdA erroné | Multi-start (3 x0) |
| Archive Open-Meteo < 5 jours | API retourne vide / erreur | Fallback vers forecast API |
| Signe convention vent | Headwind/tailwind inversé | wind_dir = direction D'OÙ vient le vent |
