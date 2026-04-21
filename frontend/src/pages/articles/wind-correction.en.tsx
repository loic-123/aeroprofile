import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function WindCorrectionEn() {
  return (
    <Article title="Wind correction: from the weather API to wind-inverse">
      <P>
        Wind is the largest single source of error in the{" "}
        <Tex>{String.raw`C_dA`}</Tex> calculation. A 2 m/s gap between real and
        estimated wind produces roughly 50 W of error at 30 km/h — about 30% of
        the aerodynamic signal. The aero power error is quadratic
        in <Tex>{String.raw`V_{\text{air}}`}</Tex>: since{" "}
        <Tex>{String.raw`P_{\text{aero}} = \tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^3`}</Tex>,
        a small wind error is amplified to the cube in power. Here is how
        AeroProfile attacks this problem, layer by layer.
      </P>

      <Section title="Layer 1: Open-Meteo data">
        <P>
          Open-Meteo provides free historical weather data anywhere, any day.
          For each ride, AeroProfile pulls hour-by-hour: 10 m wind speed
          (<Tex>{String.raw`V_{10}`}</Tex>), direction (meteorological
          convention: where the wind blows from, 0° = North), temperature{" "}
          <Tex>{String.raw`T`}</Tex>, relative humidity{" "}
          <Tex>{String.raw`\phi`}</Tex>, and atmospheric pressure{" "}
          <Tex>{String.raw`p`}</Tex>.
        </P>
        <P>
          Air density is computed at each point via the gas-law equation:
        </P>
        <Formula>{String.raw`\rho = \frac{p - \phi\,p_{\text{sat}}(T)}{R_d\,T} + \frac{\phi\,p_{\text{sat}}(T)}{R_v\,T}`}</Formula>
        <P>
          where <Tex>{String.raw`R_d = 287.05\;\text{J/(kg·K)}`}</Tex> is the
          dry-air constant,{" "}
          <Tex>{String.raw`R_v = 461.5\;\text{J/(kg·K)}`}</Tex> the water-vapor
          constant, and <Tex>{String.raw`p_{\text{sat}}`}</Tex> the saturated
          vapor pressure (Magnus formula).
        </P>
        <P>
          Catch: the spatial resolution is about 10 km. Wind in a sheltered
          valley can be 3× weaker than on a ridge, but the API returns the same
          value for both.
        </P>
      </Section>

      <Section title="Layer 2: spatial tiling">
        <P>
          A single weather point at the center of a 100 km ride is not enough.
          AeroProfile splits the route into 5 km tiles and fetches one weather
          point per tile (up to 20 tiles).
        </P>
        <P>
          Data is interpolated between tiles via vector decomposition of the
          wind. We turn the pair{" "}
          <Tex>{String.raw`(V_w,\,\theta_w)`}</Tex> into East/North
          components:
        </P>
        <Formula>{String.raw`\begin{aligned}
u &= -V_w \sin(\theta_w) \quad &\text{(East component)} \\
v &= -V_w \cos(\theta_w) \quad &\text{(North component)}
\end{aligned}`}</Formula>
        <P>
          Linear interpolation is applied separately on{" "}
          <Tex>{String.raw`u`}</Tex> and <Tex>{String.raw`v`}</Tex>, and then
          we recompose:
        </P>
        <Formula>{String.raw`V_w = \sqrt{u^2 + v^2}, \qquad \theta_w = \text{atan2}(-u,\;-v)`}</Formula>
        <Note>
          You cannot interpolate angles directly! If one tile gives 359° and
          the next 1°, a naive interpolation yields 180° (due South) instead
          of 0° (North). The <Tex>{String.raw`(u,v)`}</Tex> decomposition
          solves this.
        </Note>
      </Section>

      <Section title="Layer 3: height correction (logarithmic profile)">
        <P>
          The weather API gives wind at 10 m height (WMO standard). A cyclist
          is about 1.3 m off the ground, where wind is slowed by the
          atmospheric boundary layer. Assuming neutral stability (no
          significant vertical thermal gradient), the logarithmic wind profile
          gives:
        </P>
        <Formula>{String.raw`V(z) = V_{\text{ref}} \cdot \frac{\ln(z / z_0)}{\ln(z_{\text{ref}} / z_0)}`}</Formula>
        <P>
          where <Tex>{String.raw`z_0`}</Tex> is the aerodynamic roughness
          length of the terrain:
        </P>
        <Formula>{String.raw`\begin{array}{lcl}
z_0 = 0.03\;\text{m} & \longrightarrow & \text{open country, short grass} \\
z_0 = 0.10\;\text{m} & \longrightarrow & \text{crops, low hedges} \\
z_0 = 0.25\;\text{m} & \longrightarrow & \text{bocage, tall hedges} \\
z_0 = 0.50\;\text{m} & \longrightarrow & \text{wooded or urban area}
\end{array}`}</Formula>
        <P>
          Numerical example for open terrain (
          <Tex>{String.raw`z_0 = 0.03`}</Tex> m,{" "}
          <Tex>{String.raw`z = 1.3`}</Tex> m,{" "}
          <Tex>{String.raw`z_{\text{ref}} = 10`}</Tex> m):
        </P>
        <Formula>{String.raw`\frac{V_{\text{cyclist}}}{V_{10}} = \frac{\ln(1.3\;/\;0.03)}{\ln(10\;/\;0.03)} = \frac{3.77}{5.81} \approx 0.65`}</Formula>
        <P>
          Result: wind at rider height is about 65% of the 10 m wind in open
          terrain. In urban areas (<Tex>{String.raw`z_0 = 0.5`}</Tex>) the
          ratio drops to ~0.40. This reduction factor has a direct impact on
          <Tex>{String.raw`V_{\text{air}}`}</Tex> and therefore on the
          <Tex>{String.raw`C_dA`}</Tex> estimate.
        </P>
      </Section>

      <Section title="Layer 4: projecting wind onto the direction of travel">
        <P>
          Wind comes from a direction <Tex>{String.raw`\theta_w`}</Tex>{" "}
          (meteorological convention: where it comes from, 0° = North,
          clockwise). The rider has a heading <Tex>{String.raw`\psi`}</Tex>{" "}
          (bearing) computed every second from GPS. The headwind component
          is:
        </P>
        <Formula>{String.raw`V_{\text{hw}} = V_w \cdot \cos\!\big(\theta_w - \psi\big)`}</Formula>
        <P>
          The air speed seen by the rider is then:
        </P>
        <Formula>{String.raw`V_{\text{air}} = V_{\text{ground}} + V_{\text{hw}}`}</Formula>
        <P>
          If <Tex>{String.raw`V_{\text{hw}} > 0`}</Tex>, there is a headwind
          and <Tex>{String.raw`V_{\text{air}} > V_{\text{ground}}`}</Tex>. If{" "}
          <Tex>{String.raw`V_{\text{hw}} < 0`}</Tex>, it's a tailwind
          and <Tex>{String.raw`V_{\text{air}} < V_{\text{ground}}`}</Tex>.
        </P>
        <P>
          Aerodynamic power becomes:
        </P>
        <Formula>{String.raw`P_{\text{aero}} = \tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^2\,V_{\text{ground}}`}</Formula>
        <Note>
          We separate <Tex>{String.raw`V_{\text{air}}^2`}</Tex> (felt drag)
          and <Tex>{String.raw`V_{\text{ground}}`}</Tex> (actual progress)
          because mechanical power comes from the aero force times ground
          speed.
        </Note>
      </Section>

      <Section title="Layer 5: wind-inverse (Bayesian estimation)">
        <P>
          Despite layers 1-4, API wind remains imprecise. The ultimate
          solution: estimate wind directly from ride data, exploiting the
          physics.
        </P>
        <P>
          The fundamental power balance ties measured power to unknown
          parameters:
        </P>
        <Formula>{String.raw`P_{\text{meas}} = \underbrace{\tfrac{1}{2}\,\rho\,C_dA\,V_{\text{air}}^2\,V_{\text{ground}}}_{\text{aero drag}} + \underbrace{C_{rr}\,m\,g\,V_{\text{ground}}}_{\text{rolling}} + \underbrace{m\,g\,\sin(\alpha)\,V_{\text{ground}}}_{\text{gravity}} + \underbrace{m\,a\,V_{\text{ground}}}_{\text{acceleration}}`}</Formula>
        <P>
          When the rider changes direction (loops, out-and-backs, corners),
          they expose their aerodynamic profile to the wind under different
          angles. A headwind raises the required power; a tailwind lowers it.
          Observing these variations lets the solver "guess" wind speed and
          direction.
        </P>
        <P>
          The solver minimizes, via maximum a posteriori (MAP), the weighted
          residuals with Gaussian priors on the parameters:
        </P>
        <Formula>{String.raw`\hat{\boldsymbol{\theta}} = \arg\min_{\boldsymbol{\theta}} \left[ \sum_{i=1}^{N} \frac{\big(P_{\text{meas},i} - P_{\text{mod},i}(\boldsymbol{\theta})\big)^2}{\sigma_P^2} + \sum_{k} \frac{(\theta_k - \mu_k)^2}{\sigma_k^2} \right]`}</Formula>
        <P>
          where <Tex>{String.raw`\boldsymbol{\theta}`}</Tex> groups the
          jointly estimated parameters:
        </P>
        <Formula>{String.raw`\boldsymbol{\theta} = \big\{\,C_dA,\;\; C_{rr},\;\; V_{w}^{(j)},\;\; \theta_{w}^{(j)}\;\big\}_{j=1}^{J}`}</Formula>
        <P>
          with <Tex>{String.raw`J`}</Tex> time segments of 30 minutes each.
          Priors are defined as:
        </P>
        <Formula>{String.raw`\begin{aligned}
C_dA &\sim \mathcal{N}\!\left(\mu_{C_dA},\; \sigma_{C_dA}^2\right) \\
C_{rr} &\sim \mathcal{N}\!\left(0.0035,\; 0.0012^2\right) \\
V_{w}^{(j)} &\sim \mathcal{N}\!\left(V_{w,\text{API}}^{(j)},\; (2\;\text{m/s})^2\right) \\
\theta_{w}^{(j)} &\sim \mathcal{N}\!\left(\theta_{w,\text{API}}^{(j)},\; (30°)^2\right)
\end{aligned}`}</Formula>
        <P>
          Open-Meteo wind is the starting point (Gaussian prior{" "}
          <Tex>{String.raw`\sigma = 2\;\text{m/s}`}</Tex>), not ground truth.
          The solver adjusts it to minimize the power residuals.
        </P>
        <P>
          Necessary condition: the rider must have changed heading enough
          (heading variance <Tex>{String.raw`\text{Var}(\psi) > 0.25`}</Tex>).
          On a 2 h straight climb, wind and{" "}
          <Tex>{String.raw`C_dA`}</Tex> are degenerate — wind stays fixed at
          the API value in that case.
        </P>
        <Warning>
          Wind-inverse cannot distinguish crosswind from a{" "}
          <Tex>{String.raw`C_dA`}</Tex> change (bike position). If you change
          position AND direction at the same time, the solver cannot separate
          the two effects. It's a fundamental identifiability limit of the
          model.
        </Warning>
      </Section>

      <Section title="Measured impact">
        <P>
          On our test rides, wind-inverse raises the{" "}
          <Tex>{String.raw`R^2`}</Tex> (power reconstruction quality) from
          ~0.50 to ~0.98. In terms of <Tex>{String.raw`C_dA`}</Tex>, the 95%
          confidence interval tightens from{" "}
          <Tex>{String.raw`\pm 0.04\;\text{m}^2`}</Tex> to{" "}
          <Tex>{String.raw`\pm 0.012\;\text{m}^2`}</Tex>. It's the biggest
          single improvement in the whole pipeline.
        </P>
        <P>
          Convergence of <Tex>{String.raw`C_dA`}</Tex> can be visualized in
          the dedicated chart: each solver iteration refines wind and
          aerodynamic coefficients simultaneously, until the{" "}
          <Tex>{String.raw`\chi^2`}</Tex> residual stabilizes.
        </P>
      </Section>
    </Article>
  );
}
