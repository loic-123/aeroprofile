"""FastAPI application entry."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
