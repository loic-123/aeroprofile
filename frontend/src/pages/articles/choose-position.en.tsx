import { Article, Section, Note, P } from "../../components/BlogLayout";

export default function ChoosePositionEn() {
  return (
    <Article title="Which position should I pick in the form?">
      <P>
        The <em>Riding position</em> selector is not a trap. It doesn't fix
        your CdA — it just gives the solver a <em>starting hypothesis</em>
        to search around. Here's how to fill it without stress, and what
        to do if you really aren't sure.
      </P>

      <Section title="What this field does">
        <P>
          The solver needs a starting point and a likely range. When you
          pick <em>Aero hoods</em>, it starts its search around 0.30 m² and
          expects a value between 0.24 and 0.36 or so. When you pick{" "}
          <em>Very aero (TT bars)</em>, it starts around 0.22 with a
          tighter range.
        </P>
        <P>
          If your ride is rich in data (varied speed, heading changes),
          the solver will find your true CdA even if your starting
          position is a bit off. If your ride is sparse (climbing a col
          for 2h in a straight line), the solver settles close to the
          prior — that's when your position choice actually matters.
        </P>
      </Section>

      <Section title="How to pick your position">
        <P>
          Look at where your hands sit on the bike <strong>most of the
          ride</strong>. Not during a brief TT burst, not at the foot of
          a climb, but your average posture when rolling at a sustained
          pace.
        </P>
        <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1 my-3">
          <li><strong>TT bars, flat back</strong> → "Pro (superman)" or "Aero (TT bars)".</li>
          <li><strong>Hands in the drops, flat back</strong> → "Aero (drops)".</li>
          <li><strong>Hands on the hoods, moderately flat back</strong> → "Moderate (hoods)". <em>This is where most road cyclists actually ride.</em></li>
          <li><strong>Hands on the tops, torso upright</strong> → "Relaxed (tops)".</li>
          <li><strong>City bike, casual MTB</strong> → "Relaxed" on the MTB / Gravel preset.</li>
        </ul>
      </Section>

      <Section title="What if you really don't know?">
        <P>
          Pick <strong>"I don't know"</strong> (first option in the
          selector). This disables the CdA prior — the solver then
          searches freely, based only on your data. The priors on wind
          and Crr stay active so the solver doesn't diverge.
        </P>
        <Note>
          <strong>When "I don't know" is the right pick:</strong> on
          information-rich rides (varied heading, varied speed, multiple
          hours, little drafting). These conditions give the solver
          everything it needs, and it will find your CdA without a
          starting hypothesis. The CdA shown at the end is then a{" "}
          <em>data-pure</em> estimate.
        </Note>
        <P>
          <strong>When it's less advisable:</strong> on sparse rides
          (straight col climb, short ride &lt; 20 min, heavy drafting).
          Without a prior, the solver risks hitting a physical bound
          (0.15 m² or 0.55 m² on road) and you end up with an unreliable
          estimate flagged <code>non_identifiable</code>. In that case,
          pick the position closest to your actual posture.
        </P>
      </Section>

      <Section title="You can change your mind afterwards">
        <P>
          If you ran the analysis with a position that didn't fit, click{" "}
          <em>New analysis</em>, change the selector, and run again. The
          browser cache will regenerate the result with the correct prior
          in under 10 seconds.
        </P>
        <P>
          Keep in mind that on an informative ride, changing the prior
          moves the CdA by less than 0.005 m² — roughly the solver's
          error margin. The choice only matters on borderline rides.
        </P>
      </Section>

      <Section title="In short">
        <P>
          One principle: <strong>the selector helps the solver, it
          doesn't constrain it</strong>. Pick the position closest to
          your true posture, or "I don't know" if you hesitate — in both
          cases the solver will adjust based on your data. To understand
          how a Bayesian prior works in detail, the <em>Bayesian
          priors</em> article covers the full math and safeguards.
        </P>
      </Section>
    </Article>
  );
}
