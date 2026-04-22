# syntax=docker/dockerfile:1.6

# ─── Stage 1: frontend build ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# produces /frontend/dist

# ─── Stage 2: python runtime ───────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer 1 (rarely invalidated): third-party deps.
# requirements.txt is kept in sync with pyproject.toml dependencies — pinning
# the install here means README/source edits don't blow away the pip cache.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Layer 2: built frontend (invalidates only when the frontend stage output changes).
COPY --from=frontend-build /frontend/dist ./frontend/dist

# Layer 3 (invalidates on every code or doc change): project metadata + source,
# then install the project itself without re-resolving deps.
COPY pyproject.toml README.md ./
COPY aeroprofile/ ./aeroprofile/
RUN pip install --no-deps .

RUN mkdir -p /app/logs

EXPOSE 8001

# Healthcheck is intentionally tolerant: one CPU-heavy analysis can block
# the uvicorn event loop for 20-30 s, and we don't want Docker to mark the
# container unhealthy (→ Traefik drops it → user gets cascading 404s) just
# because a single request took a while to answer. 15 s timeout + 5 retries
# gives the event loop time to come back between heavy rides.
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8001/api/health || exit 1

CMD ["python", "-m", "uvicorn", "aeroprofile.api.app:app", \
     "--host", "0.0.0.0", "--port", "8001"]
