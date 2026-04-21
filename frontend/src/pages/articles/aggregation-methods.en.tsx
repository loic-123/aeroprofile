import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function AggregationMethodsEn() {
  return (
    <Article title="Multi-ride aggregation methods: inverse-variance vs hierarchical">
      <P>
        When you analyze several rides from the same rider, AeroProfile
        produces <Tex>{String.raw`N`}</Tex> estimates of{" "}
        <Tex>{String.raw`C_dA`}</Tex>, one per ride. The question is: which
        number to display as <em>"the rider's average CdA"</em>? A simple
        arithmetic mean is sub-optimal (not all rides are equal).
        AeroProfile implements <strong>two methods</strong>, computed in
        parallel, that you can compare.
      </P>

      <Section title="Why not just take the mean">
        <P>
          The <Tex>{String.raw`N`}</Tex> rides are not equivalent: a short
          ride in strong wind gives a far less reliable{" "}
          <Tex>{String.raw`C_dA`}</Tex> than a long ride in still air. An
          arithmetic mean{" "}
          <Tex>{String.raw`\bar{C}_dA = \frac{1}{N}\sum C_{dA,i}`}</Tex>{" "}
          gives both the same weight, which amplifies the error.
        </P>
        <P>
          Worse: <strong>the CdA prior biases the mean</strong>. If each
          ride returns a MAP estimate pulled toward{" "}
          <Tex>{String.raw`\mu_0`}</Tex> (the prior center), that
          shrinkage persists through the mean. On noisy rides, the gap
          between the <em>"Aero drops"</em> (0.30) and <em>"Relaxed
          tops"</em> (0.40) priors reached{" "}
          <Tex>{String.raw`0.044\;\text{m}^2`}</Tex> with a simple mean
          biased by priors. Conclusion: <strong>in multi-ride mode, the
          per-ride prior must be disabled</strong>, and regularization is
          provided by the aggregation itself.
        </P>
      </Section>

      <Section title="Method A — Inverse-variance aggregation (DerSimonian-Laird, fixed effects)">
        <P>
          This is the standard approach in meta-analysis. Each ride{" "}
          <Tex>{String.raw`i`}</Tex> returns its estimate{" "}
          <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> and standard deviation{" "}
          <Tex>{String.raw`\sigma_i`}</Tex>, computed from the solver's
          Hessian (Fisher information matrix at the MAP). The aggregated
          mean is weighted by inverse variance:
        </P>
        <Formula>{String.raw`\hat{C}_{dA,\text{agg}} = \frac{\sum_i w_i \hat{C}_{dA,i}}{\sum_i w_i}, \quad w_i = \frac{q_i}{\sigma_i^2}`}</Formula>
        <P>
          The factor <Tex>{String.raw`q_i`}</Tex> is an empirical quality
          coefficient based on the ride's nRMSE (rides where the model
          fits power less well count for less). Narrow-CI rides (peaked
          Hessian) dominate the mean; wide-CI rides (ambiguous data)
          contribute little.
        </P>
        <P>
          The <strong>aggregated confidence interval</strong> is computed
          with a <em>weighted variance</em> consistent with the mean:
        </P>
        <Formula>{String.raw`\hat{\sigma}^2_w = \frac{\sum_i w_i \bigl(\hat{C}_{dA,i} - \hat{C}_{dA,\text{agg}}\bigr)^2}{\sum_i w_i}, \quad \text{SE} = \frac{\hat{\sigma}_w}{\sqrt{N}}`}</Formula>
        <P>
          An earlier version used an <em>unweighted</em> variance (sum
          divided by <Tex>{String.raw`N`}</Tex> instead of{" "}
          <Tex>{String.raw`\sum w_i`}</Tex>). Methodological consequence:
          a short 100-point ride would weigh 0.01× a long 10 000-point
          ride in the mean but 1× in the CI — which overestimated
          uncertainty when weights were very uneven. The current version
          makes the CI consistent with the mean: a ride that counts for
          almost nothing in the mean also counts for almost nothing in
          the CI.
        </P>
        <P>
          <strong>Advantages:</strong> fast (just a weighted mean on the
          frontend), no new backend solver, transparent. It's the{" "}
          <em>default</em> method in AeroProfile.
        </P>
        <P>
          <strong>Limitation:</strong> assumes that the{" "}
          <Tex>{String.raw`N`}</Tex> rides sample <em>the same</em>{" "}
          quantity <Tex>{String.raw`C_dA`}</Tex>. But CdA can legitimately
          vary from ride to ride (rain jacket, slightly different
          position, fatigue). The inverse-variance model does not
          separate measurement variance from true inter-ride variance.
        </P>
      </Section>

      <Section title="Hierarchical method — Random-effects meta-analysis (DerSimonian–Laird)">
        <P>
          The hierarchical method explicitly treats inter-ride variation
          as a parameter to estimate. We assume:
        </P>
        <Formula>{String.raw`C_{dA,i} \sim \mathcal{N}(\mu,\; \tau^2),\quad \hat{C}_{dA,i} \sim \mathcal{N}(C_{dA,i},\; \sigma_i^2)`}</Formula>
        <P>
          where <Tex>{String.raw`\mu`}</Tex> is the rider's mean "true"
          CdA, <Tex>{String.raw`\tau`}</Tex> the inter-ride standard
          deviation (the variance in their CdA from ride to ride —
          fatigue, slightly different position, jacket, etc.), and{" "}
          <Tex>{String.raw`\sigma_i`}</Tex> the measurement uncertainty
          on the <Tex>{String.raw`i`}</Tex>-th ride (from the solver
          Hessian for that particular ride).
        </P>
        <P>
          This is the classic random-effects meta-analysis model,
          attributed to DerSimonian & Laird (1986). The closed form for{" "}
          <Tex>{String.raw`\tau^2`}</Tex> and <Tex>{String.raw`\mu`}</Tex>{" "}
          goes via <em>Cochran's Q</em>, a heterogeneity statistic
          computed from the fixed-effect mean and inverse-variance
          weights:
        </P>
        <Formula>{String.raw`w_i^{FE} = \frac{1}{\sigma_i^2},\quad \mu_{FE} = \frac{\sum_i w_i^{FE} \hat{C}_{dA,i}}{\sum_i w_i^{FE}}`}</Formula>
        <Formula>{String.raw`Q = \sum_{i=1}^{N} w_i^{FE}\,(\hat{C}_{dA,i} - \mu_{FE})^2`}</Formula>
        <Formula>{String.raw`\hat{\tau}^2 = \max\!\left(0,\; \frac{Q - (N - 1)}{\sum_i w_i^{FE} - \sum_i (w_i^{FE})^2 / \sum_i w_i^{FE}}\right)`}</Formula>
        <P>
          Once <Tex>{String.raw`\hat{\tau}^2`}</Tex> is known, the
          random-effects weights redistribute between "measurement
          uncertainty" and "true inter-ride variance":
        </P>
        <Formula>{String.raw`w_i^{RE} = \frac{1}{\sigma_i^2 + \hat{\tau}^2},\quad \hat{\mu} = \frac{\sum_i w_i^{RE} \hat{C}_{dA,i}}{\sum_i w_i^{RE}},\quad \text{SE}(\hat{\mu}) = \frac{1}{\sqrt{\sum_i w_i^{RE}}}`}</Formula>
        <P>
          The 95% CI on <Tex>{String.raw`\mu`}</Tex> is{" "}
          <Tex>{String.raw`\hat{\mu} \pm 1.96\,\text{SE}(\hat{\mu})`}</Tex>{" "}
          — distribution-free, no global Hessian, no nonlinear
          optimization over <Tex>{String.raw`\tau`}</Tex>.
        </P>
        <P>
          <strong>Advantages:</strong> closed form, fast, robust. Each
          ride is estimated independently (we reuse the existing single-ride
          Chung VE solver), and fusion is analytical. Heterogeneity is
          exposed via <Tex>{String.raw`\hat{\tau}`}</Tex> and the index{" "}
          <Tex>{String.raw`I^2 = \max(0, (Q - N + 1)/Q)`}</Tex> (0% =
          perfectly consistent rides, 100% = all variance is inter-ride).
        </P>
        <Warning>
          <strong>Historical bug fixed in 2026.</strong> An earlier
          version implemented the hierarchical method as a <em>joint
          MLE</em> over{" "}
          <Tex>{String.raw`(\mu, \log\tau, C_{rr}, C_{dA,1}, \ldots, C_{dA,N})`}</Tex>{" "}
          via <code>scipy.optimize.least_squares</code>. The residual
          function passed <Tex>{String.raw`(C_{dA,i} - \mu) / \tau`}</Tex>,
          which gives the quadratic term of the Gaussian
          log-likelihood{" "}
          <Tex>{String.raw`\sum_i (C_{dA,i} - \mu)^2 / \tau^2`}</Tex> —
          but the normalization term{" "}
          <Tex>{String.raw`N \log \tau`}</Tex> of the true negative
          log-likelihood was missing. Without it, the solver could make
          the cost arbitrarily small by increasing{" "}
          <Tex>{String.raw`\tau`}</Tex>, so{" "}
          <Tex>{String.raw`\tau^\star = +\infty`}</Tex> and the solution
          would systematically land on the upper bound. Raising the cap
          from 0.20 to 0.40 changed nothing: the bug was structural, not
          a bound issue. Switching to DerSimonian-Laird entirely
          eliminates the problem by avoiding nonlinear optimization on{" "}
          <Tex>{String.raw`\tau`}</Tex>.
        </Warning>
        <P>
          <strong>HKSJ correction for n&lt;10.</strong> Between 2 and 9
          rides, the asymptotic 95% CI{" "}
          <Tex>{String.raw`\mu \pm 1.96 \cdot \text{SE}`}</Tex> undercovers
          the true μ because (a) Cochran's Q lacks degrees of freedom for{" "}
          <Tex>{String.raw`\hat{\tau}^2`}</Tex> to be well-estimated and
          (b) the normal quantile 1.96 is too narrow for small samples.
          AeroProfile automatically applies the{" "}
          <strong>Hartung–Knapp–Sidik–Jonkman</strong> adjustment:
        </P>
        <Formula>{String.raw`q = \frac{1}{k-1}\;\frac{\sum_i w_i^{RE}\,(C_{dA,i} - \hat{\mu})^2}{\sum_i w_i^{RE}}`}</Formula>
        <Formula>{String.raw`\text{SE}_{\text{HKSJ}} = \text{SE}_{\text{DL}} \cdot \sqrt{\max(q, 1)},\quad \text{95\% CI} = \hat{\mu} \pm t_{0.975, k-1} \cdot \text{SE}_{\text{HKSJ}}`}</Formula>
        <P>
          The Student quantile <Tex>{String.raw`t_{0.975, k-1}`}</Tex>{" "}
          replaces 1.96 (≈ 3.18 for k=4, ≈ 2.26 for k=10, then converges
          to 1.96). The factor <Tex>{String.raw`q`}</Tex> reinjects the
          empirical dispersion of CdA_i. Ref. IntHout, Ioannidis & Borm,
          <em> BMC Med Res Methodol</em> 14:25 (2014). The UI shows an
          <code>HKSJ small-k</code> badge next to the block title when
          the correction is active, so the user knows the exposed 95% CI
          is widened.
        </P>
        <P>
          <strong>Minimum gate n≥2.</strong> Below 2 rides there is
          simply nothing to aggregate, and the{" "}
          <code>/analyze-batch</code> endpoint returns a 422. Above 2,
          HKSJ handles small-k up to n=9, then auto-disables for n≥10
          (the t-quantile converges to normal).
        </P>
        <P>
          <strong>σ_i floor ≥ 0.010.</strong> Each ride's σ_i (from the
          Chung VE fit Hessian) is floored at 0.010 m². Without this
          floor, a ride with numerically very small σ_i (say 0.003)
          would capture{" "}
          <Tex>{String.raw`(0.010/0.003)^2 \approx 11`}</Tex>× more
          weight than the average — an absurd result dominated by a
          single ride. The 0.010 floor limits this ratio to{" "}
          <Tex>{String.raw`\sim 4`}</Tex>×.
        </P>
        <P>
          <strong>n_eff.</strong> The UI displays{" "}
          <Tex>{String.raw`n_{\text{eff}} = (\sum_i w_i^{RE})^2 / \sum_i (w_i^{RE})^2`}</Tex>{" "}
          next to the nominal ride count. If{" "}
          <Tex>{String.raw`n_{\text{eff}} \ll N`}</Tex>, one or two rides
          dominate the mean — the estimate remains valid but the 95% CI
          is tighter than it would be with a homogeneous dataset.
        </P>
      </Section>

      <Section title="Comparison on a noisy dataset (4iiii single-sided, 30 rides)">
        <P>
          On 30 rides from the same rider with a noisy sensor (nRMSE
          35–46%), we compare the aggregated{" "}
          <Tex>{String.raw`C_dA`}</Tex> gap depending on the user's
          chosen prior (before and after the fixes):
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Configuration</th>
                <th className="py-2">Δ CdA (drops vs tops)</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5">Before: active prior + RMSE weight bug</td>
                <td className="text-coral">0.044 m²</td>
                <td className="font-sans text-coral">Unacceptable</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">After: prior weight fixed</td>
                <td>≈ 0.020 m²</td>
                <td className="font-sans text-muted">Still biased (shrinkage)</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Method A (inverse-variance, no prior)</td>
                <td className="text-teal">0.0001 m²</td>
                <td className="font-sans text-teal">440× less biased</td>
              </tr>
              <tr>
                <td className="py-1.5">Hierarchical method (DerSimonian–Laird)</td>
                <td className="text-teal">0.0000 m²</td>
                <td className="font-sans text-teal">Prior-independent by construction</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          Methods A (inverse-variance) and hierarchical converge to the
          same number within{" "}
          <Tex>{String.raw`\sim 0.005\;\text{m}^2`}</Tex> on most
          datasets. The hierarchical method is useful mostly as a{" "}
          <strong>consistency check</strong> and to estimate the
          inter-ride variance <Tex>{String.raw`\tau`}</Tex> — an
          interesting physical signal in itself (a rider with a high{" "}
          <Tex>{String.raw`\tau`}</Tex> has a less reproducible
          position).
        </Note>
      </Section>

      <Section title="Which method to use?">
        <P>
          Method A (inverse-variance) is <strong>on by default</strong>{" "}
          everywhere (multi-file Analyze, Compare, Intervals.icu). It's
          fast, rigorous enough for the general case, and its
          interpretation is intuitive.
        </P>
        <P>
          The hierarchical method runs <strong>in parallel</strong> in
          all these modes <strong>as soon as there are at least 10 valid
          rides</strong>, and its result (<Tex>{String.raw`\mu`}</Tex>{" "}
          and <Tex>{String.raw`\tau`}</Tex>) is displayed next to
          method A. Below that threshold the hierarchical method is
          disabled with an explicit message (see previous section). If
          the two methods diverge by{" "}
          <Tex>{String.raw`> 0.01\;\text{m}^2`}</Tex>, it's a signal:
          likely a very noisy ride is pulling the A mean, or inter-ride
          variation is large enough that the two approaches give
          different estimates.
        </P>
      </Section>

      <Section title="References">
        <P>
          DerSimonian R, Laird N. <em>Meta-analysis in clinical trials.</em>{" "}
          Controlled Clinical Trials, 1986. — The foundational paper for
          the random-effects meta-analysis model.
        </P>
        <P>
          Gelman A, Carlin JB, Stern HS, Dunson DB, Vehtari A, Rubin DB.{" "}
          <em>Bayesian Data Analysis (3rd ed.)</em>. CRC Press, 2013.
          Chapter 5: hierarchical models. Chapter 14: regression and
          priors.
        </P>
        <P>
          Bishop CM. <em>Pattern Recognition and Machine Learning</em>.
          Springer, 2006. §3.3 on MAP estimation and Bayesian
          regularization.
        </P>
      </Section>
    </Article>
  );
}
