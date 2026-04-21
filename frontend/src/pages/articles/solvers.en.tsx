import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function SolversEn() {
  return (
    <Article title="AeroProfile's 3 solvers: Martin LS, Chung VE, Wind-Inverse">
      <P>
        AeroProfile has three methods for estimating your{" "}
        <Tex>{String.raw`C_dA`}</Tex>. Each one rests on a different physical
        model and has its own strengths and weaknesses. The pipeline tries
        them in a cascade and keeps the one with the best{" "}
        <Tex>{String.raw`R^2`}</Tex>.
      </P>

      <Section title="1. Martin LS (least squares on power)">
        <P>
          This is the most direct approach, inspired by the Martin et al.
          (1998) power model. For each second of your ride, the model predicts
          the power you should have produced with candidate{" "}
          <Tex>{String.raw`C_dA`}</Tex> and <Tex>{String.raw`C_{rr}`}</Tex>{" "}
          values. The solver tunes those two parameters to minimize the sum of
          squared differences between modeled and measured power.
        </P>
        <Formula>{String.raw`\min_{C_dA,\, C_{rr}} \sum_{i=1}^{N} \bigl( P_{\text{model}}(i) - P_{\text{measured}}(i) \bigr)^2`}</Formula>
        <P>
          The modeled power at each instant <Tex>{String.raw`i`}</Tex> is the
          sum of four terms:
        </P>
        <Formula>{String.raw`P_{\text{model}} = \underbrace{\tfrac{1}{2}\,C_dA\,\rho\,V_{\text{air}}^2\,V}_{\text{aerodynamic}} + \underbrace{C_{rr}\,m\,g\,V}_{\text{rolling}} + \underbrace{m\,g\,V\,\text{slope}}_{\text{gravity}} + \underbrace{\tfrac{1}{2}\,m\,\frac{\Delta(V^2)}{\Delta t}}_{\text{acceleration}}`}</Formula>
        <P>
          The optimization is solved via{" "}
          <strong>scipy.optimize.least_squares</strong> with the Trust Region
          Reflective (TRF) algorithm. AeroProfile launches 3 starting points
          (multi-start strategy) to avoid local minima, with strict bounds:
        </P>
        <Formula>{String.raw`C_dA \in [0.15,\; 0.60], \quad C_{rr} \in [0.0015,\; 0.012]`}</Formula>
        <P>
          <strong>Strengths</strong>: simple, fast, and returns confidence
          intervals directly from the solver's Jacobian{" "}
          <Tex>{String.raw`J`}</Tex>. The covariance is estimated via{" "}
          <Tex>{String.raw`\text{Cov} \approx \sigma^2 (J^\top J)^{-1}`}</Tex>{" "}
          where <Tex>{String.raw`\sigma^2`}</Tex> is the residual variance.
        </P>
        <P>
          <strong>Weaknesses</strong>: very sensitive to instantaneous noise
          (GPS, power, wind). Every second of noisy data adds a squared
          residual that amplifies outliers. If the power meter fluctuates by{" "}
          <Tex>{String.raw`\pm 20\,\text{W}`}</Tex>, each point contributes{" "}
          <Tex>{String.raw`20^2 = 400`}</Tex> to the total cost. The{" "}
          <Tex>{String.raw`R^2`}</Tex> is often low on real rides (
          <Tex>{String.raw`< 0.5`}</Tex>).
        </P>
      </Section>

      <Section title="2. Chung VE (Virtual Elevation)">
        <P>
          Invented by Robert Chung, this method is the backbone of tools like
          Golden Cheetah Aerolab. Instead of comparing power second by second,
          we integrate the energy balance to reconstruct a "virtual altitude"
          and compare it with actual GPS altitude.
        </P>
        <P>
          At each time step <Tex>{String.raw`\Delta t`}</Tex>, we compute the
          energy contributions:
        </P>
        <Formula>{String.raw`\begin{aligned}
E_{\text{input}} &= P \cdot \eta \cdot \Delta t \\
E_{\text{aero}} &= \tfrac{1}{2}\,C_dA\,\rho\,V_{\text{air}}^2\,V\,\Delta t \\
E_{\text{rolling}} &= C_{rr}\,m\,g\,V\,\Delta t \\
E_{\text{kinetic}} &= \tfrac{1}{2}\,m\,\bigl(V_i^2 - V_{i-1}^2\bigr)
\end{aligned}`}</Formula>
        <P>
          The residual potential energy gives the virtual altitude change:
        </P>
        <Formula>{String.raw`\Delta h_i = \frac{E_{\text{input}} - E_{\text{aero}} - E_{\text{rolling}} - E_{\text{kinetic}}}{m \cdot g}`}</Formula>
        <Formula>{String.raw`h_{\text{virtual}}(t) = \sum_{i=1}^{t} \Delta h_i`}</Formula>
        <P>
          The objective is to minimize the gap between virtual altitude and
          actual altitude:
        </P>
        <Formula>{String.raw`\min_{C_dA,\, C_{rr}} \sum_{i=1}^{N} \bigl( h_{\text{virtual}}(i) - h_{\text{actual}}(i) \bigr)^2`}</Formula>
        <P>
          <strong>Why it's better</strong>: temporal integration naturally
          smooths noise. If the power meter jitters by{" "}
          <Tex>{String.raw`\pm 20\,\text{W}`}</Tex> each second, Martin LS
          sees <Tex>{String.raw`20^2 = 400`}</Tex> of squared residual per
          point. Chung VE integrates these fluctuations — they cancel in the
          cumulative sum — and the altitude residual is much smoother. It's
          the same principle as a low-pass filter: integration attenuates
          high frequencies.
        </P>
        <P>
          <strong>Limitation</strong>: if the ride is split into pieces by the
          filters (descents excluded, stops), integration restarts from zero
          at each block. We lose altitude "memory" across blocks. AeroProfile
          handles this via per-block alignment: at each block boundary,
          virtual and target altitudes are reset to zero to avoid penalizing
          inter-block drift.
        </P>
      </Section>

      <Section title="3. Wind-Inverse (the most advanced)">
        <P>
          Wind-inverse combines the best of both worlds: Chung's VE objective
          (noise-robust) with wind estimation as a free variable. Rather than
          blindly trusting the weather API, the solver estimates wind
          components itself, per time segment.
        </P>
        <P>
          The jointly estimated parameters are:
        </P>
        <Formula>{String.raw`\boldsymbol{\theta} = \bigl(\, C_{dA_0},\; C_{rr},\; u_1, v_1,\; u_2, v_2,\; \ldots,\; u_K, v_K \,\bigr)`}</Formula>
        <P>
          where <Tex>{String.raw`C_{dA_0}`}</Tex> is the{" "}
          <Tex>{String.raw`C_dA`}</Tex> at zero yaw,{" "}
          <Tex>{String.raw`(u_k, v_k)`}</Tex> are the east-west and
          north-south wind components for segment{" "}
          <Tex>{String.raw`k`}</Tex> (30-min segments), for a total of{" "}
          <Tex>{String.raw`2 + 2K`}</Tex> parameters. For example, a 2 h ride
          gives 4 segments and 10 parameters.
        </P>
        <P>
          Gaussian priors regularize the estimate to avoid degenerate
          solutions:
        </P>
        <Formula>{String.raw`\begin{aligned}
C_{rr} &\sim \mathcal{N}(0.0035,\; 0.0012^2) \\
C_{dA} &\sim \mathcal{N}(0.30,\; 0.12^2) \\
\text{wind}_k &\sim \mathcal{N}(\text{API value}_k,\; 2^2\;\text{m/s})
\end{aligned}`}</Formula>
        <P>
          The wind prior is centered on the Open-Meteo API value, with a
          standard deviation of <Tex>{String.raw`2\,\text{m/s}`}</Tex> that
          lets the solver correct forecast errors while preventing absurd
          wind values.
        </P>
        <P>
          <strong>Activation condition</strong>: heading variance{" "}
          <Tex>{String.raw`> 0.25`}</Tex>. If you ride in a straight line
          (mountain pass), wind and <Tex>{String.raw`C_dA`}</Tex> are
          collinear and thus indistinguishable — wind-inverse doesn't
          activate, and Chung VE takes over with the API wind.
        </P>
      </Section>

      <Section title="The cascade: how AeroProfile chooses">
        <P>
          Since April 2026, the cascade has been reworked to avoid running
          Martin LS on rides where it has no chance of beating wind-inverse.
          On a real dataset of 120 rides, Martin LS produced
          <strong> negative R² in 44% of cases</strong>, wasting ~200 ms per
          ride before wind-inverse stepped in. The new pipeline skips
          Martin LS whenever wind-inverse can be expressed:
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>Martin LS</strong> — launched <em>only</em> if{" "}
            <Tex>{String.raw`\sigma^2_{\text{heading}} < 0.25`}</Tex>. This
            covers near-linear rides (track, velodrome, one-way) where
            wind-inverse lacks diversity to separate wind from{" "}
            <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Wind-Inverse</strong> — the primary solver on all other
            rides. Jointly estimates{" "}
            <Tex>{String.raw`(C_dA, C_{rr}, \text{wind})`}</Tex> per segment
            by minimizing the altitude reconstruction error (Chung VE).
          </li>
          <li>
            <strong>Chung VE</strong> — last-resort fallback if no previous
            solver produced a <Tex>{String.raw`R^2 > 0.3`}</Tex>. Ensures an
            analysis never exits without a result.
          </li>
        </ol>
        <P>
          The selected solver is shown in the blue dashboard banner
          ("Method: wind_inverse", "Method: chung_ve").
        </P>
      </Section>

      <Section title="Chung VE cross-check (always on)">
        <P>
          Even when wind-inverse returns a clean result, <strong>Chung VE is
          systematically run</strong> on the same ride as an independent
          cross-check. Unlike the fallback cascade above, this second run
          never replaces wind: it only exposes the delta between the two
          estimates.
        </P>
        <P>
          The metric is simple:{" "}
          <Tex>{String.raw`\Delta = |C_{dA,\text{wind}} - C_{dA,\text{chung}}|`}</Tex>.
          Both solvers use the same objective function (altitude
          reconstruction error), so the delta shares units and is directly
          comparable. Classification thresholds:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text text-sm">
          <li>
            <strong>high</strong> — <Tex>{String.raw`|\Delta| < 0.02`}</Tex>.
            Both solvers converge within 2 cm² despite radically different
            wind handling (wind-inverse fits wind, Chung uses raw API). The
            estimate is robust.
          </li>
          <li>
            <strong>medium</strong> —{" "}
            <Tex>{String.raw`0.02 \leq |\Delta| < 0.05`}</Tex>. Slight
            disagreement, often from a systematic Open-Meteo error in the
            area (typical headwind underestimation in Brittany, tailwind
            overestimation in Provence depending on dominant direction).
          </li>
          <li>
            <strong>low</strong> — <Tex>{String.raw`|\Delta| \geq 0.05`}</Tex>.
            Strong disagreement — the ride is highly sensitive to wind
            handling. Typically a unidirectional ride (strong wind, high
            heading variance) where wind-inverse fits a poorly constrained
            wind field.
          </li>
          <li>
            <strong>unknown</strong> — one or more solvers (wind MAP, chung
            MAP, wind raw, chung raw) is stuck within{" "}
            <Tex>{String.raw`0.005\;\text{m}^2`}</Tex> of a physical bound.
            The delta between the two solvers can look tiny when in reality
            both are pinned against the wall — their "agreement" is a bound
            artefact, not a signal that the estimate is robust. Prioritizing
            the <em>out-of-prior</em> values (pass 0) helps detect these
            cases: if the solver doesn't move off the bound even without
            the prior, the data is forcing the result against the physical
            constraint.
          </li>
          <li>
            <strong>solvers_pegged</strong> (a separate class) — when{" "}
            <em>both</em> solvers (primary and Chung cross-check) are within{" "}
            <Tex>{String.raw`0.010\;\text{m}^2`}</Tex> of a physical bound{" "}
            <em>after</em> VE pass 2, the ride is classified{" "}
            <code>solvers_pegged</code> and{" "}
            <strong>excluded from the aggregate</strong>. Two independent
            solvers both converging to the bound means the physical model
            cannot find a coherent CdA for this ride — typical causes are a
            real wind very different from Open-Meteo, a position far from the
            prior, or a wind + sensor bias combination. No single solver can
            untangle these, so we explicitly refuse to display a value.
          </li>
        </ul>
        <P>
          The delta and its classification are exposed as a badge on each
          ride chip and stored in the history. Users can activate a{" "}
          &laquo; solver agreement ≥ medium/high &raquo; filter in the
          Intervals interface to exclude disagreeing rides from the
          aggregate. By default, the filter is off: the badge is
          informative, not coercive.
        </P>
        <P>
          A complementary indicator &laquo; personal solver bias &raquo;
          computes the median of{" "}
          <Tex>{String.raw`C_{dA,\text{chung}} - C_{dA,\text{wind}}`}</Tex>{" "}
          over the user's clean past rides. This value structures personal
          uncertainty: if your Open-Meteo is systematically wrong in one
          direction, the median will be non-zero and you'll see &laquo;
          personal solver Δ: +0.020 &raquo; below the Hessian CI.
        </P>
      </Section>

      <Section title="Adaptive prior: three passes per solver">
        <P>
          Each solver in the cascade is actually launched{" "}
          <strong>up to three times</strong> on the same ride:
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>Pass 0 — conditional MLE</strong> (prior weight for{" "}
            <em>CdA</em> alone = 0). Gives{" "}
            <Tex>{String.raw`\widehat{C_dA}_{\text{no-prior}}`}</Tex> which
            we show in the UI when the CdA prior has significantly pulled the
            estimate (gap &gt; 0.02 m²). <strong>Important</strong>: the
            wind prior (toward Open-Meteo) and the Crr prior stay active at
            their base weight. Disabling them too would make the problem
            underdetermined — wind_inverse has ~150 free wind parameters.
            So this &laquo; MLE &raquo; is not a pure MLE: it's a
            conditional MLE where only the CdA constraint is relaxed.
          </li>
          <li>
            <strong>Pass 1 — base prior</strong> with{" "}
            <Tex>{String.raw`w = 0.3\sqrt{N}`}</Tex> (Gelman BDA3 ch.14
            formula). This is the main pass and provides the point estimate
            published in the API.
          </li>
          <li>
            <strong>Pass 2 — reinforced prior</strong> if{" "}
            <Tex>{String.raw`\sigma_{\text{Hess}} / \sigma_{\text{prior}} > 1`}</Tex>.
            The prior weight is then multiplied by this ratio, which
            corresponds to an adaptive James-Stein-style shrinkage: when the
            likelihood is flat (uninformative data), we let the prior
            dominate proportionally to its informational advantage.
            <strong> The ratio is capped at 3.0</strong> — beyond that, the
            ride is effectively non-identifiable and should be marked as
            such by the quality gate, not rescued by a prior that would
            crush the data 10×.
          </li>
        </ol>
        <P>
          Confidence intervals are computed via the Laplace approximation on
          the <em>complete</em> Hessian — that is, including the prior
          residual rows in the Jacobian <Tex>{String.raw`J`}</Tex>, then{" "}
          <Tex>{String.raw`\Sigma = \hat{s}^2 (J^\top J)^{-1}`}</Tex>. Reason:
          in pass 2 the prior carries weight; the posterior Hessian is the
          sum of the data Hessian and the prior Hessian. Excluding the prior
          rows would give an underestimated curvature, hence an overestimated{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex>, which would trigger
          superfluous pass 2s.
        </P>
        <P>
          The pass 2 idea follows from the fact that a fixed prior at{" "}
          <Tex>{String.raw`0.3\sqrt{N}`}</Tex> weighs proportionally less
          than the data when N is large — perfect on a clean ride,
          problematic on a noisy ride where we'd want the prior to win. The
          ratio{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}} / \sigma_{\text{prior}}`}</Tex>{" "}
          measures exactly this informativity: if it's large, the data
          doesn't distinguish CdA well, so trust the prior.
        </P>
        <P>
          After the cascade, an <strong>iterative pass 2</strong> compares
          virtual altitude to real altitude using a two-criterion hybrid
          approach. The goal is to exclude segments where the model diverges
          significantly, then rerun the solver on the remaining points.
        </P>
        <P>
          <strong>Criterion 1 — Drift rate</strong>: we compute the temporal
          derivative of the drift (smoothed over 30 s) between virtual and
          actual altitude:
        </P>
        <Formula>{String.raw`\text{drift}(t) = h_{\text{virtual}}(t) - h_{\text{actual}}(t)`}</Formula>
        <Formula>{String.raw`\text{drift\_rate}(t) = \left|\frac{d}{dt}\,\overline{\text{drift}}_{30s}(t)\right|`}</Formula>
        <P>
          The threshold is adaptive, based on positive elevation gain
          normalized by duration:
        </P>
        <Formula>{String.raw`\text{rate\_thresh} = \max\!\bigl(0.10,\; 4 \times D^+ / T\bigr) \quad [\text{m/s}]`}</Formula>
        <P>
          <strong>Criterion 2 — Absolute drift (safety net)</strong>: even
          with a low drift rate, long accumulation can indicate systematic
          bias. We also exclude points where the smoothed absolute drift
          exceeds a threshold proportional to total{" "}
          <Tex>{String.raw`D^+`}</Tex>:
        </P>
        <Formula>{String.raw`|\overline{\text{drift}}_{60s}(t)| > \text{abs\_thresh}`}</Formula>
        <P>
          Both masks are combined (<Tex>{String.raw`\texttt{AND}`}</Tex>)
          with the existing filter. A <strong>30% cap</strong> prevents
          removing too many points: if more than 30% of valid points fail
          the VE test, the model is globally bad and the refinement is
          cancelled — we keep the pass 1 result as-is.
        </P>
        <Formula>{String.raw`\frac{N_{\text{excluded by VE}}}{N_{\text{valid pass 1}}} > 0.30 \;\Rightarrow\; \text{no pass 2}`}</Formula>
        <P>
          If the number of excluded points is significant
          (<Tex>{String.raw`> 20`}</Tex>) and at least 100 valid points
          remain, the best pass 1 solver is rerun on the filtered dataset.
          The result then has to pass <strong>two acceptance
          safeguards</strong> before replacing pass 1:
        </P>
        <ol className="list-decimal ml-6 space-y-1 text-text text-sm">
          <li>
            <strong>No new bound hit</strong> — if pass 1 was not at the
            physical bound and pass 2 ends within 0.005 m² of a bound, the
            result is rejected. Removing points shouldn't make the estimate
            degenerate.
          </li>
          <li>
            <strong>No R² regression</strong> — if{" "}
            <Tex>{String.raw`R^2_{\text{pass 2}} < R^2_{\text{pass 1}} - 0.05`}</Tex>,
            the result is rejected. A subset of informative points should
            give an equally good or better fit, not worse.
          </li>
        </ol>
        <P>
          The dedicated article <em>Hybrid iterative refinement</em> details
          the historical bug these safeguards fix (silent acceptance of a
          &laquo; pile-on-the-bound &raquo; result), the real pass 2
          frequency in production runs (55–70% of rides), and the traceable
          logs produced for a posteriori diagnosis.
        </P>
      </Section>

      <Section title="Bayesian priors: the safety net">
        <P>
          All solvers use weak Gaussian priors on{" "}
          <Tex>{String.raw`C_dA`}</Tex> and <Tex>{String.raw`C_{rr}`}</Tex>. A
          prior is a probabilistic "a priori" belief: before seeing the data,
          we express a soft belief about plausible parameter values.
          Formally, the cost gets a penalty term:
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{total}} = \underbrace{\sum_i r_i^2}_{\text{likelihood}} + \underbrace{w \cdot \left(\frac{C_{rr} - \mu_{C_{rr}}}{\sigma_{C_{rr}}}\right)^2}_{\text{prior } C_{rr}} + \underbrace{w \cdot \left(\frac{C_dA - \mu_{C_dA}}{\sigma_{C_dA}}\right)^2}_{\text{prior } C_dA}`}</Formula>
        <P>
          where <Tex>{String.raw`w`}</Tex> is a weight proportional to{" "}
          <Tex>{String.raw`\sqrt{N}`}</Tex> and to the residual scale, so
          the prior adapts automatically to dataset size.
        </P>
        <P>
          The prior on <Tex>{String.raw`C_{rr}`}</Tex> is fixed regardless
          of bike type:
        </P>
        <Formula>{String.raw`C_{rr} \sim \mathcal{N}(0.0035,\; 0.0012^2) \quad \text{(tubeless tire, asphalt)}`}</Formula>
        <P>
          The prior on <Tex>{String.raw`C_dA`}</Tex>, by contrast,{" "}
          <strong>depends on the selected bike type</strong>. This lets the
          solver converge faster into the right zone and avoids absurd
          results for the discipline:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Bike type</th>
                <th className="py-2">Prior <Tex>{String.raw`C_dA`}</Tex></th>
                <th className="py-2">Solver bounds</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans">Road</td>
                <td><Tex>{String.raw`\mathcal{N}(0.32,\; 0.08^2)`}</Tex></td>
                <td>[0.20, 0.55]</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans">TT / Triathlon</td>
                <td><Tex>{String.raw`\mathcal{N}(0.22,\; 0.05^2)`}</Tex></td>
                <td>[0.15, 0.35]</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans">MTB / Gravel</td>
                <td><Tex>{String.raw`\mathcal{N}(0.45,\; 0.08^2)`}</Tex></td>
                <td>[0.30, 0.65]</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          When the data is good, the prior does almost nothing — the
          likelihood dominates. When the data is bad or insufficient, it
          guides the solver toward discipline-expected values.
        </P>
        <Note>
          See the dedicated article on Bayesian priors for the full
          mathematical formulation and calibration.
        </Note>
      </Section>
    </Article>
  );
}
