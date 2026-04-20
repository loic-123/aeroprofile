#!/usr/bin/env bash
# AeroProfile deploy pipeline — invoked via SSH forced-command from GitHub Actions.
# Executed by root. Must not accept arguments, must not trust $SSH_ORIGINAL_COMMAND.
# Any failure mid-pipeline triggers a rollback to aeroprofile:previous.
#
# NOTE: this file is a versioned reference copy for audit purposes. The
# ACTUAL script that runs is /usr/local/bin/deploy-aeroprofile.sh on the VPS.
# Any change here must be manually applied to the VPS copy (no auto-sync).

set -euo pipefail

REPO_DIR="/opt/aeroprofile"
COMPOSE_DIR="/docker/aeroprofile"
IMAGE="aeroprofile:latest"
BACKUP="aeroprofile:previous"
HEALTH_URL="http://127.0.0.1:8001/api/health"
LOG_TAG="[deploy-aeroprofile]"

log() { echo "$LOG_TAG $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
fail() { log "FAIL: $*"; exit 1; }

# Guard: refuse to run if anything's off.
[[ "$(id -u)" -eq 0 ]]       || fail "must run as root"
[[ -d "$REPO_DIR/.git" ]]    || fail "$REPO_DIR is not a git repo"
[[ -f "$COMPOSE_DIR/docker-compose.yml" ]] || fail "missing compose file at $COMPOSE_DIR"

cd "$REPO_DIR" || fail "cannot cd into $REPO_DIR"
[[ "$PWD" == "$REPO_DIR" ]]  || fail "cwd guard failed: $PWD != $REPO_DIR"

log "pulling origin/main"
git fetch --prune origin
git reset --hard origin/main
BEFORE_SHA=$(git rev-parse --short HEAD)
log "at $BEFORE_SHA"

# Tag current image as :previous for rollback. If :latest doesn't exist yet
# (first run), skip silently.
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "tagging $IMAGE → $BACKUP"
  docker tag "$IMAGE" "$BACKUP"
else
  log "no existing $IMAGE, skipping backup tag"
fi

cd "$COMPOSE_DIR"
log "docker compose up --build -d"
docker compose -p aeroprofile up --build -d

log "waiting 15s for warm-up"
sleep 15

# Healthcheck: 3 attempts, 2s apart. Pass on first 200.
HEALTHY=0
for attempt in 1 2 3; do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    log "health attempt $attempt: OK"
    HEALTHY=1
    break
  fi
  log "health attempt $attempt: FAIL"
  [[ "$attempt" -lt 3 ]] && sleep 2
done

if [[ "$HEALTHY" -ne 1 ]]; then
  log "ROLLBACK: 3/3 health checks failed"
  if docker image inspect "$BACKUP" >/dev/null 2>&1; then
    docker compose -p aeroprofile down
    docker tag "$BACKUP" "$IMAGE"
    docker compose -p aeroprofile up -d
    log "rolled back to $BACKUP"
  else
    log "no $BACKUP tag to roll back to — container left in failing state"
  fi
  fail "healthcheck failed, deploy reverted"
fi

log "deploy OK at $BEFORE_SHA"
