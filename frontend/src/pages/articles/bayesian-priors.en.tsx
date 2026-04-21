import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function BayesianPriorsEn() {
  return (
    <Article title="Bayesian priors: how to stabilize the solver">
      <P>
        When the data is good (varied ride, light wind, calibrated sensor),
        the solver finds <Tex>{String.raw`C_dA`}</Tex> and{" "}
        <Tex>{String.raw`C_{rr}`}</Tex> without help. But when the data is
        poor (short ride, strong poorly-estimated wind, drafting), the
        solver can "diverge" toward absurd values. Bayesian priors are a
        mathematical safety net.
      </P>

      <Section title="The intuition: a gentle expert opinion">
        <P>
          A prior is an initial belief. Before seeing your data, we
          "believe" that your <Tex>{String.raw`C_dA`}</Tex> is probably
          around 0.30 (typical road position) and your{" "}
          <Tex>{String.raw`C_{rr}`}</Tex> around 0.0035 (tubeless road tire
          on asphalt). The more abundant and consistent the data, the less
          the prior matters. The noisier the data, the more the prior
          weighs.
        </P>
        <P>
          It's like asking an expert: "from your experience, what{" "}
          <Tex>{String.raw`C_dA`}</Tex> would you expect for a road
          cyclist?" The expert says{" "}
          <Tex>{String.raw`0.32 \pm 0.08`}</Tex>. For a TT bike they'd say{" "}
          <Tex>{String.raw`0.22 \pm 0.05`}</Tex>. If your data clearly says
          0.35, we keep 0.35. If your data is contradictory and confused,
          we keep something near the center of the prior for your bike
          type.
        </P>
      </Section>

      <Section title="Mathematical formulation">
        <P>
          The solver minimizes a sum of squared residuals (nonlinear least
          squares). Without a prior, the objective function is simply:
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{data}} = \sum_{i=1}^{N} \bigl( P_{\text{model}}(i) - P_{\text{measured}}(i) \bigr)^2`}</Formula>
        <P>
          A Gaussian prior adds a quadratic penalty for each parameter.
          This corresponds exactly to MAP (Maximum A Posteriori) estimation
          under Gaussian priors and Gaussian noise:
        </P>
        <Formula>{String.raw`\mathcal{L}_{\text{MAP}} = \sum_{i=1}^{N} \bigl( P_{\text{model}}(i) - P_{\text{measured}}(i) \bigr)^2 + w \cdot \left(\frac{C_{rr} - \mu_{C_{rr}}}{\sigma_{C_{rr}}}\right)^{\!2} + w \cdot \left(\frac{C_dA - \mu_{C_dA}}{\sigma_{C_dA}}\right)^{\!2}`}</Formula>
        <P>
          where <Tex>{String.raw`w`}</Tex> is the prior weight, calibrated
          so that it weighs like roughly 3 good data points. The{" "}
          <Tex>{String.raw`w`}</Tex> term is adaptive: it's proportional
          to <Tex>{String.raw`\sqrt{N}`}</Tex> and to the residual RMSE,
          so the prior weighs relatively less when the data is abundant.
        </P>
        <P>
          The further <Tex>{String.raw`C_dA`}</Tex> drifts from{" "}
          <Tex>{String.raw`\mu = 0.30`}</Tex>, the more the prior term
          penalizes the solution. But since{" "}
          <Tex>{String.raw`\sigma = 0.12`}</Tex> is broad, the penalty is
          very small in the normal range (0.20 to 0.45). It only becomes
          significant at extreme values (<Tex>{String.raw`C_dA < 0.15`}</Tex>{" "}
          or <Tex>{String.raw`C_dA > 0.60`}</Tex>).
        </P>
      </Section>

      <Section title="Why it's MAP">
        <P>
          In Bayesian inference, Bayes' theorem gives:
        </P>
        <Formula>{String.raw`p(\theta \mid \text{data}) \propto p(\text{data} \mid \theta) \cdot p(\theta)`}</Formula>
        <P>
          With a Gaussian noise model,{" "}
          <Tex>{String.raw`-\ln p(\text{data} \mid \theta)`}</Tex> is
          proportional to the sum of squared residuals. With a Gaussian
          prior{" "}
          <Tex>{String.raw`\theta \sim \mathcal{N}(\mu, \sigma^2)`}</Tex>,{" "}
          <Tex>{String.raw`-\ln p(\theta)`}</Tex> is proportional to{" "}
          <Tex>{String.raw`(\theta - \mu)^2 / \sigma^2`}</Tex>. Maximizing
          the posterior (MAP) thus amounts exactly to minimizing{" "}
          <Tex>{String.raw`\mathcal{L}_{\text{MAP}}`}</Tex>. It's Tikhonov
          regularization with a probabilistic interpretation.
        </P>
      </Section>

      <Section title="AeroProfile's priors">
        <P>
          The priors on <Tex>{String.raw`C_{rr}`}</Tex> and wind are fixed:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Parameter</th>
                <th className="py-2">Distribution</th>
                <th className="py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-mono"><Tex>{String.raw`C_{rr}`}</Tex></td>
                <td><Tex>{String.raw`\mathcal{N}(0.0035,\; 0.0012^2)`}</Tex></td>
                <td className="text-muted">Prevents <Tex>{String.raw`C_{rr}`}</Tex> from absorbing wind errors</td>
              </tr>
              <tr>
                <td className="py-1.5 font-mono">Wind</td>
                <td><Tex>{String.raw`\mathcal{N}(V_{\text{API}},\; 2^2)`}</Tex></td>
                <td className="text-muted">Lets wind depart from the API by ±4 m/s</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          The <Tex>{String.raw`C_{rr}`}</Tex> prior was lowered from{" "}
          <Tex>{String.raw`\mathcal{N}(0.004,\; 0.0015^2)`}</Tex> to{" "}
          <Tex>{String.raw`\mathcal{N}(0.0035,\; 0.0012^2)`}</Tex> to
          better match recent measurements on tubeless tires (Silca 2023,
          BRR 2024).
        </Note>
      </Section>

      <Section title="Bike-type-dependent CdA prior">
        <P>
          Unlike <Tex>{String.raw`C_{rr}`}</Tex>, the prior on{" "}
          <Tex>{String.raw`C_dA`}</Tex> <strong>depends on the bike
          type</strong> selected by the user. A TT-position rider has a
          very different expected{" "}
          <Tex>{String.raw`C_dA`}</Tex> than a mountain biker. Using the
          same prior for both would be sub-optimal: too wide for TT (narrow
          range), too centered for MTB.
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Bike type</th>
                <th className="py-2">Prior <Tex>{String.raw`C_dA`}</Tex></th>
                <th className="py-2">Solver bounds</th>
                <th className="py-2">Typical positions</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans"><strong>Road</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.32,\; 0.08^2)`}</Tex></td>
                <td>[0.20, 0.55]</td>
                <td className="font-sans text-muted">Drops → tops</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 font-sans"><strong>TT / Triathlon</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.22,\; 0.05^2)`}</Tex></td>
                <td>[0.15, 0.35]</td>
                <td className="font-sans text-muted">Extensions → aero hoods</td>
              </tr>
              <tr>
                <td className="py-1.5 font-sans"><strong>MTB / Gravel</strong></td>
                <td><Tex>{String.raw`\mathcal{N}(0.45,\; 0.08^2)`}</Tex></td>
                <td>[0.30, 0.65]</td>
                <td className="font-sans text-muted">Upright position, wide tires</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          The TT prior is tighter (<Tex>{String.raw`\sigma = 0.05`}</Tex>)
          because the <Tex>{String.raw`C_dA`}</Tex> range in aero position
          is narrow (0.17–0.30). Road and MTB priors are wider
          (<Tex>{String.raw`\sigma = 0.08`}</Tex>) since positions vary
          more.
        </P>
        <P>
          This prior applies to <strong>all three solvers</strong>
          (Martin LS, Chung VE, Wind-Inverse) and also influences the
          solver bounds and multi-start seed points. The result: the solver
          converges faster into the right zone and won't give{" "}
          <Tex>{String.raw`C_dA = 0.50`}</Tex> for a TT nor{" "}
          <Tex>{String.raw`C_dA = 0.20`}</Tex> for an MTB.
        </P>
      </Section>

      <Section title="Sensitivity and adaptive prior weight">
        <P>
          The prior weight in the objective is:
        </P>
        <Formula>{String.raw`w_{\text{eff}} = 0.3 \cdot \sqrt{N} \cdot \max\!\left(1,\; \frac{\sigma_{\text{Hess}}}{\sigma_{\text{prior}}}\right)`}</Formula>
        <P>
          The adaptive factor{" "}
          <Tex>{String.raw`\max(1,\sigma_{\text{Hess}}/\sigma_{\text{prior}})`}</Tex>{" "}
          implements the standard Bayesian intuition: when the data is
          informative (<Tex>{String.raw`\sigma_{\text{Hess}} \leq \sigma_{\text{prior}}`}</Tex>),
          the factor is 1 and the prior acts as a soft stabilizer. When the
          data is noisy or uninformative{" "}
          (<Tex>{String.raw`\sigma_{\text{Hess}} \gg \sigma_{\text{prior}}`}</Tex>),
          the prior rises proportionally to keep the solver from chasing
          noise and hitting physical bounds. It's adaptive shrinkage in the
          James–Stein / adaptive ridge style.
        </P>
        <P>
          The chicken-and-egg problem —{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> is only known after
          optimization — is resolved with a two-pass strategy:
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li><strong>Pass 1</strong>: solver with base weight{" "}
          <Tex>{String.raw`0.3\sqrt{N}`}</Tex>, we extract{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> from the Hessian.</li>
          <li><strong>Pass 2</strong> (conditional): if the ratio exceeds 1,
          we rerun the solver with the reinforced weight. Otherwise we keep
          pass 1.</li>
        </ol>
        <P>
          An <strong>additional pass 0</strong> (<Tex>{String.raw`w_{\text{CdA}}=0`}</Tex>)
          runs upstream to expose <em>CdA without prior</em> in the UI — the
          user can explicitly see how much the CdA prior shifted the
          estimate. Be careful not to read &laquo; pure MLE &raquo; into
          this number: the wind prior (pulling the fitted wind field toward
          Open-Meteo) and the Crr prior (pulling toward 0.0035) remain
          active at their base weight. Disabling them too would make the
          problem underdetermined — wind_inverse has 150+ free wind
          parameters against ~3000 altitude residuals, so without
          regularization the solver finds an infinite family of (wind, CdA)
          equivalents and the returned point becomes random. Pass 0 is
          therefore a <strong>conditional MLE</strong>: CdA free, wind and
          Crr softly regularized.
        </P>
        <P>
          Second essential pass-2 safeguard: the adaptive factor is
          <strong>capped at 3.0</strong>. If
          <Tex>{String.raw`\sigma_{\text{Hess}}/\sigma_{\text{prior}} > 3`}</Tex>,
          the ride is effectively non-identifiable and must be marked as
          such by the quality gate (<code>non_identifiable</code> status),
          not &laquo; saved &raquo; by a prior crushing 10× the likelihood.
          Without this cap, on a ride with{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}} \approx 0.5`}</Tex>, the
          factor would climb to ~6 and the MAP would essentially be{" "}
          <Tex>{String.raw`\mu_0`}</Tex> with{" "}
          <Tex>{String.raw`\pm \epsilon`}</Tex> — giving the illusion of a
          result when the prior did all the work.
        </P>
        <Formula>{String.raw`w_{\text{eff,base}} = 0.3 \cdot \sqrt{N}`}</Formula>
        <P>
          The <Tex>{String.raw`\sqrt{N}`}</Tex> factor guarantees that with
          lots of data the prior weighs relatively <em>less</em> (the
          residual sum grows in <Tex>{String.raw`N`}</Tex>, the prior in{" "}
          <Tex>{String.raw`\sqrt{N}`}</Tex>).
        </P>
        <Warning>
          <strong>April 2026 fix.</strong> The old formula was{" "}
          <Tex>{String.raw`w_{\text{eff}} = 0.3\sqrt{N}\cdot\max(1,\text{RMSE})`}</Tex>:
          it <em>multiplied</em> the weight by the RMSE, so the prior
          weighed <strong>more</strong> when the data was noisy. That's
          the opposite of standard Bayesian formalism: with noisy data,
          the likelihood is mechanically flatter, and the prior already
          dominates the posterior naturally without needing to raise its
          weight. The RMSE factor conflated Tikhonov regularization (where
          <Tex>{String.raw`\lambda`}</Tex> is a free hyperparameter) and a
          Bayesian prior (where the weight comes directly from{" "}
          <Tex>{String.raw`1/\sigma^2`}</Tex>). On 30 noisy rides from our
          test dataset, the bug created a gap of{" "}
          <Tex>{String.raw`\Delta C_dA = 0.044`}</Tex> depending on the
          prior chosen by the user; after the fix the gap drops to{" "}
          <Tex>{String.raw`\Delta C_dA \approx 0.0001`}</Tex> (440× less).
          Ref. Gelman BDA3 ch. 14, Bishop PRML §3.3.
        </Warning>
      </Section>

      <Section title="The multi-ride prior trap and its solution">
        <P>
          Applying a prior per ride creates a multi-ride specific problem:
          <strong> the shrinkage is systematic</strong>. Each ride{" "}
          <Tex>{String.raw`i`}</Tex> returns a MAP estimate{" "}
          <Tex>{String.raw`\hat{C}_{dA,i}`}</Tex> pulled slightly toward
          the prior center <Tex>{String.raw`\mu_0`}</Tex>. Averaging{" "}
          <Tex>{String.raw`N`}</Tex> rides doesn't save us — the bias
          persists, since it isn't stochastic.
        </P>
        <P>
          An earlier version of the pipeline <em>completely
          disabled</em> the CdA prior as soon as more than one ride was
          analyzed. This fix was blunt and broke two things: (1)
          individually weak rides (straight climb, little speed variety)
          would then hit the physical bounds and get excluded; (2)
          changing the position in the selector had no effect at all,
          misleading the user.
        </P>
        <P>
          The real fix combines two independent mechanisms:
        </P>
        <ol className="list-decimal pl-5 text-sm leading-relaxed my-2">
          <li>
            <strong>Adaptive prior</strong> capped at 3.0 (described
            above): on well-constrained rides the factor is 1 and
            shrinkage is negligible; on noisy rides the prior rises but
            stays bounded.
          </li>
          <li>
            <strong>Hierarchical method (DerSimonian–Laird)</strong>:
            instead of estimating each ride independently and averaging,
            we estimate <Tex>{String.raw`\hat{\tau}^2`}</Tex> in closed
            form from Cochran's Q, then combine the{" "}
            <Tex>{String.raw`C_{dA,i}`}</Tex> with random-effects weights{" "}
            <Tex>{String.raw`w_i = 1/(\sigma_i^2 + \hat{\tau}^2)`}</Tex>.
            The prior on <Tex>{String.raw`\mu`}</Tex> is learned from the
            data, not imposed. See the{" "}
            <em>Multi-ride aggregation methods</em> article.
          </li>
        </ol>
        <P>
          Measured result on a 4iiii test dataset (30 noisy rides): the
          gap between &quot;Aero drops&quot; and &quot;Relaxed tops&quot;
          priors drops from{" "}
          <Tex>{String.raw`\Delta C_dA = 0.044\;\text{m}^2`}</Tex> to{" "}
          <Tex>{String.raw`\Delta C_dA \approx 0.0001`}</Tex> (440× less).
        </P>
      </Section>

      <Section title="Measured impact and confidence intervals">
        <P>
          On well-constrained rides (varied speeds, diverse heading), the
          prior moves <Tex>{String.raw`C_dA`}</Tex> by{" "}
          <Tex>{String.raw`< 0.005\;\text{m}^2`}</Tex> — invisible. On
          poorly-constrained rides (2-hour straight climb), the prior can
          shift <Tex>{String.raw`C_dA`}</Tex> by{" "}
          <Tex>{String.raw`\sim 0.03\;\text{m}^2`}</Tex> toward{" "}
          <Tex>{String.raw`\mu_0`}</Tex>, which avoids an absurd result.
          When that gap exceeds 0.05 m², the ride is flagged{" "}
          <code>prior_dominated</code> and the user sees a warning badge.
        </P>
        <P>
          <strong>CIs are computed from the complete Hessian</strong> —
          i.e. including the <em>data</em> AND <em>prior</em> residual
          rows. The posterior Hessian is the sum of data and prior
          Hessians, so the Laplace approximation requires both. An earlier
          version excluded the prior rows thinking the CI would reflect
          &laquo; data-only uncertainty &raquo;, but this was an error:
          in adaptive pass 2 the prior weighed heavily but wasn't included
          in the curvature, which overestimated{" "}
          <Tex>{String.raw`\sigma_{\text{Hess}}`}</Tex> and triggered
          superfluous pass 2s. The fix (including prior rows) now gives
          the correct posterior uncertainty.
        </P>
      </Section>

      <Section title="References">
        <P>
          The formulation is MAP (Maximum A Posteriori), a special case of
          Bayesian inference with Gaussian priors, also known as Tikhonov
          regularization in optimization. Reference values come from
          Debraux et al. (2011) for <Tex>{String.raw`C_dA`}</Tex> and Lim,
          Homan &amp; Dalbert (2011) for the Bayesian approach applied to
          cycling performance parameter estimation.
        </P>
      </Section>
    </Article>
  );
}
