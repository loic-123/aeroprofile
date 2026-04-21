import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function DraftingDetectionEn() {
  return (
    <Article title="Drafting detection: when group riding skews the CdA">
      <P>
        Drafting (riding in someone's wake) is the biggest bias the model
        encounters on group rides. Behind a teammate, aerodynamic drag
        drops 30 to 40%. As a result, the apparent{" "}
        <Tex>{String.raw`C_dA`}</Tex> is artificially low — it reflects
        not your position, but the fact that you were sheltered.
      </P>

      <Section title="Drafting physics">
        <P>
          In the wake of a rider ahead of you, the air is already
          disturbed: the low-pressure zone they create "sucks" the
          follower. Your power meter reads fewer watts for the same
          speed.
        </P>
        <P>
          The drag reduction depends on spacing between the two riders.
          Blocken et al. (2018) measured by CFD:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Spacing</th>
                <th className="py-2 text-right">Drag reduction</th>
                <th className="py-2 text-right">Apparent <Tex>{String.raw`C_dA`}</Tex></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="font-sans">15 cm (wheel-to-wheel)</td><td className="text-right">-40%</td><td className="text-right"><Tex>{String.raw`0.60 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">0.5 m</td><td className="text-right">-35%</td><td className="text-right"><Tex>{String.raw`0.65 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">1 m</td><td className="text-right">-27%</td><td className="text-right"><Tex>{String.raw`0.73 \times C_dA_0`}</Tex></td></tr>
              <tr className="border-b border-border/30"><td className="font-sans">2 m</td><td className="text-right">-18%</td><td className="text-right"><Tex>{String.raw`0.82 \times C_dA_0`}</Tex></td></tr>
              <tr><td className="font-sans">5 m</td><td className="text-right">-5%</td><td className="text-right"><Tex>{String.raw`0.95 \times C_dA_0`}</Tex></td></tr>
            </tbody>
          </table>
        </div>

        <P>
          The physical model, for its part, does not know you are in a
          wake. It just sees: "this rider produces 120 W at 35 km/h on
          the flat → their <Tex>{String.raw`C_dA`}</Tex> must be very
          low". It attributes the power reduction to a low{" "}
          <Tex>{String.raw`C_dA`}</Tex> instead of reduced apparent wind.
        </P>
        <P>
          Quantitatively, at 35 km/h (<Tex>{String.raw`V = 9.72 \;\text{m/s}`}</Tex>)
          with <Tex>{String.raw`C_dA = 0.32`}</Tex> and{" "}
          <Tex>{String.raw`\rho = 1.2`}</Tex>:
        </P>
        <Formula>{String.raw`P_{\text{aero}} = \frac{1}{2} \times C_dA \times \rho \times V^3 = \frac{1}{2} \times 0.32 \times 1.2 \times 9.72^3 \approx 176 \;\text{W}`}</Formula>
        <P>
          Drafting at -35% drag:
        </P>
        <Formula>{String.raw`P_{\text{draft}} = 176 \times 0.65 = 114 \;\text{W}`}</Formula>
        <Formula>{String.raw`C_dA_{\text{apparent}} = C_dA \times 0.65 = 0.32 \times 0.65 = 0.208`}</Formula>
        <P>
          The rider appears to have a pro TT{" "}
          <Tex>{String.raw`C_dA`}</Tex> when they are actually just in
          someone's wheel.
        </P>
      </Section>

      <Section title="How AeroProfile detects drafting">
        <P>
          At each ride point, AeroProfile computes an instantaneous{" "}
          <Tex>{String.raw`C_dA`}</Tex>:
        </P>
        <Formula>{String.raw`C_dA_{\text{inst}} = \frac{P \cdot \eta - P_{\text{roll}} - P_{\text{grav}} - P_{\text{accel}}}{\frac{1}{2} \, \rho \, V_{\text{air}}^2 \cdot V}`}</Formula>
        <P>
          where each power component is computed from the Martin et al.
          (1998) model. Detection triggers when three conditions are met{" "}
          <strong>simultaneously</strong>:
        </P>
        <ul className="list-decimal ml-6 space-y-1 text-text">
          <li>
            <Tex>{String.raw`V > 8 \;\text{m/s}`}</Tex> (29 km/h) — fast
            enough that aero dominates.
          </li>
          <li>
            <Tex>{String.raw`|\text{gradient}| < 2\%`}</Tex> — flat
            terrain (no dominant gravity term to confound the
            calculation).
          </li>
          <li>
            <Tex>{String.raw`P > 100 \;\text{W}`}</Tex> — rider is
            actively pedaling (not coasting).
          </li>
        </ul>
        <P>
          If <Tex>{String.raw`C_dA_{\text{inst}} < 0.12`}</Tex>, the
          value is physically impossible solo (even a pro in TT is at{" "}
          <Tex>{String.raw`C_dA \geq 0.17`}</Tex>). The point is
          therefore flagged as "drafting".
        </P>
        <P>
          Additionally, the drafting block must last{" "}
          <strong>at least 30 consecutive seconds</strong>. A single
          point at <Tex>{String.raw`C_dA_{\text{inst}} = 0.10`}</Tex>{" "}
          can be an artefact (GPS error, wind gust). But 30 consecutive
          seconds of such low values = almost certainly in a wake.
        </P>
      </Section>

      <Section title="Compare mode: detection between riders">
        <P>
          When two riders ride together (same ride, same day),
          AeroProfile detects whether results are biased by asymmetric
          drafting:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            If mean speeds are similar (<Tex>{String.raw`\pm 5\%`}</Tex>)...
          </li>
          <li>
            ...but <Tex>{String.raw`C_dA`}</Tex> values differ by more
            than 15%...
          </li>
          <li>
            → The rider with the low <Tex>{String.raw`C_dA`}</Tex>{" "}
            probably "sucked the wheel" of the rider with the higher{" "}
            <Tex>{String.raw`C_dA`}</Tex>.
          </li>
        </ul>
        <P>
          An orange banner explicitly names the drafter and the puller.
        </P>
      </Section>

      <Section title="Alternative: wake factor modeling">
        <P>
          A more sophisticated approach would model drafting as a
          multiplier <Tex>{String.raw`\delta`}</Tex> on aerodynamic drag:
        </P>
        <Formula>{String.raw`P_{\text{aero,draft}} = \delta \cdot \frac{1}{2} \, C_dA \, \rho \, V_{\text{air}}^2 \cdot V \qquad \text{with } \delta \in [0.6,\; 1.0]`}</Formula>
        <P>
          But without information on the relative position of riders in
          the group, <Tex>{String.raw`\delta`}</Tex> is unobservable.
          AeroProfile therefore takes a pragmatic approach: detect and
          exclude rather than model.
        </P>
      </Section>

      <Section title="What to do if your ride is a group ride?">
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li>
            <strong>Solo ride</strong>: the best scenario. No drafting,
            reliable <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Equal pulls</strong>: if both riders pull equally,
            drafting artefacts cancel out in the average. The aggregated{" "}
            <Tex>{String.raw`C_dA`}</Tex> over several rides converges
            to the right value.
          </li>
          <li>
            <strong>Single puller</strong>: the puller has a correct{" "}
            <Tex>{String.raw`C_dA`}</Tex> (they're in the wind), the
            follower an underestimated{" "}
            <Tex>{String.raw`C_dA`}</Tex>. Use the puller's{" "}
            <Tex>{String.raw`C_dA`}</Tex> as reference.
          </li>
          <li>
            <strong>Peloton / gran fondo</strong>:{" "}
            <Tex>{String.raw`C_dA`}</Tex> is unusable. AeroProfile
            flags it with a very high nRMSE and excludes the ride from
            the average.
          </li>
        </ul>
        <Warning>
          The anti-drafting filter (<Tex>{String.raw`C_dA_{\text{inst}} < 0.12`}</Tex>)
          is conservative — it only detects strong drafting (30-40%
          reduction). A rider 1-2 m behind another benefits from ~15-20%
          reduction, which can slip under the filter's radar.
        </Warning>
      </Section>

      <Section title="References">
        <P>
          Blocken et al. (2018). "Aerodynamic drag in cycling pelotons."{" "}
          <em>Journal of Wind Engineering and Industrial Aerodynamics</em>.
          CFD measurements showing -27% to -40% drag for the 2nd rider
          depending on spacing. Barry et al. (2015) for experimental
          wind-tunnel measurements.
        </P>
      </Section>
    </Article>
  );
}
