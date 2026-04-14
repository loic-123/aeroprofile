"""FastAPI application entry."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Make aeroprofile.* loggers visible through uvicorn's stdout handler.
# uvicorn configures its own handlers on the "uvicorn" logger tree but leaves
# the root at WARNING — so logger.info() calls from aeroprofile modules get
# swallowed unless we explicitly enable them.
_ap_logger = logging.getLogger("aeroprofile")
_ap_logger.setLevel(logging.INFO)
if not _ap_logger.handlers:
    import datetime as _dt
    _fmt = logging.Formatter("%(asctime)s [%(name)s] %(message)s", "%H:%M:%S")
    # stdout — so uvicorn's terminal shows everything
    _console = logging.StreamHandler()
    _console.setFormatter(_fmt)
    _ap_logger.addHandler(_console)
    # Per-session log file: one file per uvicorn startup, named by timestamp.
    # Makes it trivial to grab "the log of the test I just ran" without
    # mixing multiple runs in the same file.
    _log_dir = Path(__file__).resolve().parents[2] / "logs"
    _log_dir.mkdir(parents=True, exist_ok=True)

    # Housekeeping: delete previous session logs that are "empty" (only the
    # init line, no actual analysis was done). This cleans up the noise from
    # uvicorn --reload, which relaunches the process — and thus creates a
    # new session file — every time a .py file is saved during development.
    # A real session log with at least one analysis is >> 300 bytes.
    EMPTY_SESSION_THRESHOLD_BYTES = 300
    try:
        for _old in _log_dir.glob("session_*.log"):
            try:
                if _old.stat().st_size < EMPTY_SESSION_THRESHOLD_BYTES:
                    _old.unlink()
            except OSError:
                # File might still be held by another process (the previous
                # uvicorn worker being killed). Skip silently.
                pass
    except Exception:
        pass

    _session_stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    _session_file = _log_dir / f"session_{_session_stamp}.log"
    _file_fmt = logging.Formatter(
        "%(asctime)s [%(name)s] [%(levelname)s] %(message)s",
        "%Y-%m-%d %H:%M:%S",
    )
    _file = logging.FileHandler(_session_file, encoding="utf-8")
    _file.setFormatter(_file_fmt)
    _ap_logger.addHandler(_file)
    _ap_logger.propagate = False
    _ap_logger.info("Logging initialised (console + %s)", _session_file)

from aeroprofile.api.routes import router
from aeroprofile.api.intervals_routes import router as intervals_router

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
app.include_router(intervals_router, prefix="/api/intervals")

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
