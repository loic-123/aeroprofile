# Deployment

AeroProfile is deployed as a single Docker container behind an existing
Traefik reverse proxy on a VPS. The container serves both the FastAPI
backend and the static Vite-built React frontend.

## Production target

- **VPS**: Ubuntu 24.04, Hostinger KVM 2, IP `72.61.167.243`
- **Reverse proxy**: existing Traefik v3 (shared with other services on
  the box), Let's Encrypt via TLS-ALPN-01 challenge
- **Current domain**: `aero.srv1216048.hstgr.cloud` (temporary, Hostinger
  auto-hostname). Will migrate to `aeroprofile.cc` once DNS is propagated.
- **Port**: `127.0.0.1:8001` on the host, routed externally by Traefik
- **Image size**: ~650 MB
- **Runtime RAM**: ~120 MiB idle, ~400 MiB during Method B batches

## CI/CD

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) →
SSH into the VPS using a forced-command deploy key →
`/usr/local/bin/deploy-aeroprofile.sh` runs:

1. `git fetch && git reset --hard origin/main`
2. `docker tag aeroprofile:latest aeroprofile:previous`
3. `docker compose -p aeroprofile up --build -d`
4. Warm-up sleep 15 s, then `curl /api/health` with retries
5. Rollback to `:previous` if the healthcheck fails, else exit 0

Total pipeline time: ~25 s when the pip install layer is cached, ~60 s
on a cold build.

## The deploy script

The canonical, executed version of the deploy script lives on the VPS at
`/usr/local/bin/deploy-aeroprofile.sh`. **This directory contains a
reference copy** at `deploy/deploy-aeroprofile.sh` for auditability — it
is NOT the version that runs. Any change to the deploy pipeline requires
both updating the file on the VPS AND updating the reference copy here.

The reference copy is introduced in a follow-up commit once the VPS
script is stabilised.

## SSH restriction

The GitHub Actions deploy key in `/root/.ssh/authorized_keys` is pinned to
a single forced command:

```
command="/usr/local/bin/deploy-aeroprofile.sh",restrict ssh-ed25519 ...
```

Any command sent over that SSH connection is ignored — only the deploy
script runs. The key is thus worthless for anything other than triggering
a deploy, even if it leaks from GitHub Secrets.

## Local development

`docker compose -f docker-compose.dev.yml up` for a local one-container
setup with hot reload. Backend reloads via uvicorn `--reload`, frontend
via Vite HMR.

## Rollback

Manual rollback if the automated one fails or if you want to pin an
older version:

```bash
ssh root@72.61.167.243
cd /docker/aeroprofile
docker tag aeroprofile:previous aeroprofile:latest
docker compose -p aeroprofile up -d  # no --build, reuses the tagged image
curl http://127.0.0.1:8001/api/health
```

## Domain migration

To swap `aero.srv1216048.hstgr.cloud` → `aeroprofile.cc`:

1. Add a DNS A record: `aeroprofile.cc` → `72.61.167.243` (wait for
   propagation, typically 5–30 min, check with `dig aeroprofile.cc`)
2. Edit `/docker/aeroprofile/docker-compose.yml` on the VPS and change
   one line:
   ```
   - "traefik.http.routers.aeroprofile.rule=Host(`aeroprofile.cc`)"
   ```
3. `docker compose -p aeroprofile up -d` — Traefik re-issues the
   Let's Encrypt cert via TLS-ALPN-01 automatically (takes ~30 s)
4. Verify: `curl https://aeroprofile.cc/api/health`
5. Update `frontend/index.html` Open Graph URLs + README demo link + push
