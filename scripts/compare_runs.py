"""Compare two AeroProfile session log files and print a side-by-side diff.

Reads two `logs/session_*.log` files, extracts the per-ride ANALYZE lines and
the METHOD_B aggregate, and prints a table of CdA / nRMSE / quality_status
deltas. Intended for "did this fix change anything" runs where the same
dataset is re-analysed with different code or different priors.

Usage:
    python scripts/compare_runs.py logs/session_old.log logs/session_new.log
    python scripts/compare_runs.py logs/session_old.log logs/session_new.log --threshold 0.005

The matching is positional: it assumes both runs analysed the same files in
the same order. This is the case for /analyze-batch and /intervals/analyze
runs, which both iterate the activity list deterministically. For mixed runs,
match by the activity ID embedded in the tmp filename (not implemented yet).
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ANALYZE_RE = re.compile(
    r"ANALYZE\s+(\S+)\s+\|\s+(\w+)\s+\|\s+CdA=([\d.]+)\s+\(raw=([\d.\u2014-]+)\)\s+"
    r"\u03c3_H=([\d.]+)\s+pf\u00d7([\d.]+)\s+\|\s+Crr=([\d.]+)\s+\|\s+bounds=.+?"
    r"\|\s+nRMSE=(\d+)%\s+\|\s+(\w+)"
)
METHOD_B_RE = re.compile(
    r"METHOD_B result:\s+mu_cda=([\d.]+)\s+IC95=\[([\d.]+),([\d.]+)\]\s+"
    r"tau=([\d.]+)\s+crr=([\d.]+)\s+IC95=\[([\d.]+),([\d.]+)\]\s+n_rides=(\d+)"
)
HIER_NEFF_RE = re.compile(r"HIERARCHICAL DL n_eff = ([\d.]+) \(nominal n = (\d+)")


@dataclass
class RideRecord:
    fname: str
    solver: str
    cda: float
    cda_raw: float | None
    sigma_h: float
    prior_factor: float
    crr: float
    nrmse_pct: int
    status: str


@dataclass
class MethodBRecord:
    mu_cda: float
    mu_ci_lo: float
    mu_ci_hi: float
    tau: float
    crr: float
    n_rides: int
    n_eff: float | None


def parse_log(path: Path) -> tuple[list[RideRecord], MethodBRecord | None]:
    rides: list[RideRecord] = []
    mb: MethodBRecord | None = None
    pending_neff: float | None = None
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = ANALYZE_RE.search(line)
            if m:
                fname, solver, cda, raw, sh, pf, crr, nrmse, status = m.groups()
                rides.append(RideRecord(
                    fname=fname,
                    solver=solver,
                    cda=float(cda),
                    cda_raw=None if raw in ("—", "-") else float(raw),
                    sigma_h=float(sh),
                    prior_factor=float(pf),
                    crr=float(crr),
                    nrmse_pct=int(nrmse),
                    status=status,
                ))
                continue
            m = HIER_NEFF_RE.search(line)
            if m:
                pending_neff = float(m.group(1))
                continue
            m = METHOD_B_RE.search(line)
            if m:
                mu_cda, lo, hi, tau, crr, _crr_lo, _crr_hi, n = m.groups()
                mb = MethodBRecord(
                    mu_cda=float(mu_cda),
                    mu_ci_lo=float(lo),
                    mu_ci_hi=float(hi),
                    tau=float(tau),
                    crr=float(crr),
                    n_rides=int(n),
                    n_eff=pending_neff,
                )
    return rides, mb


def diff_rides(
    a: list[RideRecord],
    b: list[RideRecord],
    threshold: float,
) -> None:
    n = min(len(a), len(b))
    if len(a) != len(b):
        print(
            f"⚠ Différent nombre de rides : {len(a)} vs {len(b)}. "
            f"Comparaison sur les {n} premiers (matching positionnel).",
            file=sys.stderr,
        )

    print(f"\n{'idx':>3}  {'Δ CdA':>8}  {'Δ raw':>8}  {'Δ σH':>7}  "
          f"{'Δ pf':>6}  status (A → B)")
    print("─" * 80)

    n_changed_status = 0
    n_changed_cda = 0
    sum_abs_dcda = 0.0
    max_abs_dcda = 0.0
    for i in range(n):
        ra, rb = a[i], b[i]
        d_cda = rb.cda - ra.cda
        d_raw = (
            (rb.cda_raw - ra.cda_raw)
            if (ra.cda_raw is not None and rb.cda_raw is not None)
            else None
        )
        d_sh = rb.sigma_h - ra.sigma_h
        d_pf = rb.prior_factor - ra.prior_factor
        status_change = ra.status != rb.status

        if abs(d_cda) >= threshold:
            n_changed_cda += 1
        if status_change:
            n_changed_status += 1
        sum_abs_dcda += abs(d_cda)
        max_abs_dcda = max(max_abs_dcda, abs(d_cda))

        if abs(d_cda) >= threshold or status_change or (d_raw is not None and abs(d_raw) >= threshold):
            d_raw_s = f"{d_raw:+.3f}" if d_raw is not None else "  —  "
            mark = " ⚠" if status_change else "  "
            print(
                f"{i:>3}  {d_cda:+.3f}    {d_raw_s}    {d_sh:+.3f}   "
                f"{d_pf:+.2f}   {ra.status} → {rb.status}{mark}"
            )

    print("─" * 80)
    print(f"Total : {n} rides comparés")
    print(f"  • {n_changed_cda} avec |Δ CdA| ≥ {threshold:.3f}")
    print(f"  • {n_changed_status} avec changement de quality_status")
    print(f"  • |Δ CdA| moyen : {sum_abs_dcda / n:.4f}")
    print(f"  • |Δ CdA| max   : {max_abs_dcda:.4f}")


def diff_method_b(a: MethodBRecord | None, b: MethodBRecord | None) -> None:
    if a is None and b is None:
        return
    print("\nMéthode hiérarchique (DerSimonian–Laird)")
    print("─" * 80)
    if a is None:
        print(f"A : (absente)")
        print(f"B : μ={b.mu_cda:.4f}  τ={b.tau:.3f}  n={b.n_rides}")
        return
    if b is None:
        print(f"A : μ={a.mu_cda:.4f}  τ={a.tau:.3f}  n={a.n_rides}")
        print(f"B : (absente)")
        return
    print(f"A : μ={a.mu_cda:.4f}  IC95=[{a.mu_ci_lo:.3f},{a.mu_ci_hi:.3f}]  "
          f"τ={a.tau:.3f}  n={a.n_rides}"
          + (f"  n_eff={a.n_eff:.1f}" if a.n_eff is not None else ""))
    print(f"B : μ={b.mu_cda:.4f}  IC95=[{b.mu_ci_lo:.3f},{b.mu_ci_hi:.3f}]  "
          f"τ={b.tau:.3f}  n={b.n_rides}"
          + (f"  n_eff={b.n_eff:.1f}" if b.n_eff is not None else ""))
    print(f"Δ : μ={b.mu_cda - a.mu_cda:+.4f}  τ={b.tau - a.tau:+.3f}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("log_a", type=Path, help="Premier fichier de log (référence)")
    ap.add_argument("log_b", type=Path, help="Deuxième fichier de log (à comparer)")
    ap.add_argument(
        "--threshold",
        type=float,
        default=0.005,
        help="|Δ CdA| seuil en m² au-delà duquel un ride est listé (défaut 0.005)",
    )
    args = ap.parse_args()

    if not args.log_a.exists():
        print(f"Fichier introuvable : {args.log_a}", file=sys.stderr)
        return 1
    if not args.log_b.exists():
        print(f"Fichier introuvable : {args.log_b}", file=sys.stderr)
        return 1

    a_rides, a_mb = parse_log(args.log_a)
    b_rides, b_mb = parse_log(args.log_b)

    print(f"A : {args.log_a.name}  ({len(a_rides)} rides)")
    print(f"B : {args.log_b.name}  ({len(b_rides)} rides)")

    diff_rides(a_rides, b_rides, args.threshold)
    diff_method_b(a_mb, b_mb)
    return 0


if __name__ == "__main__":
    sys.exit(main())
