"""FastAPI application entry."""

from __future__ import annotations

import datetime as _dt
import logging
from pathlib import Path
from threading import Lock

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

# Directory where per-analysis log files live.
_LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_FILE_FMT = logging.Formatter(
    "%(asctime)s [%(name)s] [%(levelname)s] %(message)s",
    "%Y-%m-%d %H:%M:%S",
)

# Handler rotation state. _current_file_handler is the FileHandler currently
# attached to _ap_logger; rotate_session_log() detaches it, creates a new
# file with a fresh timestamp, and attaches a new handler in its place. A
# lock guards concurrent rotations (shouldn't happen in practice, but
# /log-session is fire-and-forget from the frontend and we don't want a
# race to corrupt the handler list).
_current_file_handler: logging.FileHandler | None = None
_current_session_file: Path | None = None
_rotation_lock = Lock()


def _cleanup_empty_logs() -> None:
    """Delete session logs that contain nothing but the init line. Cleans up
    the noise from uvicorn --reload (which creates a fresh session file each
    time a .py is saved) and from rotation calls where the previous session
    ended without any analysis."""
    EMPTY_SESSION_THRESHOLD_BYTES = 300
    try:
        for _old in _LOG_DIR.glob("session_*.log"):
            try:
                if _old.stat().st_size < EMPTY_SESSION_THRESHOLD_BYTES:
                    _old.unlink()
            except OSError:
                pass
    except Exception:
        pass


def rotate_session_log(tag: str = "") -> Path:
    """Start a new session log file. Called at the beginning of each user
    analysis run (from /log-session) so every run lands in its own file and
    no two analyses end up interleaved in a shared log.

    The optional ``tag`` is appended to the filename (sanitised) for easier
    spotting — e.g. 'laurette' or 'moi' or 'fileupload'. If empty, the file
    is simply timestamped.

    Returns the path of the new file.
    """
    global _current_file_handler, _current_session_file
    with _rotation_lock:
        # Detach the previous file handler (if any) so it stops receiving
        # records. We close it after detaching to flush pending writes.
        if _current_file_handler is not None:
            try:
                _ap_logger.removeHandler(_current_file_handler)
                _current_file_handler.close()
            except Exception:
                pass
            _current_file_handler = None

        _cleanup_empty_logs()

        stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_tag = "".join(c for c in tag if c.isalnum() or c in "_-")[:40]
        name = f"session_{stamp}{'_' + safe_tag if safe_tag else ''}.log"
        new_file = _LOG_DIR / name
        handler = logging.FileHandler(new_file, encoding="utf-8")
        handler.setFormatter(_FILE_FMT)
        _ap_logger.addHandler(handler)
        _current_file_handler = handler
        _current_session_file = new_file
        _ap_logger.info(
            "Logging rotated → new session file: %s (tag=%s)",
            new_file, tag or "—",
        )
        return new_file


if not _ap_logger.handlers:
    _fmt = logging.Formatter("%(asctime)s [%(name)s] %(message)s", "%H:%M:%S")
    # stdout — so uvicorn's terminal shows everything
    _console = logging.StreamHandler()
    _console.setFormatter(_fmt)
    _ap_logger.addHandler(_console)
    _ap_logger.propagate = False
    # Initial file handler — will be replaced on the first /log-session call.
    # This bootstrap file captures anything logged before the first user
    # analysis (startup messages, direct /analyze-ride calls without a
    # preceding SESSION_START, etc.).
    _cleanup_empty_logs()
    _session_stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    _session_file = _LOG_DIR / f"session_{_session_stamp}_bootstrap.log"
    _file = logging.FileHandler(_session_file, encoding="utf-8")
    _file.setFormatter(_FILE_FMT)
    _ap_logger.addHandler(_file)
    _current_file_handler = _file
    _current_session_file = _session_file
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
