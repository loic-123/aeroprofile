import { Article, Section, Formula, Tex, Note, Warning, P } from "../../components/BlogLayout";

export default function IterativeRefinementEn() {
  return (
    <Article title="Hybrid iterative refinement: only use points where the model works">
      <P>
        When you look at the "Actual vs virtual altitude" chart, the two
        curves are often close at the start and then diverge on certain
        segments. Those divergence segments are where the physical model
        is wrong — bad wind, undetected drafting, invisible braking, or
        any other unmodeled factor.
      </P>
      <P>
        The idea is simple: <strong>if the model is visibly wrong
        somewhere, we shouldn't use those points to estimate CdA</strong>.
        We only keep segments where model and reality agree. But
        detecting "where the model is wrong" is non-trivial: an absolute
        offset alone isn't enough, and a drift rate alone isn't either.
        AeroProfile uses a <strong>hybrid two-criterion approach</strong>{" "}
        that combines both signals for robust detection.
      </P>

      <Section title="The circularity problem">
        <P>
          To compute virtual altitude, we need{" "}
          <Tex>{String.raw`C_dA`}</Tex> and <Tex>{String.raw`C_{rr}`}</Tex>.
          But to know <Tex>{String.raw`C_dA`}</Tex> and{" "}
          <Tex>{String.raw`C_{rr}`}</Tex>, we have to solve the model.
          Chicken and egg. We can't exclude "bad points" before having a
          first result.
        </P>
        <P>
          Solution: a <strong>two-pass approach</strong>. Pass 1 solves
          the model on all valid points. Then we identify divergence
          zones using pass 1's results. Pass 2 re-solves excluding those
          zones.
        </P>
      </Section>

      <Section title="Pass 1: initial estimation">
        <P>
          We solve <Tex>{String.raw`C_dA`}</Tex> and{" "}
          <Tex>{String.raw`C_{rr}`}</Tex> on all valid points (after
          speed, power, acceleration filters, etc.). We get a first
          estimate:
        </P>
        <Formula>
          {String.raw`\text{Pass 1} : \quad (C_dA_1,\; C_{rr,1}) = \arg\min \sum_i \left( P_{\text{model}}(i) - P_{\text{measured}}(i) \right)^2`}
        </Formula>
        <P>
          With these values, we compute the virtual altitude (VE) over
          the full route. The drift between virtual and actual altitude
          reveals zones where the model is off:
        </P>
        <Formula>
          {String.raw`\text{drift}(t) = \text{alt}_{\text{virtual}}(t) - \text{alt}_{\text{actual}}(t)`}
        </Formula>
      </Section>

      <Section title="Smoothing before differentiation">
        <P>
          Before computing the derivative of the drift, we apply a{" "}
          <strong>30-second moving average</strong> on the raw drift
          signal. This is essential to avoid amplifying noise during
          differentiation.
        </P>
        <Formula>
          {String.raw`\text{drift}_{\text{smoothed}}(t) = \frac{1}{30} \sum_{\tau = t-15}^{t+15} \text{drift}(\tau)`}
        </Formula>
        <P>
          Without this smoothing, the numerical derivative{" "}
          <Tex>{String.raw`\Delta \text{drift} / \Delta t`}</Tex> would
          be dominated by GPS and barometer noise, producing false
          positives everywhere. Pre-smoothing acts as a low-pass filter:
          it removes fast fluctuations (noise) and keeps only
          significant trends (real model divergence).
        </P>
      </Section>

      <Section title="Criterion 1: drift rate (active divergence)">
        <P>
          The first criterion detects zones where the model is actively
          diverging. We compute the time derivative of the smoothed
          drift, then smooth it again over 60 seconds:
        </P>
        <Formula>
          {String.raw`r(t) = \left\langle \left| \frac{d(\text{drift}_{\text{smoothed}})}{dt} \right| \right\rangle_{60\text{s}}`}
        </Formula>
        <P>
          This rate is compared to an adaptive threshold that depends on
          the ride profile:
        </P>
        <Formula>
          {String.raw`\text{rate\_threshold} = \max\!\left(0.10 \;\text{m/s},\;\; \frac{D^{+}}{\text{duration}} \times 4 \right)`}
        </Formula>
        <P>
          The logic: <Tex>{String.raw`D^{+} / \text{duration}`}</Tex> is
          the ride's average rate of elevation gain. Multiplying by 4
          sets a threshold proportional to the route's natural "vertical
          speed". The 0.10 m/s floor guarantees a minimum threshold for
          very flat rides.
        </P>
        <P>
          <strong>What it catches:</strong> drafting (the model
          overestimates aero power, virtual altitude rises too fast),
          sudden wind shifts (the wind correction becomes wrong), and
          invisible braking (the model doesn't know you're braking).
          These phenomena cause fast divergence — the drift rate catches
          them immediately.
        </P>
      </Section>

      <Section title="Criterion 2: detrended drift (safety net)">
        <P>
          The second criterion looks not at raw drift but at the drift{" "}
          <strong>after subtracting its linear trend</strong>. Why?
          After a 2-minute drafting episode, the drift jumps +30 m then
          stays stable. Raw drift stays at +30 m for the rest of the
          ride — an absolute threshold would exclude everything that
          follows, even though the model works fine there.
        </P>
        <P>
          Subtracting the linear trend (least-squares fit on smoothed
          drift) keeps only <strong>local deviations</strong>:
        </P>
        <Formula>
          {String.raw`\delta(t) = \left\langle \left| \Delta h_{\text{smoothed}}(t) - \text{trend}(t) \right| \right\rangle_{60\text{s}}`}
        </Formula>
        <Formula>
          {String.raw`\text{trend}(t) = a \cdot t + b \quad \text{(linear regression on } \Delta h_{\text{smoothed}} \text{)}`}
        </Formula>
        <P>
          The threshold is proportional to the total climbing:
        </P>
        <Formula>
          {String.raw`\text{detrend\_threshold} = \max\!\left(40 \;\text{m},\;\; D^{+} \times 8\% \right)`}
        </Formula>
        <P>
          <strong>What it catches:</strong> segments where the model
          diverges locally in an abnormal way, even if the global drift
          is constant. A constant offset (CdA bias, global wind bias)
          is absorbed by the linear trend and does not trigger
          exclusion. Only real local problems (drafting, braking, sharp
          wind change) are detected.
        </P>
      </Section>

      <Section title="Why two criteria are needed">
        <P>
          Neither drift rate alone nor detrended drift alone is
          sufficient:
        </P>
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li>
            <strong>Rate alone:</strong> misses slow systematic errors.
            On a 40-minute climb with a slightly underestimated wind,
            drift rate stays at 0.05 m/s (below threshold) but the
            detrended gap eventually exceeds its threshold as the drift
            pulls away from the local linear trend.
          </li>
          <li>
            <strong>Detrended alone:</strong> misses very short, intense
            problems. 20 seconds of drafting causes a huge drift rate
            (0.5 m/s) but the detrended gap can stay small if the
            linear trend adapts to the jump.
          </li>
        </ul>
        <P>
          The hybrid approach combines both: a point is excluded if{" "}
          <strong>either OR the other</strong> criterion exceeds its
          threshold:
        </P>
        <Formula>
          {String.raw`\text{excluded}(t) = \bigl( r(t) > \text{rate\_threshold} \bigr) \;\lor\; \bigl( \delta(t) > \text{detrend\_threshold} \bigr)`}
        </Formula>
      </Section>

      <Section title="The 30% rule: knowing when not to refine">
        <P>
          If more than 30% of valid points would be excluded by the
          above criteria, refinement is <strong>cancelled
          entirely</strong>. We keep the pass 1 result.
        </P>
        <Formula>
          {String.raw`\frac{N_{\text{excluded}}}{N_{\text{valid pass 1}}} > 0.30 \implies \text{no pass 2}`}
        </Formula>
        <P>
          The intuition: if the model diverges over more than a third
          of the route, the problem isn't local — the model itself is
          globally unsuitable (completely wrong wind, offset power
          meter, wrong mass). Cutting 30%+ of the data would only bias
          the result by keeping only the segments where errors
          accidentally cancel out. Better to keep all the data and
          accept imprecision.
        </P>
        <Warning>
          Without this safeguard, refinement could massively exclude
          climbs and keep only descents (or the opposite), yielding a
          biased <Tex>{String.raw`C_dA`}</Tex> that represents only a
          fraction of the route.
        </Warning>
      </Section>

      <Section title="Pass 2: re-estimation on reliable points">
        <P>
          If conditions are met (at least 20 points excluded, at least
          100 points remaining, and less than 30% exclusion), pass 2
          re-solves the model on the remaining points:
        </P>
        <Formula>
          {String.raw`\text{Pass 2} : \quad (C_dA_2,\; C_{rr,2}) = \arg\min \sum_{i \,\notin\, \text{excluded}} \left( P_{\text{model}}(i) - P_{\text{measured}}(i) \right)^2`}
        </Formula>
        <P>
          The virtual altitude is recomputed with the new parameters{" "}
          <Tex>{String.raw`(C_dA_2,\; C_{rr,2})`}</Tex>. The final
          chart shows excluded zones in grey, which lets you visually
          confirm that the exclusions are relevant.
        </P>
      </Section>

      <Section title="Pass 2 acceptance control">
        <P>
          The logic so far implicitly assumes pass 2 ≤ pass 1 in error:
          we remove &laquo; dirty &raquo; points so the fit on the
          remaining points should be at least as good. But this is not
          always true. Removing points can reduce the wind constraint
          (wind_inverse has 150+ free wind parameters) enough that the
          solver drifts to a local minimum. In the original version,
          the code <em>blindly</em> accepted the pass 2 result as long
          as it was in the physical interval
          <Tex>{String.raw`[C_{dA,\min},\, C_{dA,\max}]`}</Tex> —
          including right on the bounds.
        </P>
        <Warning>
          A real bug observed on 3 rides from a Favero run (50 rides):
          pass 1 converged to <Tex>{String.raw`C_dA = 0.340`}</Tex>{" "}
          with <Tex>{String.raw`R^2 = 0.96`}</Tex>, and pass 2 on the
          subset drifted to <Tex>{String.raw`C_dA = 0.220`}</Tex>,
          right on the lower bound. The result was silently replaced
          and the ride ended up as <code>bound_hit</code> — while the
          real estimate (pass 1) was perfectly valid. 55–70% of rides
          go through pass 2 in real runs: the bug potentially affected
          a significant fraction of the dataset.
        </Warning>
        <P>
          Since then, the pass 2 result is accepted only if{" "}
          <strong>both of the following criteria hold</strong>:
        </P>
        <ol className="list-decimal ml-6 space-y-2 text-text">
          <li>
            <strong>No new bound hit.</strong> If pass 1 was not on the
            bound and pass 2 lands within 0.005 m² of a physical bound,
            the result is rejected. Rationale: pass 2 is supposed to
            refine, not introduce a new pathological case.
          </li>
          <li>
            <strong>No R² regression.</strong> If{" "}
            <Tex>{String.raw`R^2_{\text{pass 2}} < R^2_{\text{pass 1}} - 0.05`}</Tex>,
            we also reject. Rationale: removing points decreases the
            denominator, so R² should at worst remain stable. If it
            drops, the removed points were actually informative and
            not really &laquo; dirty &raquo;.
          </li>
        </ol>
        <P>
          If either criterion fails, the pipeline logs{" "}
          <code>VE PASS2 rejected: &lt;reason&gt;</code> and keeps the
          pass 1 result. If both pass, it logs{" "}
          <code>VE PASS2 accepted: CdA X.XXX → Y.YYY | R² a.aa → b.bb</code>{" "}
          so the post-mortem is traceable without re-running the
          analysis.
        </P>
        <Note>
          <strong>Open methodological question.</strong> These two
          safeguards only guarantee that pass 2 can't do{" "}
          <em>worse</em> than pass 1 on two measurable criteria. But
          between two values that pass the tests — say pass 1 = 0.325
          with R² = 0.92 and pass 2 = 0.310 with R² = 0.91 — nothing
          proves 0.310 is closer to the truth. Without ground truth
          (wind tunnel, Notio), we can't arbitrate. Exhaustive logging
          lets us diagnose a posteriori the distribution of deltas{" "}
          <Tex>{String.raw`|C_{dA,2} - C_{dA,1}|`}</Tex> on accepted
          rides: if it's symmetric around 0, pass 2 is neutral (or up
          to noise). If it's asymmetric, it introduces a systematic
          bias to be corrected upstream.
        </Note>
      </Section>

      <Section title="Algorithm summary">
        <Formula>
          {String.raw`\boxed{\begin{aligned}
& \textbf{1.}\; \text{Solve } (C_dA_1,\, C_{rr,1}) \text{ on all valid points} \\
& \textbf{2.}\; \text{Compute } \text{drift}(t) = \text{alt}_{\text{virt}}(t) - \text{alt}_{\text{actual}}(t) \\
& \textbf{3.}\; \text{Smooth the drift (30\,s), then compute:} \\
& \qquad r(t) = \left\langle \left| \tfrac{d(\text{drift}_{\text{smoothed}})}{dt} \right| \right\rangle_{60\text{s}} \quad \text{vs} \quad \max\!\left(0.10,\; \tfrac{D^{+}}{\text{duration}} \times 4\right) \\
& \qquad d(t) = \left\langle |\text{drift}_{\text{smoothed}}| \right\rangle_{60\text{s}} \quad \text{vs} \quad \max\!\left(80,\; D^{+} \times 0.12\right) \\
& \textbf{4.}\; \text{Exclude if } r(t) > \text{rate\_thresh} \;\lor\; d(t) > \text{abs\_thresh} \\
& \textbf{5.}\; \text{If } > 30\%\text{ excluded} \implies \text{keep pass 1} \\
& \textbf{6.}\; \text{Else re-solve } (C_dA_2,\, C_{rr,2}) \text{ on remaining points}
\end{aligned}}`}
        </Formula>
      </Section>

      <Section title="What it changes in practice">
        <P>
          On a flat ride with a midway pack section (drafting), pass 1
          gives a <Tex>{String.raw`C_dA`}</Tex> biased downward.
          Criterion 1 (drift rate) detects the rapid divergence during
          drafting. Pass 2 excludes that section and recomputes —
          <Tex>{String.raw`C_dA`}</Tex> is more realistic.
        </P>
        <P>
          On a mountain ride, the descent often produces divergence
          (braking, unmodeled terminal speed). Criterion 2 (absolute
          drift) catches the error accumulation on the descent. Pass 2
          excludes the descent and bases{" "}
          <Tex>{String.raw`C_dA`}</Tex> on climbs and flat portions —
          more stable result.
        </P>
        <P>
          On a ride where the wind rotates progressively (the weather
          API gives an hourly wind, but real wind varies every 15
          minutes), the two criteria complement each other: drift rate
          catches sudden shifts, absolute drift catches slow
          accumulation on segments where wind is systematically wrong.
        </P>
        <Note>
          This is exactly what Golden Cheetah practitioners do
          manually: they look at the VE chart, spot divergence zones,
          exclude them by hand, and relaunch the calculation.
          AeroProfile automates this step with a hybrid detection
          covering both failure modes (local and accumulated).
        </Note>
      </Section>

      <Section title="When pass 2 does not activate">
        <P>
          Three cases where refinement is skipped:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Low drift everywhere</strong>: if neither criterion
            exceeds its threshold (or fewer than 20 points excluded),
            the pass 1 result is already good.
          </li>
          <li>
            <strong>Too many points excluded (&gt; 30%)</strong>: the
            model is globally wrong, refinement can't help.
          </li>
          <li>
            <strong>Too few remaining points (&lt; 100)</strong>: not
            enough data for a reliable re-estimation.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
