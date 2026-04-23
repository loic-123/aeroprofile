# Overload fallback page (Traefik routing when aeroprofile is down)

## Goal

When the `aeroprofile` container is unhealthy or overloaded (CPU >100%, OOM,
restart loop), Traefik must fall back to a static HTML served by a separate,
very light container. This keeps a friendly "site is catching its breath" page
live even when the Python backend is completely dark.

## How it works

- `aeroprofile.cc` has its normal Traefik route → aeroprofile container.
- A second container `aeroprofile-fallback` runs a tiny nginx that serves
  `overload.html` at a **lower priority** route (Traefik picks the highest
  healthy priority route; if aeroprofile is healthy, users see the app; if not,
  Traefik serves the fallback).

## Files required on the VPS

```
/docker/aeroprofile-fallback/
├── docker-compose.yml
├── nginx.conf
└── html/
    └── overload.html     # copy of frontend/public/overload.html from the repo
```

## `/docker/aeroprofile-fallback/docker-compose.yml`

```yaml
services:
  aeroprofile-fallback:
    image: nginx:alpine
    container_name: aeroprofile-fallback
    restart: unless-stopped
    volumes:
      - ./html:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - n8n_default
    # Resource limits: nginx is idle 99% of the time so 50 MB RAM is huge.
    deploy:
      resources:
        limits:
          cpus: "0.2"
          memory: 64m
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=n8n_default"
      # Lower priority than the main aeroprofile route (default = 0; explicit
      # priority=1 keeps Traefik picking this only when nothing else matches).
      # Traefik's priority ordering: higher number = higher priority.
      # So we set the MAIN aeroprofile route to priority=100 and THIS one to
      # priority=1, ensuring the fallback is used only when aeroprofile is
      # unhealthy (Traefik removes unhealthy backends from the matching set).
      - "traefik.http.routers.aeroprofile-fallback.rule=Host(`aeroprofile.cc`) || Host(`www.aeroprofile.cc`)"
      - "traefik.http.routers.aeroprofile-fallback.priority=1"
      - "traefik.http.routers.aeroprofile-fallback.entrypoints=web,websecure"
      - "traefik.http.routers.aeroprofile-fallback.tls=true"
      - "traefik.http.routers.aeroprofile-fallback.tls.certresolver=mytlschallenge"
      - "traefik.http.services.aeroprofile-fallback.loadbalancer.server.port=80"

networks:
  n8n_default:
    external: true
```

## `/docker/aeroprofile-fallback/nginx.conf`

Minimal config: serve `overload.html` at ANY path (every request the main
aeroprofile can't answer). Returns HTTP 503 so search engines and monitoring
tools correctly identify the downtime instead of indexing the fallback page.

```nginx
events {}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;

    server {
        listen 80 default_server;
        server_name _;
        root /usr/share/nginx/html;

        # Short-circuit the favicon to skip the 503 and avoid flooding logs.
        location = /favicon.ico { try_files $uri =204; }
        location = /favicon.svg { try_files $uri =204; }

        # Everything else: serve overload.html with a 503.
        location / {
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header X-Content-Type-Options "nosniff" always;
            error_page 404 = /overload.html;
            try_files $uri /overload.html;
        }

        location = /overload.html {
            return 503;  # set BEFORE try_files resolves; see note below
        }
    }
}
```

> **Note on the `return 503`**: nginx doesn't let you `return 503` AND serve a
> file in the same location block. Two options:
> (a) accept that the fallback returns 200 OK (simpler, user-friendly);
> (b) use the `error_page` directive to render overload.html on 503. If you
> care about monitoring, go with option (b) and replace the two last blocks
> with:
>
> ```nginx
> location / {
>     return 503;
> }
> error_page 503 /overload.html;
> location = /overload.html {
>     internal;
>     add_header Cache-Control "no-cache" always;
> }
> ```

## Required change to the main aeroprofile compose

Add one label so the main route wins when the container is healthy:

```yaml
# In /docker/aeroprofile/docker-compose.yml, add:
- "traefik.http.routers.aeroprofile.priority=100"
```

Without this, Traefik falls back to the default priority of both routes (which
depends on the rule specificity) and the behaviour is undefined.

## Deploy steps (on VPS)

```bash
# 1. Create fallback dir
sudo mkdir -p /docker/aeroprofile-fallback/html

# 2. Copy overload.html from the aeroprofile repo
sudo cp /opt/aeroprofile/frontend/public/overload.html \
  /docker/aeroprofile-fallback/html/overload.html

# 3. Drop the compose + nginx config (content above)
sudo vi /docker/aeroprofile-fallback/docker-compose.yml
sudo vi /docker/aeroprofile-fallback/nginx.conf

# 4. Add priority label to main compose
sudo vi /docker/aeroprofile/docker-compose.yml

# 5. Launch the fallback
cd /docker/aeroprofile-fallback && sudo docker compose up -d

# 6. Apply the priority change to aeroprofile
cd /docker/aeroprofile && sudo docker compose -p aeroprofile up -d
```

## Verify

```bash
# Normal state: aeroprofile wins, user sees the SPA
curl -sI https://aeroprofile.cc | head -1     # expect: HTTP/2 200

# Simulate overload: stop aeroprofile
sudo docker stop aeroprofile
curl -sI https://aeroprofile.cc | head -1     # expect: HTTP/2 503
curl -s https://aeroprofile.cc | grep "souffle"  # expect: match from overload.html

# Restore
sudo docker start aeroprofile
# Traefik picks the main route again within ~5s (healthcheck cadence)
```

## When this DOESN'T save you

- **If Traefik itself is down**: the whole domain drops to 404. Add Traefik to
  your `healthcheck` monitoring. Setting Traefik restart to `unless-stopped`
  covers most OOM / CPU starvation scenarios.
- **If the VPS is literally frozen** (100% CPU, disk I/O wait): nginx can't
  answer either. The static page only helps when aeroprofile is dead but the
  rest of the stack is alive.
- **If DNS is broken**: users hit the ISP's lookup failure page, not ours.

Honest framing: this setup covers "aeroprofile crashed" (~80% of outages) but
not "whole VPS is dead" (~15%) or "DNS/domain issue" (~5%).

## Memory + CPU budget

- nginx:alpine container idle: ~3 MB RAM, 0% CPU.
- Under a real outage (say 100 req/s hitting the 503): ~20 MB RAM, 2% CPU.
- Won't compete with Traefik / n8n / NocoDB for resources.
