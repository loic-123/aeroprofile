import { Article, Section, Formula, Tex, Note, P } from "../../components/BlogLayout";

export default function PowerEquationEn() {
  return (
    <Article title="The cycling power equation: Martin et al. (1998)">
      <P>
        Every AeroProfile calculation rests on a single physical equation,
        published in 1998 by Martin, Milliken, Cobb, McFadden and Coggan. The
        equation ties the power you produce at the pedals to the forces
        opposing your forward motion. It was validated in the lab with a
        coefficient of determination R² = 0.97 and a standard error of only
        2.7 W on a track.
      </P>

      <Section title="The core idea">
        <P>
          When you pedal, your power meter measures how much energy per second
          you transfer to the road. That energy is spent overcoming five
          resistance sources:
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text">
          <li><strong>Aerodynamic drag</strong> — the air slowing you down</li>
          <li><strong>Rolling resistance</strong> — tire deformation on asphalt</li>
          <li><strong>Gravity</strong> — climbing costs energy, descending returns some</li>
          <li><strong>Acceleration</strong> — changing speed costs kinetic energy</li>
          <li><strong>Wheel bearings</strong> — hub friction</li>
        </ul>
      </Section>

      <Section title="The full equation">
        <Formula>
          {String.raw`P_{\text{measured}} \times \eta = P_{\text{aero}} + P_{\text{rolling}} + P_{\text{gravity}} + P_{\text{accel}} + P_{\text{bearings}}`}
        </Formula>
        <P>Each term expands to:</P>
        <Formula>
          {String.raw`P_{\text{aero}} = \frac{1}{2} \cdot C_d A \cdot \rho \cdot V_{\text{air}}^2 \cdot V_{\text{ground}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{rolling}} = C_{rr} \cdot m \cdot g \cdot \cos(\theta) \cdot V_{\text{ground}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{gravity}} = m \cdot g \cdot \sin(\theta) \cdot V_{\text{ground}}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{accel}} = (m + I_{\text{eff}}) \cdot a \cdot V_{\text{ground}} \quad \text{with } I_{\text{eff}} = 0.14 \text{ kg}`}
        </Formula>
        <Formula>
          {String.raw`P_{\text{bearings}} = V \cdot (91 + 8.7 \cdot V) \times 10^{-3} \quad \text{(Dahn et al.)}`}
        </Formula>
      </Section>

      <Section title="Every variable, explained">
        <P>
          <strong><Tex>{String.raw`\eta`}</Tex> (eta) = 0.977</strong> — drivetrain efficiency (chain, derailleur).
          Out of 100 W at the pedals, 97.7 W reach the wheel. The remaining 2.3%
          is lost to chain friction. AeroProfile uses a <Tex>{String.raw`\eta`}</Tex> that varies
          with power (Spicer et al. 2001):
        </P>
        <Formula>
          {String.raw`\eta(P) = 0.977 + 0.00003 \times (P - 150), \quad \text{clipped to } [0.95,\; 0.99]`}
        </Formula>
        <P>
          At low power the chain is slacker → more relative friction.
          At high power efficiency rises slightly.
        </P>
        <P>
          <strong><Tex>{String.raw`C_d A`}</Tex></strong> — the drag coefficient × frontal area (m²).
          This is <strong>what we're solving for</strong>. The lower it is, the
          less air resistance you offer.
        </P>
        <P>
          <strong><Tex>{String.raw`\rho`}</Tex> (rho)</strong> — air density in kg/m³. Varies with
          altitude (~1.22 at sea level, ~1.05 at 1500 m), temperature and
          humidity. AeroProfile computes it at each GPS point via:
        </P>
        <Formula>
          {String.raw`\rho = \frac{P_{\text{dry}}}{R_d \cdot T} + \frac{P_{\text{vapor}}}{R_v \cdot T}`}
        </Formula>
        <P>
          where <Tex>{String.raw`P_{\text{dry}}`}</Tex> is dry air partial pressure, <Tex>{String.raw`P_{\text{vapor}}`}</Tex> the
          water vapor pressure, <Tex>{String.raw`R_d = 287.05`}</Tex> and <Tex>{String.raw`R_v = 461.5`}</Tex> J/(kg·K).
        </P>
        <P>
          <strong><Tex>{String.raw`V_{\text{air}}`}</Tex></strong> — your speed relative to the air, not
          the ground. If you ride at 30 km/h into a 10 km/h headwind,
          <Tex>{String.raw`V_{\text{air}} = 40`}</Tex> km/h but <Tex>{String.raw`V_{\text{ground}} = 30`}</Tex> km/h.
        </P>
        <P>
          <strong><Tex>{String.raw`C_{rr}`}</Tex></strong> — rolling resistance coefficient.
          Depends on tires, pressure and surface. Typically 0.003 to 0.005 on
          smooth tarmac.
        </P>
        <P>
          <strong>m</strong> — total rider + bike mass in kg.
        </P>
        <P>
          <strong><Tex>{String.raw`g = 9.80665`}</Tex> m/s²</strong> — gravitational acceleration.
        </P>
        <P>
          <strong><Tex>{String.raw`\theta`}</Tex> (theta)</strong> — slope angle.
          5% grade = <Tex>{String.raw`\arctan(0.05) \approx 2.86°`}</Tex>.
        </P>
        <P>
          <strong>a</strong> — your acceleration in m/s². Positive when you
          speed up, negative when you slow down.
        </P>
        <P>
          <strong>0.14 kg</strong> — effective wheel mass from rotational
          inertia. A spinning wheel has more inertia than a point mass — extra
          energy is needed to accelerate it:
          <Tex>{String.raw`I_{\text{eff}} = I / r^2 \approx 0.14`}</Tex> kg (Martin 1998).
        </P>
      </Section>

      <Section title="A subtle point: V_air² × V_ground, not V_air³">
        <P>
          Aerodynamic force scales with <Tex>{String.raw`V_{\text{air}}^2`}</Tex>. But
          power = force × speed, and the relevant speed here is <Tex>{String.raw`V_{\text{ground}}`}</Tex>
          (that's the speed at which the bike advances). Hence:
        </P>
        <Formula>
          {String.raw`P_{\text{aero}} = F_{\text{drag}} \times V_{\text{ground}} = \left(\frac{1}{2} C_d A \cdot \rho \cdot V_{\text{air}}^2\right) \times V_{\text{ground}}`}
        </Formula>
        <Note>
          A classic mistake is to put <Tex>{String.raw`V_{\text{air}}^3`}</Tex> in the power
          equation. Into a 20 km/h headwind, <Tex>{String.raw`V_{\text{air}}^3`}</Tex> overestimates
          power by ~20% compared with <Tex>{String.raw`V_{\text{air}}^2 \times V_{\text{ground}}`}</Tex>.
        </Note>
      </Section>

      <Section title="The 5-second power smoothing">
        <P>
          Martin et al. recommend smoothing power over a pedal stroke (~1 s) to
          cancel torque oscillations. AeroProfile goes further with a{" "}
          <strong>centered 5-second moving average</strong>. This is consistent
          with the quasi-steady assumption of the model: the model predicts
          power "at equilibrium" for a given speed and slope, not instantaneous
          power mid-sprint or during micro-accelerations.
        </P>
      </Section>

      <Section title="How AeroProfile uses this equation">
        <P>
          Everything is known except <Tex>{String.raw`C_d A`}</Tex> and <Tex>{String.raw`C_{rr}`}</Tex>: power is measured
          by your meter, speed by GPS, altitude by the barometer, wind from the
          weather API, air density from the calculation. The solver adjusts
          <Tex>{String.raw`C_d A`}</Tex> and <Tex>{String.raw`C_{rr}`}</Tex> until the equation best predicts the measured
          power:
        </P>
        <Formula>
          {String.raw`\min_{C_d A,\, C_{rr}} \sum_{i=1}^{N} \left( P_{\text{model}}(i) - P_{\text{measured}}(i) \right)^2`}
        </Formula>
      </Section>

      <Section title="Reference">
        <P>
          Martin JC, Milliken DL, Cobb JE, McFadden KL, Coggan AR. (1998).
          "Validation of a Mathematical Model for Road Cycling Power."
          <em> Journal of Applied Biomechanics</em>, 14(3), 276–291.
        </P>
        <P>
          Validated in the lab with R² = 0.97 and an error of 2.7 W
          on a velodrome under controlled conditions.
        </P>
      </Section>
    </Article>
  );
}
