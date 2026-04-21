import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function CdaWhatIsItEn() {
  return (
    <Article title="CdA: what is it and why does it matter?">
      <P>
        <Tex>{String.raw`C_dA`}</Tex> (pronounced "see-dee-ay") is THE number
        that sums up your aerodynamic profile on the bike. Two riders with the
        same power but different <Tex>{String.raw`C_dA`}</Tex> won't reach the
        same speed on the flat — and the difference is huge.
      </P>

      <Section title="Cd × A: two components">
        <P>
          <Tex>{String.raw`C_dA`}</Tex> is the product of two physical
          quantities:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong><Tex>{String.raw`C_d`}</Tex></strong> (drag coefficient) —
            a dimensionless number that describes how air flows around you. A
            streamlined shape gives a low <Tex>{String.raw`C_d`}</Tex>; a blunt
            shape gives a high <Tex>{String.raw`C_d`}</Tex>. For reference, a
            smooth sphere has <Tex>{String.raw`C_d \approx 0.47`}</Tex>, an
            airfoil <Tex>{String.raw`C_d \approx 0.04`}</Tex>, and a cyclist
            typically sits around <Tex>{String.raw`C_d \approx 0.6 \text{--} 0.9`}</Tex>.
          </li>
          <li>
            <strong><Tex>{String.raw`A`}</Tex></strong> (frontal area, m²) —
            the surface you expose to the wind, seen from the front. The
            taller you stand or the more upright you sit, the larger{" "}
            <Tex>{String.raw`A`}</Tex>. For an adult cyclist,{" "}
            <Tex>{String.raw`A`}</Tex> ranges
            from <Tex>{String.raw`\sim 0.35 \;\text{m}^2`}</Tex> (aggressive TT
            position) to <Tex>{String.raw`\sim 0.55 \;\text{m}^2`}</Tex>{" "}
            (upright, hands on the tops).
          </li>
        </ul>
        <P>
          In practice, we never separate <Tex>{String.raw`C_d`}</Tex>{" "}
          from <Tex>{String.raw`A`}</Tex>: we always measure the
          product <Tex>{String.raw`C_dA`}</Tex>, in m². That's what
          AeroProfile estimates. Mathematically:
        </P>
        <Formula>{String.raw`C_dA = C_d \times A \quad [\text{m}^2]`}</Formula>
      </Section>

      <Section title="Orders of magnitude">
        <P>
          Typical wind-tunnel values (Debraux et al. 2011, Garcia-Lopez et al.
          2008). The "Watts" column is the power needed to overcome aero drag
          alone at 40 km/h:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Position</th>
                <th className="py-2 text-right"><Tex>{String.raw`C_dA`}</Tex> (m²)</th>
                <th className="py-2 text-right">Watts @ 40 km/h</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5">Pro TT (Superman)</td><td className="text-right">0.17 – 0.20</td><td className="text-right text-teal">145 – 170</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Amateur TT</td><td className="text-right">0.21 – 0.25</td><td className="text-right text-teal">179 – 213</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Road, drops</td><td className="text-right">0.28 – 0.32</td><td className="text-right text-teal">239 – 273</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Road, hoods</td><td className="text-right">0.32 – 0.38</td><td className="text-right text-teal">273 – 324</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">Road, tops</td><td className="text-right">0.38 – 0.45</td><td className="text-right text-teal">324 – 384</td></tr>
              <tr><td className="py-1.5">MTB / city</td><td className="text-right">0.45 – 0.55</td><td className="text-right text-teal">384 – 469</td></tr>
            </tbody>
          </table>
        </div>
        <Note>
          These values are for still-air conditions
          (<Tex>{String.raw`\text{yaw} = 0°`}</Tex>). In real conditions with
          crosswind, the effective <Tex>{String.raw`C_dA`}</Tex> can be 5-15%
          higher (see the yaw article).
        </Note>
      </Section>

      <Section title="Why 0.01 of CdA matters">
        <P>
          The aerodynamic drag force is{" "}
          <Tex>{String.raw`F_{\text{aero}} = \tfrac{1}{2} \, C_dA \, \rho \, V^2`}</Tex>,
          and the power needed to overcome it is{" "}
          <Tex>{String.raw`P_{\text{aero}} = F_{\text{aero}} \times V`}</Tex>,
          i.e.:
        </P>
        <Formula>{String.raw`P_{\text{aero}} = \frac{1}{2} \, C_dA \, \rho \, V^3`}</Formula>
        <P>
          Power grows with the <strong>cube</strong> of the speed. A small
          change in <Tex>{String.raw`C_dA`}</Tex> has a disproportionate
          impact at high speed. At 40 km/h
          (<Tex>{String.raw`V = 11.11 \;\text{m/s}`}</Tex>) with a standard
          air density <Tex>{String.raw`\rho = 1.2 \;\text{kg/m}^3`}</Tex>:
        </P>
        <Formula>{String.raw`\Delta P = \frac{1}{2} \times \Delta C_dA \times \rho \times V^3 = \frac{1}{2} \times \Delta C_dA \times 1.2 \times 11.11^3 \approx 823 \times \Delta C_dA`}</Formula>
        <P>
          So <Tex>{String.raw`\Delta C_dA = 0.01 \;\text{m}^2`}</Tex>{" "}
          corresponds to roughly <strong>8.2 W</strong> saved, or ~0.4 km/h
          faster at the same power.
        </P>
        <P>
          Over a 40 km time trial, 0.01 of <Tex>{String.raw`C_dA`}</Tex>{" "}
          is ~20 seconds. Over an Ironman bike leg (180 km), it's ~2 minutes.
        </P>
      </Section>

      <Section title="Where does the physical formula come from?">
        <P>
          The force-balance model on the flat reads:
        </P>
        <Formula>{String.raw`P \cdot \eta = \underbrace{\frac{1}{2} \, C_dA \, \rho \, V_{\text{air}}^2 \cdot V}_{\text{aero drag}} + \underbrace{C_{rr} \, m \, g \, V}_{\text{rolling}} + \underbrace{m \, g \, \sin(\theta) \, V}_{\text{gravity}} + \underbrace{m \, \frac{dV}{dt} \, V}_{\text{acceleration}}`}</Formula>
        <P>
          where <Tex>{String.raw`\eta`}</Tex> is the drivetrain efficiency
          (~0.97), <Tex>{String.raw`C_{rr}`}</Tex> the rolling-resistance
          coefficient, <Tex>{String.raw`m`}</Tex> the total mass (rider +
          bike), <Tex>{String.raw`\theta`}</Tex> the slope, and{" "}
          <Tex>{String.raw`V_{\text{air}}`}</Tex> the relative air speed.
          This is the equation AeroProfile solves by least squares to
          estimate <Tex>{String.raw`C_dA`}</Tex>{" "}
          and <Tex>{String.raw`C_{rr}`}</Tex>.
        </P>
      </Section>

      <Section title="How to improve your CdA">
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Position</strong> — the most powerful lever. Lower the
            head, tuck the elbows, flatten the back. Worth up
            to <Tex>{String.raw`\Delta C_dA \approx -0.04`}</Tex> on its own.
          </li>
          <li>
            <strong>Aero helmet</strong>{" "}
            — <Tex>{String.raw`\Delta C_dA \approx -0.01 \text{ to } {-0.02}`}</Tex>{" "}
            vs a vented road helmet.
          </li>
          <li>
            <strong>Fitted clothing / skinsuit</strong> — a flappy jersey can
            add <Tex>{String.raw`+0.01 \;\text{m}^2`}</Tex>{" "}
            of <Tex>{String.raw`C_dA`}</Tex>.
          </li>
          <li>
            <strong>Deep-section wheels</strong>{" "}
            — <Tex>{String.raw`\Delta C_dA \approx -0.005 \text{ to } {-0.015}`}</Tex>{" "}
            depending on rim depth.
          </li>
          <li>
            <strong>Hand position</strong> — drops vs hoods
            = <Tex>{String.raw`\Delta C_dA \approx -0.04`}</Tex>.
          </li>
        </ul>
      </Section>

      <Section title="W/CdA: the rouleur's metric">
        <P>
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> is the aero analogue
          of <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> for climbers. It's the
          ratio that determines your flat-terrain speed. Neglecting rolling
          resistance and slope:
        </P>
        <Formula>{String.raw`V_{\text{flat}} \approx \left( \frac{2 \, P}{C_dA \cdot \rho} \right)^{1/3} = \left( \frac{2 \cdot W\!/\!C_dA}{\rho} \right)^{1/3}`}</Formula>
        <P>
          Example: 200 W with <Tex>{String.raw`C_dA = 0.32`}</Tex>{" "}
          and <Tex>{String.raw`\rho = 1.2`}</Tex>:
        </P>
        <Formula>{String.raw`\frac{W}{C_dA} = \frac{200}{0.32} = 625 \qquad \Rightarrow \qquad V = \left(\frac{2 \times 625}{1.2}\right)^{1/3} = 10.09 \;\text{m/s} \approx 36.3 \;\text{km/h}`}</Formula>
      </Section>
    </Article>
  );
}
