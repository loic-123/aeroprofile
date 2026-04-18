"""Hierarchical (random-effects) solver for joint multi-ride CdA estimation.

Model:
    CdA_i ~ N(mu, tau²)            (each ride has its own CdA, drawn from
                                     a normal centred on the rider's "true" mean)
    Crr   = constant                (assumed identical across rides since
                                     equipment doesn't change)
    P_i   = sum_t residuals from Chung VE on ride i

Joint optimisation over (mu, log(tau), Crr, CdA_1, ..., CdA_N) by minimising:

    sum_i [
        sum_t (h_virtual_i,t - h_real_i,t)²       # Chung VE per ride
      + ((CdA_i - mu) / tau)²                      # random-effects penalty
    ]
  + optional prior on mu (typically not used: we want pure MLE)

This is the standard random-effects model from meta-analysis
(DerSimonian & Laird 1986, Gelman BDA3 ch.5). It is mathematically more
rigorous than per-ride MLE + post-hoc averaging because:

1. The Crr is shared → information from rides with strong Crr signal
   improves CdA estimates on rides with weak Crr signal.
2. The CdA_i are jointly constrained → an outlier ride is automatically
   pulled toward the consensus, and tau quantifies the inter-ride spread.
3. The uncertainty on mu comes from the global Hessian, not from the
   propagation of per-ride errors.

Returns: dict with mu, tau, crr, per_ride [(cda_i, sigma_i, residuals_i)].
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

import numpy as np
import pandas as pd
from aeroprofile.physics.constants import ETA_DEFAULT

logger = logging.getLogger(__name__)


@dataclass
class HierarchicalResult:
    mu_cda: float                    # mean CdA across rides (the parameter of interest)
    mu_cda_ci: tuple[float, float]   # 95% CI on mu
    tau: float                        # inter-ride standard deviation
    crr: float                        # shared Crr
    crr_ci: tuple[float, float]
    per_ride_cda: list[float]         # CdA_i for each ride
    per_ride_sigma: list[float]       # ±1σ on each CdA_i
    per_ride_r2: list[float]          # R² of altitude reconstruction per ride
    n_rides: int
    n_points_total: int
    n_eff: float                      # effective n from RE weights, ≤ n_rides
    hksj_applied: bool = False        # True if HKSJ small-k IC95 used


def solve_hierarchical(
    dfs: Sequence[pd.DataFrame],
    mass: float,
    eta: float = ETA_DEFAULT,
    crr_fixed: float | None = None,
    tau_init: float = 0.03,  # kept for backward-compat, unused by DL
    cda_init: float = 0.32,  # kept for backward-compat, unused by DL
    cda_lower: float = 0.10,
    cda_upper: float = 0.80,
    cda_prior_mean: float | None = None,
    cda_prior_sigma: float | None = None,
) -> HierarchicalResult:
    """Random-effects meta-analysis on N rides via DerSimonian-Laird.

    Each df must contain columns: v_ground, v_air, rho, power, dt,
    altitude_smooth, filter_valid.

    Returns μ (rider's average CdA), τ (inter-ride SD), and per-ride
    estimates. Previously implemented as a joint MLE over
    (μ, τ, Crr, CdA_1..N) with scipy.optimize.least_squares, which had
    a formulation bug (see B2/tau-ceiling note in .claude/). The current
    implementation uses DerSimonian-Laird's closed-form estimator:

      τ² = max(0, (Q − (k − 1)) / (Σ wᵢ − Σ wᵢ² / Σ wᵢ))
           with Q = Σ wᵢ (CdA_i − μ_FE)², wᵢ = 1/σᵢ²

    where σᵢ is the Hessian CI half-width from the per-ride Chung VE
    solve. μ is then the inverse-variance weighted mean with random-
    effects weights wᵢ' = 1/(σᵢ² + τ²), and SE(μ) = 1/√(Σ wᵢ') gives
    the IC95.
    """
    _ = (tau_init, cda_init)  # unused, kept for API compatibility
    # Pre-extract per-ride arrays (only valid filtered points)
    rides_data = []
    for df in dfs:
        valid = df[df["filter_valid"]].reset_index(drop=True)
        if len(valid) < 60:
            continue
        V = np.asarray(valid["v_ground"].to_numpy(), dtype=float)
        V_air = np.asarray(valid["v_air"].to_numpy(), dtype=float)
        rho = np.asarray(valid["rho"].to_numpy(), dtype=float)
        P = np.asarray(valid["power"].to_numpy(), dtype=float)
        dt = np.asarray(valid["dt"].to_numpy(), dtype=float)
        alt_real = np.asarray(valid["altitude_smooth"].to_numpy(), dtype=float)
        # Block starts from dt jumps
        block_starts = np.zeros(len(V), dtype=bool)
        block_starts[0] = True
        block_starts[1:] = dt[1:] > 3.0
        rides_data.append({
            "V": V, "V_air": V_air, "rho": rho, "P": P, "dt": dt,
            "alt_real": alt_real, "block_starts": block_starts,
            "n": len(V),
        })

    n_rides = len(rides_data)
    if n_rides == 0:
        raise ValueError("No valid rides for hierarchical solve")
    n_points_total = sum(rd["n"] for rd in rides_data)
    logger.info(
        "HIERARCHICAL start (DerSimonian-Laird): n_rides=%d crr_fixed=%s "
        "cda_bounds=[%.2f,%.2f] prior=(%s,%s)",
        n_rides,
        f"{crr_fixed:.5f}" if crr_fixed is not None else "None (estimated)",
        cda_lower, cda_upper,
        f"{cda_prior_mean:.3f}" if cda_prior_mean is not None else "None",
        f"{cda_prior_sigma:.3f}" if cda_prior_sigma is not None else "None",
    )

    # --- Step 1: estimate each ride independently, CdA + σ_i ---
    #
    # Previous implementation tried to optimise (μ, log τ, Crr, cda_1..N)
    # jointly via least_squares. The residual for the random-effects penalty
    # was `(cda_i - μ) / τ`, giving a cost term `Σ (cda_i - μ)² / τ²`. This
    # is the quadratic part of the Gaussian NLL but the normalisation term
    # `N · log(τ)` was missing — so the solver had no incentive to keep τ
    # finite and always pushed it to the upper bound. After raising the
    # bound from log(0.20) to log(0.40) (commit 76dddf6), the τ was still
    # pinned at 0.400 on every run, confirming the formulation bug rather
    # than a bound issue.
    #
    # Switched to DerSimonian-Laird (DL) — the classical closed-form
    # estimator in meta-analysis. It doesn't attempt a joint MLE; instead:
    #   1. Estimate each CdA_i + σ_i independently (the Hessian CI from
    #      each single-ride Chung VE solve gives σ_i without any extra
    #      optimisation).
    #   2. Compute Q and τ² via the DL formula (closed-form, no iteration).
    #   3. Compute μ as the inverse-variance weighted mean with weights
    #      w_i = 1 / (σ_i² + τ²).
    #   4. IC95 on μ from SE(μ) = 1 / √(Σ w_i).
    # References: DerSimonian & Laird, Controlled Clinical Trials, 1986.
    #              Higgins & Thompson, Stat. Med. 2002 (bias properties).
    from aeroprofile.solver.chung_ve import solve_chung_ve
    from aeroprofile.bike_types import get_bike_config

    def _fake_df_for_chung(rd):
        # chung_ve.solve_chung_ve expects a pandas df with filter_valid etc.
        # We reconstruct a minimal df from the rides_data tuple — all points
        # are already the valid subset.
        import pandas as _pd
        n = rd["n"]
        return _pd.DataFrame({
            "v_ground": rd["V"],
            "v_air": rd["V_air"],
            "rho": rd["rho"],
            "power": rd["P"],
            "dt": rd["dt"],
            "altitude_smooth": rd["alt_real"],
            "filter_valid": np.ones(n, dtype=bool),
        })

    # Per-ride Chung VE solve with the same Crr as the main pipeline.
    # Using a neutral prior centre (the midpoint of the physical bounds)
    # so the per-ride estimates don't bake in the "position" prior — the
    # DL aggregation reintroduces regularisation via τ, not via per-ride
    # shrinkage.
    per_ride_cda = []
    per_ride_sigma = []
    per_ride_r2 = []
    for i, rd in enumerate(rides_data):
        try:
            sub_df = _fake_df_for_chung(rd)
            chung = solve_chung_ve(
                sub_df,
                mass=mass,
                eta=eta,
                crr_fixed=crr_fixed if crr_fixed is not None else 0.005,
                cda_prior_mean=(cda_lower + cda_upper) / 2,
                cda_prior_sigma=(cda_upper - cda_lower) / 2,  # very weak
                cda_lower=cda_lower,
                cda_upper=cda_upper,
            )
            cda_i = float(chung.cda)
            ci_lo, ci_hi = chung.cda_ci
            if not (np.isnan(ci_lo) or np.isnan(ci_hi)):
                # Floor raised from 0.005 to 0.010: a per-ride σ below 1 m²·1%
                # is unrealistic on cycling data (sensor noise + wind +
                # rolling resistance variability all contribute). Floors that
                # are too low let a single "lucky" ride dominate the DL
                # weighted mean (w_i ∝ 1/σ_i² → ratio of 4× per halving of
                # σ_i). The 0.010 floor caps that to a 4× advantage over the
                # average ride, which is still real but no longer drowning
                # out all peers.
                sigma_i = max((ci_hi - ci_lo) / 3.92, 0.010)
            else:
                sigma_i = 0.05  # fallback
            per_ride_cda.append(cda_i)
            per_ride_sigma.append(float(sigma_i))
            per_ride_r2.append(float(chung.r_squared_elev))
        except Exception as _e:
            logger.warning("HIERARCHICAL per-ride solve failed (ride %d): %s", i, _e)
            # Fallback: use the prior centre with a wide sigma so this ride
            # is effectively ignored in the DL weighting.
            per_ride_cda.append((cda_lower + cda_upper) / 2)
            per_ride_sigma.append(0.20)
            per_ride_r2.append(0.0)

    cdas_arr = np.asarray(per_ride_cda, dtype=float)
    sigmas_arr = np.asarray(per_ride_sigma, dtype=float)

    # --- Step 2: DerSimonian-Laird τ² ---
    # Fixed-effect weights: w_i = 1 / σ_i²
    w_fe = 1.0 / (sigmas_arr ** 2)
    # Fixed-effect mean
    mu_fe = float(np.sum(w_fe * cdas_arr) / np.sum(w_fe))
    # Cochran's Q
    Q = float(np.sum(w_fe * (cdas_arr - mu_fe) ** 2))
    # DL estimator
    if n_rides > 1:
        c = float(np.sum(w_fe) - np.sum(w_fe ** 2) / np.sum(w_fe))
        tau2 = max(0.0, (Q - (n_rides - 1)) / c) if c > 0 else 0.0
    else:
        tau2 = 0.0
    tau = float(np.sqrt(tau2))

    # --- Step 3: random-effects μ ---
    w_re = 1.0 / (sigmas_arr ** 2 + tau2)
    mu_re = float(np.sum(w_re * cdas_arr) / np.sum(w_re))

    # Optional prior on μ (applied AFTER DL as an extra virtual data point,
    # following Bayesian precedent). Typically NOT used in AeroProfile for
    # multi-ride mode — the prior is applied per-ride in the individual
    # Chung solves, and the aggregation is kept prior-free so the user can
    # see the raw consensus.
    if cda_prior_mean is not None and cda_prior_sigma is not None and cda_prior_sigma > 0:
        # Add an equivalent virtual "ride" with known CdA = prior_mean and
        # sigma = cda_prior_sigma, then recompute the weighted mean.
        w_prior = 1.0 / (cda_prior_sigma ** 2 + tau2)
        num = np.sum(w_re * cdas_arr) + w_prior * cda_prior_mean
        den = float(np.sum(w_re)) + w_prior
        mu_re = float(num / den)
        w_sum = den
    else:
        w_sum = float(np.sum(w_re))

    mu = mu_re
    # SE of the random-effects mean — closed form from DL.
    se_mu = float(1.0 / np.sqrt(w_sum)) if w_sum > 0 else float("nan")

    # Hartung–Knapp–Sidik–Jonkman (HKSJ) small-sample correction for
    # n < 10. The plain DL SE assumes the per-ride CdA uncertainties are
    # known exactly and uses the Gaussian 1.96 quantile — both are poor
    # approximations when k is small (IntHout et al., BMC Med Res
    # Methodol 2014). HKSJ widens the IC95 with:
    #   q   = (1 / (k − 1)) · Σ w'_i · (CdA_i − μ)² / Σ w'_i
    #   SE  = SE_DL · √q
    #   CI  = μ ± t_{0.975, k−1} · SE
    # For k ≥ 10 we stay on the asymptotic (Gaussian) interval since the
    # t-distribution is already very close to the normal there.
    hksj_applied = False
    if 2 <= n_rides < 10 and w_sum > 0:
        from scipy.stats import t as _student_t
        hksj_applied = True
        q_num = float(np.sum(w_re * (cdas_arr - mu) ** 2))
        q_den = float(np.sum(w_re))
        q = q_num / q_den / (n_rides - 1)
        # Guard against q < 1 collapsing the CI: IntHout et al.
        # recommend max(q, 1) to preserve the DL interval as a floor.
        q = max(q, 1.0)
        se_mu_hksj = se_mu * np.sqrt(q)
        t_crit = float(_student_t.ppf(0.975, df=n_rides - 1))
        mu_ci = (float(mu - t_crit * se_mu_hksj), float(mu + t_crit * se_mu_hksj))
        logger.info(
            "HIERARCHICAL HKSJ small-k correction applied: k=%d q=%.3f "
            "t_crit=%.3f → SE %.4f → %.4f",
            n_rides, q, t_crit, se_mu, se_mu_hksj,
        )
        se_mu = se_mu_hksj
    else:
        mu_ci = (float(mu - 1.96 * se_mu), float(mu + 1.96 * se_mu))

    # Crr: shared and fixed (matches pipeline.effective_crr_fixed). We
    # don't re-estimate it because per-ride Chung solves already used
    # crr_fixed. The "CI" is just the fixed value.
    crr_val = float(crr_fixed) if crr_fixed is not None else 0.005
    crr_ci = (crr_val, crr_val)

    # Clamp per-ride σ display to something sensible for the UI
    per_ride_sigma_out = [float(s) for s in sigmas_arr]

    # Rough heterogeneity indicator for logging: I² = max(0, (Q − k + 1) / Q)
    i2 = max(0.0, (Q - (n_rides - 1)) / Q) if Q > 0 else 0.0
    logger.info(
        "HIERARCHICAL DL done: μ=%.3f se=%.4f τ=%.3f τ²=%.5f | "
        "Q=%.2f (df=%d) I²=%.1f%% | μ_FE=%.3f | n=%d",
        mu, se_mu, tau, tau2, Q, n_rides - 1, 100 * i2, mu_fe, n_rides,
    )
    # Per-ride σ_i diagnostic: lets us see at a glance which rides drove the
    # DL weighted mean (weight ∝ 1/σ_i²) and which were down-weighted. If
    # one σ_i is clearly smaller than the rest, that ride dominates the
    # estimate — useful when investigating an unexpected μ shift between
    # two runs.
    sigma_strs = ", ".join(f"{s:.3f}" for s in sigmas_arr)
    cda_strs = ", ".join(f"{c:.3f}" for c in cdas_arr)
    logger.info("HIERARCHICAL DL per-ride σ_i = [%s]", sigma_strs)
    logger.info("HIERARCHICAL DL per-ride CdA = [%s]", cda_strs)
    # Effective sample size from random-effects weights:
    #   n_eff = (Σ w_i)² / Σ w_i²
    # Equals n_rides when all σ_i are identical, drops below n when one or
    # two rides dominate. Useful sanity check vs. the nominal n.
    sum_w = float(np.sum(w_re))
    sum_w2 = float(np.sum(w_re ** 2))
    n_eff = (sum_w ** 2) / sum_w2 if sum_w2 > 0 else float(n_rides)
    logger.info(
        "HIERARCHICAL DL n_eff = %.1f (nominal n = %d, ratio = %.2f)",
        n_eff, n_rides, n_eff / n_rides if n_rides > 0 else 0.0,
    )

    return HierarchicalResult(
        mu_cda=float(mu),
        mu_cda_ci=mu_ci,
        tau=float(tau),
        crr=crr_val,
        crr_ci=crr_ci,
        per_ride_cda=[float(c) for c in cdas_arr],
        per_ride_sigma=per_ride_sigma_out,
        per_ride_r2=per_ride_r2,
        n_rides=n_rides,
        n_points_total=n_points_total,
        n_eff=float(n_eff),
        hksj_applied=hksj_applied,
    )
