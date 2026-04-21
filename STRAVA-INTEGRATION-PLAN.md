# Strava integration — plan différé

**Status** : documenté, pas commencé. Priorité remise à plus tard (post-launch ou après premiers users).

## Pourquoi différé

Les 3 quick wins du sprint gap-closing (reference A/B delta, segment CdA heatmap, PWA manifest) sont livrés sur `main`. Strava est le gros morceau — ~1 semaine de dev réelle + une étape préalable côté utilisateur (création app Strava développeur, env vars VPS). Ça ne bloque pas le launch : le beachhead Intervals.icu fonctionne, et on peut vendre "Strava arrive bientôt" sur Product Hunt.

## Prérequis côté utilisateur (à faire avant dev)

1. **Créer une app Strava développeur** sur https://developers.strava.com/
   - Category : "Performance Analysis"
   - Authorization Callback Domain : `aeroprofile.cc`
   - Website : `https://aeroprofile.cc`
   - Récupérer `Client ID` + `Client Secret`

2. **Whitelister le redirect URI** dans l'app Strava :
   - `https://aeroprofile.cc/api/strava/callback`

3. **Ajouter les env vars sur le VPS Hostinger** :
   - `STRAVA_CLIENT_ID=<id>`
   - `STRAVA_CLIENT_SECRET=<secret>`
   - Fichier à modifier : `.env` du docker-compose ou secrets Hostinger (selon ton setup actuel)

Sans ces 3 étapes, l'OAuth casse silencieusement — rien ne sert de commencer le code avant.

## Scope retenu (pas de webhook auto-sync)

- **OAuth + fetch manuel**. L'user se connecte à Strava, clique "Importer mes rides", l'app liste ses 30 dernières activités, il analyse en batch. Même UX qu'Intervals.icu actuel.
- **Tokens en localStorage** (pas de DB backend user).
- **Token refresh côté frontend** : middleware qui check `expires_at < now + 60s` avant chaque call.
- **Pas de webhook** — skipé. Retravaillable si traction justifie.

## Architecture

```
Frontend (localStorage tokens)
  └─ StravaPage.tsx ──authorize──▶ /strava/authorize ──302──▶ Strava oauth
                    ◀──callback─── /strava/callback  ◀─code──
                    ──list/analyze─▶ /strava/list, /analyze-ride, /analyze-batch

Backend (stateless, nouveaux endpoints)
  └─ aeroprofile/api/strava_routes.py  (~300 lignes, mirror de intervals_routes)
  └─ aeroprofile/integrations/strava/client.py  (~200 lignes, httpx wrapper)
```

## Point dur : Strava ne donne pas le FIT original

L'API publique `/activities/{id}` ne retourne pas le `.fit` source. Deux options :
- (a) Reconstruire un FIT/TCX en mémoire depuis les streams JSON
- (b) **Retenu** : exposer `analyze_dataframe(df)` qui bypass la lecture fichier

### Refacto préalable dans `aeroprofile/pipeline.py`

Extraire le début de `analyze(filepath)` qui lit+parse → fonction privée `_fit_to_dataframe(filepath)`. Le reste devient `analyze_dataframe(df, mass_kg, ...)` → appelée par :
- `/analyze` (file upload) : `df = _fit_to_dataframe(path); return analyze_dataframe(df)`
- `/strava/analyze-ride` : `df = streams_to_dataframe(streams); return analyze_dataframe(df)`

~30 lignes de refacto.

## Endpoints backend

- `GET /strava/authorize` — build URL OAuth2 (`client_id`, `redirect_uri`, `scope=read,activity:read`), redirect.
- `GET /strava/callback?code=X` — exchange code → `{access_token, refresh_token, expires_at, athlete}`, renvoyé au frontend via postMessage popup.
- `POST /strava/refresh` — prend refresh_token → new access_token.
- `POST /strava/list` — body `{access_token, date_range}` → GET `/athlete/activities` paginé → filter `type=Ride + trainer=false + has_power=true`.
- `POST /strava/analyze-ride` — body `{access_token, activity_id, mass_kg, ...}` → GET streams `?keys=time,latlng,altitude,watts,velocity_smooth,cadence,heartrate` → `streams_to_dataframe` → `analyze_dataframe`.
- `POST /strava/analyze-batch` — idem en parallèle + `solve_hierarchical`.

## Frontend

- `frontend/src/pages/StravaPage.tsx` (~400 lignes, fork d'`IntervalsPage.tsx`)
- `frontend/src/api/strava.ts` (~150 lignes)
- `frontend/src/App.tsx` — ajouter onglet `Strava` dans `NavTabs` à côté d'`Intervals`

## Rate limits

Strava : 100 req / 15 min + 1000 / jour.
- Lister 30 activités = 1 req
- Analyser 30 rides = 30 × 2 streams = 60 req

Safe, mais ajouter un **soft cap à 20 rides par batch** avec message explicite si 429. Queue frontend avec delay 200ms entre rides pour éviter de saturer.

## Tests

Nouveau fichier `tests/test_strava_routes.py` :
- Mock `httpx.AsyncClient` avec fixtures Strava (JSON dans `tests/fixtures/strava/`)
- Test flow OAuth (authorize, callback, refresh)
- Test `analyze-ride` : résultat streams cohérent avec `analyze(fit_fixture)` (tolérance CdA < 0.005 m²)

## Fichiers à créer / modifier

**Nouveaux** :
- `aeroprofile/api/strava_routes.py`
- `aeroprofile/integrations/strava/__init__.py`
- `aeroprofile/integrations/strava/client.py`
- `frontend/src/pages/StravaPage.tsx`
- `frontend/src/api/strava.ts`
- `tests/test_strava_routes.py`
- `tests/fixtures/strava/activities_list.json`
- `tests/fixtures/strava/streams_sample.json`

**Modifiés** :
- `aeroprofile/pipeline.py` (refacto `analyze_dataframe`)
- `aeroprofile/api/app.py` (inclure le nouveau router)
- `frontend/src/App.tsx` (NavTabs + mode "strava")
- `README.md` (docs setup Strava)

## Risques

1. **Streams ≠ FIT natif** : interpolation 1Hz au lieu du multi-Hz natif. Le solveur peut diverger légèrement. Test de régression FIT vs streams obligatoire, tolérance CdA < 0.005 m².
2. **Rate limit** pendant launch (50 users simultanés = 100 req/15min saute). Queue + message 429.
3. **Token refresh** qui rate → user se reconnecte. OK pour MVP.
4. **Activités privées** : Strava les bloque sans le scope `activity:read_all`. On reste sur `activity:read` (activités publiques de l'user) pour simplifier le review Strava.

## Ordre des commits quand on s'y remet

```
1. refactor(pipeline): extract analyze_dataframe() from analyze()
2. feat(api): add Strava OAuth endpoints + streams-based analyze
3. feat(frontend): Strava page with OAuth login and batch analyze
4. docs(readme): Strava integration setup + rate limit notes
```

Chaque commit testable indépendamment. Budget ~5 jours calendaires.

## Hors scope (même si on s'y remet)

- **Webhook Strava auto-sync** — sprint séparé, nécessite DB backend.
- **Garmin Connect** — API privée plus lourde, après Strava.
- **`activity:read_all`** — besoin d'un review Strava (~2 semaines). `activity:read` pour l'instant.
