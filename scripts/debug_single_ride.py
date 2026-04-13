"""Debug a single ride to understand why the solver diverges.

Runs the full pipeline twice (with and without prior) and prints all
diagnostics: solver chosen, R², nRMSE, Hessian-based sigma on CdA,
heading variance, speed variance, whether the solver hit a bound, etc.
"""
import asyncio
import sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

from aeroprofile.pipeline import analyze

RIDE = "tests/fixtures/laurette/2025-10-05_Vélo.fit"
MASS = 70.0
BIKE = "road"


def fmt(v, n=4):
    if v is None:
        return "None"
    if isinstance(v, float) and np.isnan(v):
        return "NaN"
    return f"{v:.{n}f}"


async def run_one(label, disable_prior, prior=None, crr_fixed=None):
    print(f"\n{'=' * 70}")
    print(f" {label}")
    print(f"{'=' * 70}")
    try:
        r = await analyze(
            RIDE,
            mass_kg=MASS,
            bike_type=BIKE,
            disable_prior=disable_prior,
            cda_prior_override=prior,
            crr_fixed=crr_fixed,
            fetch_wx=True,
        )
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

    df = r.df
    valid = df[df["filter_valid"]] if "filter_valid" in df.columns else df

    nrmse = (r.rmse_w or 0) / max(r.avg_power_w, 1)
    cda_sigma = (r.cda_ci[1] - r.cda_ci[0]) / 3.92 if r.cda_ci[0] is not None and not np.isnan(r.cda_ci[0]) else float("nan")

    # Solver bound check
    hit_upper = r.cda > 0.78  # close to bound 0.80 (or 0.55 with prior)
    hit_lower = r.cda < 0.12

    # Speed/heading/grade diagnostics
    if "v_ground" in valid.columns:
        v = valid["v_ground"].to_numpy()
        v_std = float(np.std(v))
        v_mean = float(np.mean(v))
        v_cv = v_std / max(v_mean, 0.1)
    else:
        v_std = v_mean = v_cv = float("nan")

    if "bearing" in valid.columns:
        br = np.radians(valid["bearing"].to_numpy())
        R = np.sqrt(np.cos(br).mean() ** 2 + np.sin(br).mean() ** 2)
        heading_var = 1.0 - R
    else:
        heading_var = float("nan")

    if "altitude_smooth" in valid.columns:
        alt = valid["altitude_smooth"].to_numpy()
        elev_range = float(alt.max() - alt.min())
    else:
        elev_range = float("nan")

    print(f"  CdA           = {fmt(r.cda)}  (CI95 [{fmt(r.cda_ci[0])}, {fmt(r.cda_ci[1])}])")
    print(f"  σ_CdA (Hess)  = {fmt(cda_sigma)}")
    print(f"  Crr           = {fmt(r.crr, 5)}")
    print(f"  Solveur       = {r.solver_method}")
    print(f"  Note solveur  = {r.solver_note}")
    print(f"  R²            = {fmt(r.r_squared)}")
    print(f"  nRMSE         = {nrmse * 100:.1f}%   (RMSE = {fmt(r.rmse_w, 1)} W)")
    print(f"  Heading var   = {fmt(heading_var)}   (>0.25 = ride variée)")
    print(f"  V moyenne     = {fmt(v_mean, 2)} m/s ({v_mean*3.6:.1f} km/h)")
    print(f"  V std         = {fmt(v_std, 2)} m/s")
    print(f"  V CV (σ/μ)    = {fmt(v_cv, 3)}   (>0.30 = bonne variabilité)")
    print(f"  Range altitude= {fmt(elev_range, 1)} m")
    print(f"  Points valides= {r.valid_points} / {r.total_points}")
    print(f"  Vent API      = {fmt(r.avg_wind_speed_ms, 2)} m/s @ {fmt(r.avg_wind_dir_deg, 0)}°")

    # Borne tape ?
    if hit_upper:
        print(f"  ⚠ SOLVEUR TAPE LA BORNE SUPÉRIEURE (CdA proche du max)")
    if hit_lower:
        print(f"  ⚠ SOLVEUR TAPE LA BORNE INFÉRIEURE")
    if not np.isnan(cda_sigma) and cda_sigma > 0.05:
        print(f"  ⚠ σ_CdA TRÈS GRAND ({cda_sigma:.4f}) → modèle peu identifiable sur ces données")

    return r


async def main():
    print(f"Debug de : {RIDE}")
    print(f"Masse: {MASS} kg, Vélo: {BIKE}")

    # Test 1 : avec prior aéro drops
    r1 = await run_one(
        "[1] AVEC prior 'Aéro drops' (0.30, 0.08)",
        disable_prior=False,
        prior=(0.30, 0.08),
    )

    # Test 2 : avec prior tops
    r2 = await run_one(
        "[2] AVEC prior 'Tops' (0.40, 0.10)",
        disable_prior=False,
        prior=(0.40, 0.10),
    )

    # Test 3 : sans prior (multi-rides mode actuel)
    r3 = await run_one(
        "[3] SANS prior (disable_prior=True, bornes [0.20, 0.55] après mon fix)",
        disable_prior=True,
        prior=None,
    )

    # Test 4 : Crr fixé à 0.0035 (tubeless route typique)
    r4 = await run_one(
        "[4] Crr FIXÉ à 0.0035 (tubeless route) + sans prior",
        disable_prior=True,
        prior=None,
        crr_fixed=0.0035,
    )

    # Test 5 : Crr fixé à 0.0035 + prior drops (combo le plus contraint)
    r5 = await run_one(
        "[5] Crr FIXÉ à 0.0035 + prior drops (le plus contraint)",
        disable_prior=False,
        prior=(0.30, 0.08),
        crr_fixed=0.0035,
    )

    # Comparaison
    print(f"\n{'=' * 70}")
    print(" COMPARAISON")
    print(f"{'=' * 70}")
    rs = [(r1, "Prior drops             "),
          (r2, "Prior tops              "),
          (r3, "Sans prior              "),
          (r4, "Crr fixé sans prior     "),
          (r5, "Crr fixé + prior drops  ")]
    for r, lab in rs:
        if r is None:
            continue
        nrmse = (r.rmse_w or 0) / max(r.avg_power_w, 1)
        print(f"  {lab}: CdA = {r.cda:.4f}  Crr = {r.crr:.5f}  nRMSE = {nrmse*100:.1f}%  R²={r.r_squared:.3f}")


asyncio.run(main())
