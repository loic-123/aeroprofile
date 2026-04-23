# Prompt à coller dans Claude Code côté VPS

Objectif : brancher une page d'erreur statique « VPS saturé » qui s'affiche
automatiquement quand le container `aeroprofile` est down/unhealthy, via
Traefik (qui est déjà en place et route déjà `aeroprofile.cc`).

Le plan complet est dans le repo aeroprofile :
`/opt/aeroprofile/deploy/overload-fallback.md`

Lis ce fichier d'abord pour comprendre l'architecture, puis applique-le.

## Étapes à exécuter

### 1. Préparer les fichiers

```bash
sudo mkdir -p /docker/aeroprofile-fallback/html

# Copier la page HTML depuis le repo (déjà committée par le user)
sudo cp /opt/aeroprofile/frontend/public/overload.html \
  /docker/aeroprofile-fallback/html/overload.html

# Vérifier
ls -la /docker/aeroprofile-fallback/html/
```

Si `/opt/aeroprofile/frontend/public/overload.html` n'existe pas, c'est que
le user n'a pas encore pushé. Dis-le-lui et attends.

### 2. Créer `/docker/aeroprofile-fallback/nginx.conf`

Contenu exact (variante qui renvoie bien un 503 via error_page) :

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

        location = /favicon.ico { try_files $uri =204; }
        location = /favicon.svg { try_files $uri =204; }

        location / {
            return 503;
        }
        error_page 503 /overload.html;
        location = /overload.html {
            internal;
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header X-Content-Type-Options "nosniff" always;
        }
    }
}
```

### 3. Créer `/docker/aeroprofile-fallback/docker-compose.yml`

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
    deploy:
      resources:
        limits:
          cpus: "0.2"
          memory: 64m
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=n8n_default"
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

### 4. Ajouter la priorité au route aeroprofile principal

Édite `/docker/aeroprofile/docker-compose.yml` et ajoute CE LABEL dans la
section `labels:` d'aeroprofile (à côté des autres `traefik.http.routers.aeroprofile.*`) :

```yaml
- "traefik.http.routers.aeroprofile.priority=100"
```

Sans ça, Traefik choisit un ordre indéterminé entre les deux routes. Avec ça,
le main route gagne toujours SAUF si son backend est unhealthy → fallback.

### 5. Démarrer

```bash
cd /docker/aeroprofile-fallback && sudo docker compose up -d
cd /docker/aeroprofile && sudo docker compose -p aeroprofile up -d
```

### 6. Vérifier le fonctionnement

**Normal state** (aeroprofile healthy) :
```bash
curl -sI https://aeroprofile.cc | head -1
# Expected: HTTP/2 200

curl -s https://aeroprofile.cc | grep -o '<title>[^<]*'
# Expected: <title>AeroProfile — Estimate your cycling CdA from any ride
```

**Simulate overload** (arrêt d'aeroprofile) :
```bash
sudo docker stop aeroprofile

# Attendre ~10s que Traefik constate l'unhealthy
sleep 10

curl -sI https://aeroprofile.cc | head -1
# Expected: HTTP/2 503

curl -s https://aeroprofile.cc | grep "souffle"
# Expected: une ligne contenant "souffle un peu"

# Redémarrer
sudo docker start aeroprofile
sleep 20
curl -sI https://aeroprofile.cc | head -1
# Expected: HTTP/2 200 (retour au normal)
```

**Vérifier que le fallback reçoit du trafic** :
```bash
sudo docker logs aeroprofile-fallback --tail 20
# Doit montrer les GET / 503 émis pendant le test
```

### 7. Si le test fallback donne 404 au lieu de 503

Deux causes classiques :
- **Traefik cache l'ancien routing** : `sudo docker restart traefik` puis retest
- **Le reseau n'est pas `n8n_default`** : vérifie avec `sudo docker network ls`
  et utilise le même nom que dans `/docker/aeroprofile/docker-compose.yml`

### 8. Si tout fonctionne

Rapport à ramener dans la chat :
- Container `aeroprofile-fallback` status (healthy ? mem usage ?)
- Comportement normal : HTTP 200 + titre SPA confirmé
- Comportement overload : HTTP 503 + message "souffle" confirmé
- Retour au normal après `docker start aeroprofile` : ✓
- Tout logs suspects ou config à ajuster

### Notes sûreté

- Ne touche PAS aux autres containers (n8n-traefik-1, nocodb, etc.)
- Ne modifie PAS le config Traefik global — on utilise uniquement des labels
  sur les deux composes
- Si quelque chose casse, rollback = `docker compose down` sur aeroprofile-fallback
  et retirer le label `priority=100` d'aeroprofile. Le setup actuel re-marche.
