import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function PriorInvarianceEn() {
  return (
    <Article title="Prior invariance: why your position choice should not move the aggregated CdA">
      <P>
        When you launch a multi-ride analysis, you pick a{" "}
        <em>position prior</em> ("Aero drops", "Moderate hoods",
        "Relaxed tops"…). This Bayesian prior helps each individual
        ride by injecting prior information about CdA — useful when
        the data is noisy and the solver, unconstrained, would go off
        the rails.
      </P>
      <P>
        But the aggregate <Tex>{String.raw`\mu`}</Tex> over N rides{" "}
        <strong>should not depend</strong> on this choice. If you
        rerun the same analysis with a prior centered on 0.30 and
        then with a prior centered on 0.40, the final estimate must
        be near-identical. Prior invariance is one of the most
        powerful consistency checks you can apply to a meta-analysis —
        and one of the most diagnostic when it <em>breaks</em>.
      </P>

      <Section title="Why μ should be independent of the chosen prior">
        <P>
          The central theorem is simple: with enough data per ride,
          the likelihood dominates the prior. Each ride contributes a{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> from the fit Hessian, and
          if <Tex>{String.raw`\sigma_i`}</Tex> is much smaller than
          the prior width <Tex>{String.raw`\sigma_{\text{prior}}`}</Tex>,
          the Bayesian shift is negligible:
        </P>
        <Formula>{String.raw`\hat{C}_{dA,i}^{\text{post}} \approx \hat{C}_{dA,i}^{\text{MLE}} + \frac{\sigma_i^2}{\sigma_{\text{prior}}^2}\,(C_{dA}^{\text{prior}} - \hat{C}_{dA,i}^{\text{MLE}})`}</Formula>
        <P>
          The factor{" "}
          <Tex>{String.raw`\sigma_i^2 / \sigma_{\text{prior}}^2`}</Tex>{" "}
          is typically <Tex>{String.raw`\sim 10^{-2}`}</Tex> on a
          well-constrained ride. A prior variation of{" "}
          <Tex>{String.raw`\Delta C_{dA}^{\text{prior}} = 0.10`}</Tex>{" "}
          then moves each{" "}
          <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> by only{" "}
          <Tex>{String.raw`10^{-3}`}</Tex>. Over 30 rides the shift
          of the weighted mean is <em>even smaller</em> because
          errors partially cancel.
        </P>
        <P>
          That's why AeroProfile exposes two quantities side by side
          in the JSON response:
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed my-2">
          <li>
            <code>cda</code>: the post-prior result (used for
            aggregation and display).
          </li>
          <li>
            <code>cda_raw</code>: the result <strong>without CdA
            prior</strong> — solver pass 0, where the Bayesian CdA
            prior is disabled, but the wind and Crr priors remain
            slightly active (see the <em>Bayesian priors</em>{" "}
            article for details). This <code>cda_raw</code> must be{" "}
            <em>strictly identical</em> between two runs differing
            only in the choice of CdA prior.
          </li>
        </ul>
      </Section>

      <Section title="Consistency check: compare two runs">
        <P>
          The best way to verify that the pipeline is invariant is to
          rerun the <em>same</em> analysis with two different priors
          and compare ride by ride. AeroProfile ships{" "}
          <code>scripts/compare_runs.py</code> for this:
        </P>
        <pre className="bg-bg/50 border border-border rounded p-3 text-xs font-mono overflow-x-auto my-3">
{`python scripts/compare_runs.py logs/session_prior_030.log logs/session_prior_040.log
                                   --threshold 0.005`}
        </pre>
        <P>
          The script extracts <code>ANALYZE</code> lines from each
          log (positional matching: we assume both runs processed the
          same files in the same order, which is guaranteed by{" "}
          <code>/analyze-batch</code>) and prints a table of deltas:{" "}
          <Tex>{String.raw`\Delta C_{dA}, \Delta C_{dA}^{\text{raw}}, \Delta \sigma_H, \Delta`}</Tex>{" "}
          prior factor, and any change in{" "}
          <code>quality_status</code>. The default threshold is{" "}
          <code>0.005 m²</code> — above that a ride has changed
          significantly.
        </P>
        <P>
          On a clean dataset (Assioma Duo, 50 rides, two priors 0.10
          apart), the expected result is:
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>0 rides</strong> with{" "}
            <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| > 0.001`}</Tex>{" "}
            (theoretical invariance holds).
          </li>
          <li>
            <strong>0 rides</strong> with a change in{" "}
            <code>quality_status</code> (the pipeline classifies
            rides deterministically).
          </li>
          <li>
            <Tex>{String.raw`|\Delta \mu| < 0.002\;\text{m}^2`}</Tex>{" "}
            on the aggregate — invisible to the naked eye in the UI.
          </li>
        </ul>
      </Section>

      <Section title="When invariance breaks, and what it means">
        <P>
          On a test dataset (4iiii single-sided, 30 noisy rides),
          the first consistency run in April 2026 showed{" "}
          <strong>4 of 30 rides with a non-invariant{" "}
          <code>cda_raw</code></strong> — when by construction it
          should have been invariant. Observed differential on these
          4 rides:{" "}
          <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| \in [0.008, 0.024]\;\text{m}^2`}</Tex>.
        </P>
        <Warning>
          <strong>Root cause identified.</strong> The multi-start{" "}
          <code> wind_inverse</code> solver initialized its first
          seed at{" "}
          <Tex>{String.raw`x_0[0] = C_{dA}^{\text{prior\;mean}}`}</Tex>{" "}
          — thus different between the two runs. Combined with
          overly loose <code>least_squares</code> tolerances{" "}
          (<code>ftol = xtol = gtol = 1e-8</code> by default,{" "}
          <em>looser than the numerical noise of the Hessian on
          these noisy rides</em>), the solver converged to two
          slightly different local minima depending on the starting
          point. On informative rides, the two minima coincide and
          invariance holds; on the 4 rides where the cost function
          has several nearly equivalent valleys, the solver fell
          into the one nearest the starting point.
        </Warning>
        <P>
          The fix is in two changes:
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>Prior-independent initialization.</strong> The
            first seed of the multi-start sweep is now{" "}
            <Tex>{String.raw`x_0[0] = (C_{dA}^{\text{lower}} + C_{dA}^{\text{upper}}) / 2`}</Tex>{" "}
            — the midpoint of the bike-type physical bounds, which
            does not depend on the chosen prior.
          </li>
          <li>
            <strong>Tightened tolerances.</strong> Moved to{" "}
            <code>ftol = xtol = gtol = 1e-10</code> with{" "}
            <code>x_scale = "jac"</code>. The optimizer now
            converges to the machine precision of the Hessian,
            which eliminates multi-start convergence noise.
          </li>
        </ol>
        <P>
          After the fix, the same consistency test on the 4iiii
          dataset (32 rides, priors 0.30 vs 0.40) gives:
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>26 of 30 rides with strict invariance</strong>{" "}
            (<Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| \leq 0.001`}</Tex>).
          </li>
          <li>
            Mean <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}|`}</Tex>{" "}
            = <Tex>{String.raw`0.0026\;\text{m}^2`}</Tex>, five
            times below the diagnostic threshold.
          </li>
          <li>
            <strong>3 residual rides</strong> with{" "}
            <Tex>{String.raw`|\Delta C_{dA}^{\text{raw}}| \in [0.011, 0.038]`}</Tex> —
            all in <code>sensor_miscalib_warn</code>, all with{" "}
            <Tex>{String.raw`\sigma_H < 0.025`}</Tex>{" "}
            (numerically constrained fit but pathological cost
            function).
          </li>
        </ul>
        <Note>
          <strong>Residual limit.</strong> The 3 rides that remain
          non-invariant after the fix no longer suffer from the
          initialization bug — they have a{" "}
          <em>data + residual priors</em> cost function (Open-Meteo
          wind and Crr remain slightly regularized even in pass 0)
          that contains <strong>several nearly-equivalent local
          minima</strong>. The multi-start sweep finds a different
          one depending on the CdA prior, not because it starts in
          a different place, but because the prior bowl combines
          with the data bowls and shifts the global minimum by a
          few millimeters in parameter space. Fixing this completely
          would require a pass 0 truly free of any prior (wind and
          Crr included), at the cost of potential numerical
          instability on rides where the API wind is the only
          available signal. The current compromise — 87% strict
          invariance, 3 documented outliers all in{" "}
          <code>sensor_miscalib_warn</code> — is accepted as-is, and
          these 3 rides have no measurable impact on{" "}
          <Tex>{String.raw`\mu`}</Tex> (the hierarchical method
          excludes them or recenters them via{" "}
          <Tex>{String.raw`\tau^2`}</Tex>).
        </Note>
      </Section>

      <Section title="Why cda (post-prior) still moves slightly">
        <P>
          Even with a perfect solver, <code>cda</code> post-prior
          can move between two runs with different priors — this is
          expected, and it's <em>the very purpose of the prior</em>.
          Bayesian shrinkage pulls each ride toward the prior center,
          so two different priors pull toward different centers. The
          question is not &laquo; does <code>cda</code> move? &raquo;
          but{" "}
          <strong>&laquo; does it move less than the prior width?
          &raquo;</strong>.
        </P>
        <P>
          The right order of magnitude: for a prior of width{" "}
          <Tex>{String.raw`\sigma_{\text{prior}} = 0.08`}</Tex>, a
          shift of <Tex>{String.raw`\mu`}</Tex> less than{" "}
          <Tex>{String.raw`0.005\;\text{m}^2`}</Tex> between two
          centers <Tex>{String.raw`0.10`}</Tex> apart is consistent
          with expectations. More is not, and signals a solver
          problem (case observed on this 4iiii dataset) or a problem
          with the adaptive prior scaling (a factor{" "}
          <Tex>{String.raw`\lambda > 3`}</Tex> would crush the
          ride's information before the capping fix).
        </P>
      </Section>

      <Section title="Hierarchical method vs weighted mean">
        <P>
          The hierarchical method (DerSimonian–Laird) is{" "}
          <strong>by construction independent of the CdA prior</strong>.
          It never uses the Bayesian prior: each ride contributes
          its <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> and{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> (from the fit), then
          aggregation combines them via the random-effects weights{" "}
          <Tex>{String.raw`w_i = 1/(\sigma_i^2 + \hat{\tau}^2)`}</Tex>.
          No prior appears in this formula.
        </P>
        <P>
          That's why the hierarchical method is exposed next to
          method A (inverse-variance weighted by{" "}
          <Tex>{String.raw`n_{\text{points}}`}</Tex>): it serves as
          a <strong>control</strong>. If method A and the
          hierarchical method give numbers differing by more than{" "}
          <Tex>{String.raw`0.01\;\text{m}^2`}</Tex>, at least one of
          them is being pulled by an eccentric weight (typically a
          ride with very small <Tex>{String.raw`\sigma_i`}</Tex>{" "}
          dominating the hierarchical mean). The UI also shows{" "}
          <code>n_eff</code> for this diagnostic: if{" "}
          <Tex>{String.raw`n_{\text{eff}} \ll N`}</Tex>, the
          hierarchical result is dominated by a few rides —
          interpret with caution.
        </P>
      </Section>

      <Section title="In practice: what should you check?">
        <Note>
          <strong>The quick test.</strong> If you want to verify
          that your dataset is well calibrated, launch the same
          analysis twice from the UI — once with "Aero (drops)" and
          once with "Moderate (hoods)". Compare the "Mean CdA" of
          both runs. If it differs by less than{" "}
          <Tex>{String.raw`0.005\;\text{m}^2`}</Tex>, all good.
          Otherwise, look at the chip with a different{" "}
          <code>cda_raw</code> between the two runs (visible in the
          exclusion tooltip) — it's probably a convergence issue on
          that particular ride.
        </Note>
        <P>
          The hierarchical method remains your safety net: its{" "}
          <Tex>{String.raw`\mu`}</Tex> literally <em>never</em>{" "}
          moves with the prior, by construction. If method A moves
          and the hierarchical one doesn't, you know it's the
          Bayesian shrinkage talking, not a broken pipeline.
        </P>
      </Section>

      <Section title="References">
        <P>
          Gelman A, Carlin JB, Stern HS, Dunson DB, Vehtari A,
          Rubin DB. <em>Bayesian Data Analysis (3rd ed.)</em>. CRC
          Press, 2013. Chapter 2.4: "Sensitivity to choice of prior
          distribution".
        </P>
        <P>
          Branch MA, Coleman TF, Li Y. <em>A subspace, interior,
          and conjugate gradient method for large-scale
          bound-constrained minimization problems</em>. SIAM J. Sci.
          Comput. 1999. — The reference for{" "}
          <code>scipy.optimize.least_squares</code> in TRF mode,
          and the discussion of <code>ftol/xtol/gtol</code>{" "}
          tolerances.
        </P>
      </Section>
    </Article>
  );
}
