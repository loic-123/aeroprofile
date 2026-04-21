import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function YawAngleEn() {
  return (
    <Article title="Yaw angle: why crosswind changes your CdA">
      <P>
        When you ride, the air doesn't always come straight from the front.
        With any crosswind, the apparent air arrives at an angle — that's
        the yaw angle (<Tex>{String.raw`\beta`}</Tex>). And a rider doesn't
        present the same air resistance depending on whether the flow comes
        head-on or from the side.
      </P>

      <Section title="Yaw definition and calculation">
        <P>
          Yaw is the angle between your direction of travel and the
          direction of the <strong>apparent wind</strong> — the vector
          combination of your ground speed and the real meteorological
          wind.
        </P>
        <P>
          We decompose the real wind into two components relative to your
          heading (GPS bearing):
        </P>
        <Formula>{String.raw`V_{\text{long}} = V_{\text{ground}} + V_{\text{wind}} \cdot \cos(\theta_{\text{wind}} - \theta_{\text{bearing}})`}</Formula>
        <Formula>{String.raw`V_{\text{lat}} = V_{\text{wind}} \cdot \sin(\theta_{\text{wind}} - \theta_{\text{bearing}})`}</Formula>
        <P>
          The yaw angle is then:
        </P>
        <Formula>{String.raw`\beta = \arctan\!\left(\frac{|V_{\text{lat}}|}{|V_{\text{long}}|}\right)`}</Formula>
        <P>
          And the apparent air speed (which generates drag) is the norm of
          the resultant vector:
        </P>
        <Formula>{String.raw`V_{\text{air}} = \sqrt{V_{\text{long}}^2 + V_{\text{lat}}^2}`}</Formula>

        <P>
          Some concrete examples at{" "}
          <Tex>{String.raw`V_{\text{ground}} = 30 \;\text{km/h}`}</Tex> with
          a 10 km/h wind:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Wind direction</th>
                <th className="py-2 text-right">Yaw (<Tex>{String.raw`\beta`}</Tex>)</th>
                <th className="py-2 text-right"><Tex>{String.raw`V_{\text{air}}`}</Tex></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Pure headwind</td><td className="text-right">0°</td><td className="text-right">40 km/h</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Wind at 45°</td><td className="text-right">~4°</td><td className="text-right">~38 km/h</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5 font-sans">Pure crosswind (90°)</td><td className="text-right">~10°</td><td className="text-right">~32 km/h</td></tr>
              <tr><td className="py-1.5 font-sans">Pure tailwind</td><td className="text-right">0°</td><td className="text-right">20 km/h</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Impact on CdA">
        <P>
          Wind-tunnel measurements (Crouch, Burton et al. 2014; Barry et al.
          2015) show that <Tex>{String.raw`C_dA`}</Tex> rises with yaw, in
          an approximately quadratic fashion. AeroProfile uses the following
          model:
        </P>
        <Formula>{String.raw`C_dA_{\text{eff}} = C_dA_0 \times \bigl(1 + k \cdot \beta^2\bigr)`}</Formula>
        <P>
          where <Tex>{String.raw`C_dA_0`}</Tex> is your{" "}
          <Tex>{String.raw`C_dA`}</Tex> in still air (yaw = 0°),{" "}
          <Tex>{String.raw`\beta`}</Tex> is the yaw angle in degrees, and{" "}
          <Tex>{String.raw`k`}</Tex> is a coefficient calibrated on wind
          tunnel data:
        </P>
        <Formula>{String.raw`k = 5 \times 10^{-4} \;\text{deg}^{-2}`}</Formula>

        <P>Numerically, here is the effect at different angles:</P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Yaw (<Tex>{String.raw`\beta`}</Tex>)</th>
                <th className="py-2 text-right">Multiplier</th>
                <th className="py-2 text-right"><Tex>{String.raw`C_dA`}</Tex> increase</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td>0°</td><td className="text-right">1.000</td><td className="text-right text-muted">+0%</td></tr>
              <tr className="border-b border-border/30"><td>5°</td><td className="text-right">1.013</td><td className="text-right text-muted">+1.3%</td></tr>
              <tr className="border-b border-border/30"><td>10°</td><td className="text-right">1.050</td><td className="text-right text-muted">+5.0%</td></tr>
              <tr className="border-b border-border/30"><td>15°</td><td className="text-right">1.113</td><td className="text-right text-muted">+11.3%</td></tr>
              <tr><td>20°</td><td className="text-right">1.200</td><td className="text-right text-muted">+20.0%</td></tr>
            </tbody>
          </table>
        </div>
        <P>
          In practice, the mean yaw on a road ride is 5-10° depending on
          wind conditions, which corresponds to +1% to +5% of effective{" "}
          <Tex>{String.raw`C_dA`}</Tex> vs the still-air{" "}
          <Tex>{String.raw`C_dA`}</Tex>.
        </P>
      </Section>

      <Section title="Why yaw raises CdA">
        <P>
          Several physical mechanisms contribute:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Asymmetric frontal area</strong> — The rider's body seen
            from the side exposes more area than from the front (asymmetric
            arms, legs, torso). The effective frontal area grows with{" "}
            <Tex>{String.raw`\beta`}</Tex>.
          </li>
          <li>
            <strong>Asymmetric separation</strong> — Flow separates
            asymmetrically, creating more wake turbulence and a larger
            low-pressure zone behind the rider.
          </li>
          <li>
            <strong>Wheel sail effect</strong> — Deep-section wheels act
            like sails: they add lateral drag that partially projects into
            the direction of motion.
          </li>
          <li>
            <strong>Helmet and bottle perturbations</strong> — The helmet,
            frame and bottles create different perturbations depending on
            incidence angle.
          </li>
        </ul>
      </Section>

      <Section title="What AeroProfile does">
        <P>
          <strong>Without yaw correction</strong>: the solver estimates an
          "average" <Tex>{String.raw`C_dA`}</Tex> that conflates your
          intrinsic aero and the crosswind effect. On a windy ride with a
          lot of crosswind, the reported{" "}
          <Tex>{String.raw`C_dA`}</Tex> is inflated.
        </P>
        <P>
          <strong>With yaw correction</strong>: at each point, the model
          computes <Tex>{String.raw`\beta`}</Tex> from the wind (real or
          estimated) and GPS bearing, then applies the multiplier:
        </P>
        <Formula>{String.raw`C_dA_{\text{eff}}(t) = C_dA_0 \times \bigl(1 + k \cdot \beta(t)^2\bigr)`}</Formula>
        <P>
          The solver estimates <Tex>{String.raw`C_dA_0`}</Tex> — your{" "}
          <Tex>{String.raw`C_dA`}</Tex> in still air, independent of the
          day's wind. It is a property of your <em>position</em> and{" "}
          <em>equipment</em>, not the weather.
        </P>
        <Note>
          In the wind-inverse solver, yaw is recomputed each iteration
          since wind itself is jointly estimated. Wind changes →{" "}
          <Tex>{String.raw`\beta`}</Tex> changes →{" "}
          <Tex>{String.raw`C_dA_{\text{eff}}`}</Tex> changes → residual
          changes. The solver converges to a consistent triplet{" "}
          <Tex>{String.raw`(C_dA_0,\; C_{rr},\; \vec{V}_{\text{wind}})`}</Tex>.
        </Note>
      </Section>

      <Section title="Practical implications">
        <P>
          A few direct consequences of yaw correction:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Comparability</strong> — Two rides on different windy
            days yield a comparable{" "}
            <Tex>{String.raw`C_dA_0`}</Tex>, unlike raw{" "}
            <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Reliable A/B test</strong> — You can compare two
            positions or two setups even if wind was not identical between
            tests.
          </li>
          <li>
            <strong>Wind-tunnel consistency</strong> — The reported{" "}
            <Tex>{String.raw`C_dA_0`}</Tex> is what you'd measure in a wind
            tunnel at 0° yaw.
          </li>
        </ul>
      </Section>
    </Article>
  );
}
