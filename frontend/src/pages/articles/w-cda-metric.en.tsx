import { Article, Section, Formula, Note, P, Tex } from "../../components/BlogLayout";

export default function WCdaMetricEn() {
  return (
    <Article title="W/CdA: the rouleur's metric (the W/kg of flat terrain)">
      <P>
        Everyone knows <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> — power to
        weight, the metric that determines climbing speed. But on the flat,
        weight barely matters. What matters is{" "}
        <strong><Tex>{String.raw`W\!/\!C_dA`}</Tex></strong>: power over
        aerodynamic drag.
      </P>

      <Section title="The physics">
        <P>
          On the flat, at speed, power is spent almost entirely overcoming
          air. The force balance simplifies to:
        </P>
        <Formula>{String.raw`P \approx \frac{1}{2} \, C_dA \, \rho \, V^3`}</Formula>
        <P>
          Solving for <Tex>{String.raw`V`}</Tex>:
        </P>
        <Formula>{String.raw`V \approx \left(\frac{2P}{C_dA \cdot \rho}\right)^{\!1/3}`}</Formula>
        <P>
          We can factor out the <Tex>{String.raw`W\!/\!C_dA`}</Tex> ratio
          (power over drag, in <Tex>{String.raw`\text{W/m}^2`}</Tex>):
        </P>
        <Formula>{String.raw`V \approx \left(\frac{2 \cdot (W\!/\!C_dA)}{\rho}\right)^{\!1/3}`}</Formula>
        <P>
          Higher <Tex>{String.raw`W\!/\!C_dA`}</Tex>, higher{" "}
          <Tex>{String.raw`V`}</Tex>. It's the single metric that predicts
          your flat-terrain speed.
        </P>
        <Note>
          The relationship is a cube root: doubling your{" "}
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> only raises your speed by{" "}
          <Tex>{String.raw`2^{1/3} \approx 26\%`}</Tex>. That's why marginal
          aero gains are so precious at the top level.
        </Note>
      </Section>

      <Section title="W/CdA vs W/kg: two different worlds">
        <P>
          Climbing is gravity-dominated, and speed scales
          with <Tex>{String.raw`W\!/\!\text{kg}`}</Tex>:
        </P>
        <Formula>{String.raw`V_{\text{climb}} \approx \frac{P}{m \, g \, \sin(\theta)} \propto \frac{W}{\text{kg}}`}</Formula>
        <P>
          On the flat, aerodynamics dominates and speed scales
          with <Tex>{String.raw`W\!/\!C_dA`}</Tex>:
        </P>
        <Formula>{String.raw`V_{\text{flat}} \approx \left(\frac{2 \cdot W\!/\!C_dA}{\rho}\right)^{\!1/3}`}</Formula>
        <P>
          A light climber has an excellent{" "}
          <Tex>{String.raw`W\!/\!\text{kg}`}</Tex> but may have a mediocre{" "}
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> (few absolute watts). A heavy,
          powerful rouleur can have an excellent{" "}
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> despite a modest{" "}
          <Tex>{String.raw`W\!/\!\text{kg}`}</Tex>.
        </P>
      </Section>

      <Section title="Lookup table">
        <P>
          Values computed at{" "}
          <Tex>{String.raw`\rho = 1.2 \;\text{kg/m}^3`}</Tex> (sea level,
          15 °C), no wind, flat terrain:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2"><Tex>{String.raw`W\!/\!C_dA`}</Tex></th>
                <th className="py-2">Flat speed</th>
                <th className="py-2">Typical profile</th>
                <th className="py-2 text-muted">Example</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td>300</td><td>33.2 km/h</td><td className="font-sans text-muted">Recreational rider</td><td className="font-sans text-muted text-xs">100 W / 0.33</td></tr>
              <tr className="border-b border-border/30"><td>400</td><td>36.5 km/h</td><td className="font-sans text-muted">Strong endurance amateur</td><td className="font-sans text-muted text-xs">140 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>500</td><td>39.3 km/h</td><td className="font-sans text-muted">Competitive amateur</td><td className="font-sans text-muted text-xs">175 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>600</td><td>41.7 km/h</td><td className="font-sans text-muted">Regional racer</td><td className="font-sans text-muted text-xs">210 W / 0.35</td></tr>
              <tr className="border-b border-border/30"><td>700</td><td>43.9 km/h</td><td className="font-sans text-muted">Pro continental rouleur</td><td className="font-sans text-muted text-xs">210 W / 0.30</td></tr>
              <tr className="border-b border-border/30"><td>900</td><td>47.7 km/h</td><td className="font-sans text-muted">Pro TT</td><td className="font-sans text-muted text-xs">300 W / 0.33 or 180 W / 0.20</td></tr>
              <tr><td>1200</td><td>52.6 km/h</td><td className="font-sans text-muted">Hour record</td><td className="font-sans text-muted text-xs">400 W / 0.20 (Campenaerts)</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Sensitivity: W vs CdA">
        <P>
          How much does each lever affect speed? We can compute the
          elasticities. Since{" "}
          <Tex>{String.raw`V \propto P^{1/3} \cdot C_dA^{-1/3}`}</Tex>:
        </P>
        <Formula>{String.raw`\frac{\Delta V}{V} \approx \frac{1}{3} \cdot \frac{\Delta P}{P} \approx -\frac{1}{3} \cdot \frac{\Delta C_dA}{C_dA}`}</Formula>
        <P>
          Both levers have the same relative weight (factor 1/3). But in
          practice:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            Gaining <Tex>{String.raw`+10\%`}</Tex> of power takes months of
            focused training.
          </li>
          <li>
            Cutting <Tex>{String.raw`C_dA`}</Tex>{" "}
            by <Tex>{String.raw`10\%`}</Tex> can happen in a single bike fit
            session (drops position, aero helmet, skinsuit).
          </li>
        </ul>
        <P>
          At the same percentage, the aero gain is "free" in terms of effort.
        </P>
      </Section>

      <Section title="How to improve your W/CdA">
        <P>
          Two levers:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li>
            <strong>Raise W</strong> — training, FTP, nutrition. Hardest but
            most universal.
          </li>
          <li>
            <strong>Lower <Tex>{String.raw`C_dA`}</Tex></strong> — position,
            equipment, aero helmet, skinsuit. "Free" gains in equivalent
            watts.
          </li>
        </ul>
        <P>
          Worked example: a rider at 200 W
          and <Tex>{String.raw`C_dA = 0.35`}</Tex>{" "}
          has <Tex>{String.raw`W\!/\!C_dA = 571`}</Tex> → 40.0 km/h. If they
          drop to the hoods (<Tex>{String.raw`C_dA = 0.30`}</Tex>) without
          gaining a single watt: <Tex>{String.raw`W\!/\!C_dA = 667`}</Tex>{" "}
          → 43.2 km/h. That's +3.2 km/h for free, just by changing position.
        </P>
        <Formula>{String.raw`\Delta V = \left(\frac{2 \times 667}{1.2}\right)^{\!1/3} - \left(\frac{2 \times 571}{1.2}\right)^{\!1/3} = 12.0 - 11.1 = 0.9 \;\text{m/s} \approx 3.2 \;\text{km/h}`}</Formula>
        <Note>
          <Tex>{String.raw`W\!/\!C_dA`}</Tex> is displayed in the "Analyze"
          and "Intervals.icu" modes when several rides are analysed. It's
          computed as time-weighted mean power divided by weighted mean{" "}
          <Tex>{String.raw`C_dA`}</Tex>.
        </Note>
      </Section>

      <Section title="Air-density impact">
        <P>
          Density <Tex>{String.raw`\rho`}</Tex> enters the formula. It varies
          with altitude, temperature, and atmospheric pressure:
        </P>
        <Formula>{String.raw`\rho = \frac{p}{R_{\text{air}} \cdot T} \approx \frac{p}{287.05 \cdot T}`}</Formula>
        <P>
          At altitude (e.g. Mexico City,
          2250 m, <Tex>{String.raw`\rho \approx 0.98`}</Tex>), speed for the
          same <Tex>{String.raw`W\!/\!C_dA`}</Tex> is{" "}
          <Tex>{String.raw`\sim 7\%`}</Tex> higher than at sea level. That's
          why hour records are often attempted at altitude.
        </P>
      </Section>
    </Article>
  );
}
