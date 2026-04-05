"""Command-line interface."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import click

from aeroprofile.pipeline import analyze


@click.group()
@click.version_option()
def main():
    """AeroProfile — Compute CdA and Crr from a power-meter activity file."""


@main.command()
@click.argument("filepath", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--mass", "mass_kg", type=float, required=True, help="Total rider + bike mass (kg).")
@click.option("--crr", "crr_fixed", type=float, default=None, help="Fix Crr (e.g., 0.004).")
@click.option("--eta", type=float, default=0.976, help="Drivetrain efficiency (default 0.976).")
@click.option(
    "--wind-factor",
    "wind_height_factor",
    type=float,
    default=0.7,
    help="Wind 10m→rider height correction (default 0.7).",
)
@click.option("--no-wind", is_flag=True, help="Disable Open-Meteo fetch (calm assumption).")
@click.option(
    "--format",
    "output_format",
    type=click.Choice(["text", "json"]),
    default="text",
    help="Output format.",
)
@click.option("--verbose", "-v", is_flag=True, help="Verbose debug output.")
def analyze_cmd(filepath, mass_kg, crr_fixed, eta, wind_height_factor, no_wind, output_format, verbose):
    """Analyze a .FIT / .GPX / .TCX file."""
    try:
        result = asyncio.run(
            analyze(
                filepath,
                mass_kg=mass_kg,
                crr_fixed=crr_fixed,
                eta=eta,
                wind_height_factor=wind_height_factor,
                fetch_wx=not no_wind,
            )
        )
    except Exception as e:
        click.echo(f"Erreur : {e}", err=True)
        sys.exit(1)

    if output_format == "json":
        payload = {
            "cda": result.cda,
            "cda_ci": list(result.cda_ci),
            "crr": result.crr,
            "crr_ci": list(result.crr_ci),
            "r_squared": result.r_squared,
            "ride_date": result.ride_date,
            "ride_distance_km": result.ride_distance_km,
            "ride_duration_s": result.ride_duration_s,
            "ride_elevation_gain_m": result.ride_elevation_gain_m,
            "avg_speed_kmh": result.avg_speed_kmh,
            "avg_power_w": result.avg_power_w,
            "avg_rho": result.avg_rho,
            "avg_wind_speed_ms": result.avg_wind_speed_ms,
            "avg_wind_dir_deg": result.avg_wind_dir_deg,
            "source_format": result.source_format,
            "total_points": result.total_points,
            "valid_points": result.valid_points,
            "filter_summary": result.filter_summary,
            "anomalies": [a.to_dict() for a in result.anomalies],
            "crr_was_fixed": result.crr_was_fixed,
        }
        click.echo(json.dumps(payload, indent=2, ensure_ascii=False))
        return

    # Text
    src = result.source_format.upper()
    h = int(result.ride_duration_s // 3600)
    m = int((result.ride_duration_s % 3600) // 60)
    click.echo("🚴 AeroProfile — Analyse aérodynamique")
    click.echo("━" * 42)
    click.echo(f"Fichier  : {filepath.name}")
    click.echo(f"Format   : {src}")
    click.echo(f"Date     : {result.ride_date}")
    click.echo(
        f"Distance : {result.ride_distance_km:.1f} km | "
        f"D+ : {result.ride_elevation_gain_m:.0f} m | Durée : {h}h{m:02d}"
    )
    click.echo("")
    click.echo(
        f"📡 Vent moyen : {result.avg_wind_speed_ms*3.6:.1f} km/h @ {result.avg_wind_dir_deg:.0f}° | "
        f"ρ moyen : {result.avg_rho:.3f} kg/m³"
    )
    click.echo("")
    pct = 100.0 * result.valid_points / max(result.total_points, 1)
    click.echo(
        f"🔬 Analyse sur {result.valid_points:,} points ({pct:.1f}% du total après filtrage)"
    )
    if verbose:
        click.echo("   Points exclus :")
        for k, v in result.filter_summary.items():
            click.echo(f"     - {k:<25s} : {v:>6,}")
    click.echo("")
    click.echo("📊 Résultats")
    click.echo(
        f"   CdA = {result.cda:.3f} m²  [IC 95% : {result.cda_ci[0]:.3f} — {result.cda_ci[1]:.3f}]"
    )
    if result.crr_was_fixed:
        click.echo(f"   Crr = {result.crr:.4f}     [FIXÉ]")
    else:
        click.echo(
            f"   Crr = {result.crr:.4f}     [IC 95% : {result.crr_ci[0]:.4f} — {result.crr_ci[1]:.4f}]"
        )
    click.echo(f"   R²  = {result.r_squared:.3f}")
    click.echo("")
    click.echo("⚠️  Alertes")
    for a in result.anomalies:
        marker = {"error": "❌", "warning": "⚠️ ", "info": "ℹ️ "}.get(a.severity, "•")
        click.echo(f"   {marker} [{a.severity.upper()}] {a.title}")
        click.echo(f"      {a.message}")


# Register the subcommand under the intuitive name `aeroprofile analyze`.
main.add_command(analyze_cmd, name="analyze")


if __name__ == "__main__":
    main()
