"""FastAPI application entry."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from aeroprofile.api.routes import router

app = FastAPI(
    title="AeroProfile API",
    description="Compute cyclist CdA and Crr from power-meter activity files.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Serve built frontend if available (single-service deployment).
# Expected layout: frontend/dist/ at the repo root, sitting next to the package.
_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    assets = _FRONTEND_DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    async def _index():
        return FileResponse(_FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def _spa_fallback(full_path: str):
        # SPA fallback: anything not matched by /api or /assets → index.html
        target = _FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(_FRONTEND_DIST / "index.html")
