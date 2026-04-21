import { Article, Section, Formula, Tex, Note, P } from "../../components/BlogLayout";

export default function FiltersEn() {
  return (
    <Article title="Data filtering: how we separate signal from noise">
      <P>
        On a 3-hour ride, you have ~10 000 seconds of data. But only a
        fraction of it is usable for estimating CdA. Stops, braking, tight
        turns, steep climbs and pack sections violate the physical model's
        assumptions. Include them and the solver tries to fit noise → wrong
        result.
      </P>

      <Section title="The 13 filters">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Filter</th>
                <th className="py-2">Threshold</th>
                <th className="py-2">Why?</th>
              </tr>
            </thead>
            <tbody className="text-text">
              <tr className="border-b border-border/30">
                <td className="py-1.5">Stop</td>
                <td className="font-mono">V &lt; 1 m/s</td>
                <td className="text-muted">No aero signal when stopped</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Low speed</td>
                <td className="font-mono">V &lt; 3 m/s</td>
                <td className="text-muted">Aero is &lt;10% of power → noise</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Low power</td>
                <td className="font-mono">P &lt; 50 W</td>
                <td className="text-muted">Coasting, no-pedal descent — no signal</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Braking</td>
                <td className="font-mono">a &lt; -0.3 m/s²</td>
                <td className="text-muted">Energy dissipated in brakes, not modeled</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Hard acceleration</td>
                <td className="font-mono">a &gt; 0.3 m/s²</td>
                <td className="text-muted">Quasi-static model is imprecise</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Steep climb</td>
                <td className="font-mono">gradient &gt; 8%</td>
                <td className="text-muted">Gravity dominates, aero is invisible</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Steep descent</td>
                <td className="font-mono">gradient &lt; -8%</td>
                <td className="text-muted">Terminal speed, unmodeled braking</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Tight corner</td>
                <td className="font-mono">yaw_rate &gt; 10°/s</td>
                <td className="text-muted">Cornering losses, lean angle</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5"><Tex>{String.raw`V_{\text{air}}`}</Tex> negative</td>
                <td className="font-mono"><Tex>{String.raw`V_{\text{air}} \leq 0`}</Tex></td>
                <td className="text-muted">Tailwind stronger than ground speed</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">GPS jump</td>
                <td className="font-mono">&gt; 50 m between 2 pts</td>
                <td className="text-muted">GPS artefact (tunnel, canyon)</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Power spike</td>
                <td className="font-mono">P &gt; 3×NP</td>
                <td className="text-muted">Sensor bug, unrepresentative sprint</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5">Unstable speed</td>
                <td className="font-mono">CV &gt; 15% (15s)</td>
                <td className="text-muted">Repeated accel/brake</td>
              </tr>
              <tr>
                <td className="py-1.5">Drafting</td>
                <td className="font-mono"><Tex>{String.raw`C_dA_{\text{inst}} < 0.12`}</Tex></td>
                <td className="text-muted">Physically impossible solo → in someone's wheel</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Continuous blocks of 30 seconds minimum">
        <P>
          After per-point filtering, we only keep continuous blocks of at
          least 30 seconds of valid data. An isolated valid point between
          two filtered zones doesn't carry enough information to constrain
          the model — the physical model requires a quasi-steady state over
          a sufficient duration.
        </P>
      </Section>

      <Section title="How much data is left?">
        <P>
          Typically 40% to 70% of data passes filtering. On a 3 h ride
          (10 800 points), ~5 000 to 7 000 usable points remain. That's
          plenty — the solver needs only a few hundred points minimum.
        </P>
        <P>
          If less than 20% passes, it's a red flag: either the ride isn't
          suitable (technical MTB, dense pack) or there's a sensor issue.
        </P>
      </Section>

      <Section title="Post-analysis filtering: hybrid iterative refinement">
        <P>
          After the solver, an additional filter compares reconstructed
          virtual altitude to actual GPS altitude. Two hybrid criteria
          detect problematic segments:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Drift rate</strong> (<Tex>{String.raw`\frac{d}{dt}|\Delta h|`}</Tex>):
            detects where the model is <em>actively</em> diverging (sudden drafting, wind shift)
          </li>
          <li>
            <strong>Detrended drift</strong> (<Tex>{String.raw`|\Delta h - \text{trend}|`}</Tex>):
            safety net — detects local gaps after subtracting the global linear trend
          </li>
        </ul>
        <P>
          If more than 30% of valid points would be excluded, refinement is
          skipped entirely — the model is globally broken and cutting it up
          wouldn't help. See the "Iterative refinement" article for details.
        </P>
      </Section>

      <Section title="Multi-ride filtering (Intervals / multi-file mode)">
        <P>
          When several rides are analyzed, a final filter excludes whole
          rides whose nRMSE exceeds 45%, or whose CdA falls outside the
          selected bike type's range. The mean CdA is quality-weighted
          (good rides count 3× more than mediocre ones).
        </P>
      </Section>

      <Section title="Pre-filtering smoothing">
        <P>
          Before any filtering, AeroProfile applies two smoothings:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Power: 5-second moving average</strong> (Martin 1998).
            Smooths pedal-stroke torque oscillations that the quasi-static
            model can't capture. Instantaneous CdA values inherit this
            smoothing — they are already averaged over ~5 s.
          </li>
          <li>
            <strong>Altitude: Savitzky-Golay filter</strong> (31-point
            window, degree-3 polynomial). Preserves slope breaks better
            than a moving average while removing the ±0.2 m barometer noise.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
