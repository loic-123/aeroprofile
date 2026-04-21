import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function PowerMeterQualityEn() {
  return (
    <Article title="The power meter: the error source the solver cannot fix">
      <P>
        AeroProfile assumes the power measured by your sensor is{" "}
        <em>true</em>. The entire pipeline — filtering, solvers, virtual
        elevation, Bayesian priors — treats watts as a reliable
        observation. If your sensor reads 10% too high, the solver
        compensates by pushing <Tex>{String.raw`C_dA`}</Tex> or{" "}
        <Tex>{String.raw`C_{rr}`}</Tex> to the physical bounds to
        balance the power equation. Result: a CdA that looks "solid"
        but is really the symptom of a biased sensor.
      </P>
      <P>
        This article explains why we classify power meters by quality
        and why we compute a solver-independent{" "}
        <strong>calibration ratio</strong>, which can detect bias even
        when the model fit is excellent.
      </P>

      <Section title="The two failure modes">
        <P>
          Two sensor categories give systematically less reproducible
          results:
        </P>

        <h4 className="font-semibold mt-4 mb-1">Single-sided (left-only) meters</h4>
        <P>
          Models such as the <strong>4iiii Precision</strong>,{" "}
          <strong>Stages Left</strong> or{" "}
          <strong>Rotor InPower single-side</strong> measure only the
          left crank and multiply by 2. They thus assume <em>perfect
          L/R symmetry</em>, which is true for nobody. Bini and Hume
          (2014, <em>Journal of Biomechanics</em>) measured an average
          L/R asymmetry of <strong>5 to 15%</strong> in amateur
          cyclists, amplified by fatigue and varying with effort
          (climb vs flat, seated vs standing).
        </P>
        <P>
          Consequence: the "total" power reported by the sensor drifts
          within a ride, and differs from ride to ride with
          fatigue/position. The solver cannot distinguish this drift
          from a real CdA change.
        </P>

        <h4 className="font-semibold mt-4 mb-1">Temperature drift (zero-offset)</h4>
        <P>
          The strain gauges in most sensors have a zero that drifts
          with temperature: the sensor reads "X watts" even at rest,
          where the real intensity is 0. Modern pedal-based sensors
          (<strong>Favero Assioma</strong>, <strong>Garmin Rally</strong>,{" "}
          <strong>Wahoo Powrlink</strong>) automatically recalibrate
          this zero <strong>while coasting</strong>. Single-sided
          meters <em>aren't always able to</em> — you have to run a
          manual "zero-offset" before each ride.
        </P>
        <Warning>
          Without zero-offset, a 10 °C swing between storage and ride
          can easily introduce ±15 W of offset, i.e.{" "}
          <Tex>{String.raw`\pm 0.05\;m^2`}</Tex> on your CdA — more
          than the gains from a position or equipment change.
        </Warning>
      </Section>

      <Section title="Quality classification">
        <P>
          AeroProfile looks at the <code>power_meter</code> field
          returned by Intervals.icu (which mirrors the ANT+ string
          written into the FIT file) and classifies it as:
        </P>
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Quality</th>
                <th className="py-2">Type</th>
                <th className="py-2">Examples</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1 text-teal font-semibold">high</td>
                <td>Dual pedals, spiders</td>
                <td>Favero Assioma (Duo, Pro), Favero bePro (recent firmware), Garmin Rally, SRM, Quarq, Power2Max</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-warn font-semibold">medium</td>
                <td>Trainers</td>
                <td>Tacx Neo, Wahoo KICKR, VersaDesign</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-coral font-semibold">low</td>
                <td>Single-sided crank</td>
                <td>4iiii Precision, Stages left, Rotor InPower L</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-muted font-semibold">unknown</td>
                <td>No metadata</td>
                <td>FIT re-encoded by a third-party platform, generic sensor</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Calibration ratio: a solver-independent test">
        <P>
          Even with a high-quality sensor, the user can have
          miscalibrated it once (zero offset done while the pedals were
          turning, different temperature…). To detect this kind of
          drift <em>without trusting the solver</em>, we compute a
          physical ratio on the flat, pedaled portions of the ride:
        </P>
        <Formula>{String.raw`\text{ratio} = \frac{\overline{P_{\text{measured}}}}{\overline{P_{\text{theoretical}}(C_{dA,\text{prior}},\; C_{rr}=0.005)}}`}</Formula>
        <P>
          where <Tex>{String.raw`P_{\text{theoretical}}`}</Tex> is
          computed from the Martin et al. (1998) model with a
          "reasonable" CdA for the chosen bike type (0.30 for road,
          0.22 for TT, etc.) and a standard asphalt Crr of 0.005. The
          average is over points satisfying{" "}
          <Tex>{String.raw`|\text{slope}| < 2\%`}</Tex> and{" "}
          <Tex>{String.raw`P > 50\;W`}</Tex> (no coasting descent).
        </P>
        <P>
          A ratio of 1.00 means measured power matches exactly what an
          "average" rider would produce under those conditions. A
          ratio of 1.40 means the sensor reads 40% higher than
          expected — either the rider is above average or the sensor
          is biased. Either way, the solver has to compensate.
        </P>
        <Note>
          <strong>Thresholds used by AeroProfile</strong> (hard/warn
          tiers based on |ratio − 1|):
          <ul className="list-disc pl-5 mt-1 text-sm">
            <li><span className="text-coral font-mono">|ratio − 1| &gt; 0.20</span> or (<span className="text-coral font-mono">&gt; 0.15</span> + CdA on bound) → hard exclusion</li>
            <li><span className="text-warn font-mono">|ratio − 1| &gt; 0.10</span> → soft warning (ride kept in aggregate)</li>
            <li><span className="text-teal font-mono">|ratio − 1| ≤ 0.10</span> → all good</li>
          </ul>
        </Note>
        <P>
          <strong>Why it's useful</strong>: this test uses only
          physics, not the solver. A biased sensor that passes every
          solver check (high R², non-degenerate Hessian) will still be
          caught here.
        </P>
      </Section>

      <Section title="Interpretation: sensor_miscalib vs model_mismatch">
        <P>
          A ratio far from 1.0 has <strong>two very different
          causes</strong>, and AeroProfile chooses the interpretation
          based on sensor quality — without which we can't decide:
        </P>
        <ul className="list-disc ml-6 space-y-2 text-text text-sm">
          <li>
            <strong>(a) Real sensor bias</strong> — forgotten
            zero-offset, temperature drift on a single-sided meter,
            internal mechanical misalignment. Common on <em>low
            quality</em> sensors (4iiii Precision, Stages Left) and
            plausible on <em>medium</em>. The response is actionable:
            run a zero-offset at the start of the next ride.
          </li>
          <li>
            <strong>(b) Wrong physical model</strong> — the sensor is
            honest but the reference <em>theoretical</em> power is
            wrong. Typical causes: real wind very different from
            Open-Meteo in the area (valley, gusts, site effect),
            position markedly different from the bike type's prior
            (tops vs drops), variable drivetrain efficiency, cumulative
            accelerations not captured by the 5 s smoothing.{" "}
            <strong>The sensor is not at fault, and no zero-offset
            will fix the problem</strong>. Near-certain on <em>high
            quality</em> sensors (Assioma Duo, Garmin Rally dual,
            Quarq, SRM) which do not drift by more than ±5–10% in real
            life.
          </li>
        </ul>
        <P>
          Concretely, when the ride is analyzed with a <em>high</em>{" "}
          sensor, AeroProfile switches the status from{" "}
          <code>sensor_miscalib</code>/<code>sensor_miscalib_warn</code>{" "}
          to <code>model_mismatch</code>/<code>model_mismatch_warn</code>.
          The status name changes, the message changes (no mention of
          zero-offset), but the exclusion logic is identical:
          hard/warn thresholds are the same, and hard rides are
          excluded from the aggregate in both cases.
        </P>
        <P>
          This distinction matters because it avoids misleading
          messages. When the user rides an Assioma Duo and sees a ride
          flagged <code>model_mismatch</code>, they know it's not
          worth recalibrating — it's the API wind or an unusual
          position causing the gap. Conversely, when a 4iiii reports a{" "}
          <code>sensor_miscalib</code>, the zero-offset is the first
          thing to check.
        </P>
      </Section>

      <Section title="Application: a case study on real data">
        <P>
          On a dataset of 120 rides from a single cyclist covering 4
          sensor phases (4iiii → Assioma DUO → 4iiii after repair →
          Assioma Pro RS-2), the standard deviation of the
          reconstructed CdA on "ok" rides evolves as follows:
        </P>
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Phase</th>
                <th className="py-2">Sensor</th>
                <th className="py-2 text-right">n</th>
                <th className="py-2 text-right">% ok</th>
                <th className="py-2 text-right">σ(CdA)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30"><td className="py-1">2024</td><td>4iiii (original)</td><td className="text-right">34</td><td className="text-right">47%</td><td className="text-right text-coral">0.069</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q1</td><td>Assioma DUO</td><td className="text-right">1</td><td className="text-right">100%</td><td className="text-right">—</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q2</td><td>4iiii (post-repair)</td><td className="text-right">42</td><td className="text-right">81%</td><td className="text-right text-warn">0.042</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q3+</td><td>Assioma Pro RS-2</td><td className="text-right">43</td><td className="text-right">53%</td><td className="text-right text-teal">0.031</td></tr>
            </tbody>
          </table>
        </div>
        <P>
          <strong>Surprising observation</strong>: the mean CdA barely
          moves between phases (≈0.30 everywhere). What changes
          drastically is the <em>reproducibility</em>: the original
          4iiii gives a standard deviation <strong>2.2× greater</strong>{" "}
          than the Assioma Pro RS-2, even though both sensors should
          measure the same physical reality.
        </P>
        <P>
          Even more interesting: the same 4iiii after repair (2025 Q2)
          gives an intermediate standard deviation (0.042) — better
          than the original but worse than the Assioma. The difference
          with the 2024 phase is <em>not</em> the hardware, it's
          calibration discipline: after the repair, the user got into
          the habit of running a manual zero-offset at each start.
        </P>
        <Note>
          The <strong>W/CdA</strong> or <strong>P/kg ratio</strong>{" "}
          obtained with a single-sided sensor aren't wrong; they are
          simply <em>less precise</em>. For reliable cross-ride
          comparisons (position evolution, equipment tests), we
          recommend auto-calibrated dual pedals.
        </Note>
      </Section>

      <Section title="Consequence: the stability timeline">
        <P>
          Because the CdA standard deviation changes abruptly at
          sensor switches, we expose in the history a{" "}
          <strong>graph of the rolling standard deviation over 10
          consecutive rides</strong>. Colored background bands show
          which sensor was in use for each period, and you can see
          immediately when the data became reliable.
        </P>
        <P>
          This graph turns an intuition ("my rides have been more
          stable since I switched sensor") into measured, visible
          data.
        </P>
      </Section>

      <Section title="References">
        <ul className="list-disc pl-5 text-sm">
          <li>Bini R, Hume PA (2014). <em>Between-day reliability of pedal forces for cyclists during an incremental cycling test to exhaustion</em>. Journal of Biomechanics.</li>
          <li>Martin JC, Milliken DL, Cobb JE, McFadden KL, Coggan AR (1998). <em>Validation of a Mathematical Model for Road Cycling Power</em>. Journal of Applied Biomechanics.</li>
          <li>Gardner AS, Stephens S, Martin DT, Lawton E, Lee H, Jenkins D (2004). <em>Accuracy of SRM and Power Tap power monitoring systems for bicycling</em>. Medicine & Science in Sports & Exercise.</li>
          <li>Maier T, Schmid L, Müller B, Steiner T, Wehrlin JP (2017). <em>Accuracy of cycling power meters against a mathematical model of treadmill cycling</em>. International Journal of Sports Medicine.</li>
        </ul>
      </Section>
    </Article>
  );
}
