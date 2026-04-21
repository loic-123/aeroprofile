import { Article, Section, Formula, Tex, Note, Warning, P } from "../../components/BlogLayout";

export default function IntervalsIntegrationEn() {
  return (
    <Article title="Intervals.icu integration: analyze a year of rides in one click">
      <P>
        Instead of uploading your .FIT files one by one, AeroProfile can
        connect directly to your Intervals.icu account and automatically
        analyze all your rides over the period of your choice.
      </P>

      <Section title="Profiles: save your setups">
        <P>
          Before you even connect, the <strong>ProfilePicker</strong> at
          the top of the page lets you save your whole setup in a{" "}
          <em>profile</em>: Intervals.icu API key, athlete id, mass, bike,
          position, Crr, nRMSE threshold, and <em>all</em> the ride list
          filters (date range, distance, max elevation gain, average
          slope, min duration, group-ride exclusion).
        </P>
        <P>
          A <strong>"Me"</strong> profile is pre-created with sensible
          starting values (75 kg, road, aero-drops position, Crr auto).
          It cannot be deleted but you can overwrite its parameters.
        </P>
        <ul className="list-disc ml-6 space-y-1 text-text text-sm">
          <li><strong>Click a profile chip</strong> → loads its parameters into the form.</li>
          <li><strong>"+ New"</strong> → creates a new profile from the current parameters.</li>
          <li><strong>"Save"</strong> → writes the current parameters into the active profile.</li>
          <li><strong>"Reload"</strong> → reverts to the active profile's stored parameters (discards unsaved tweaks).</li>
        </ul>
        <Note>
          The profile <strong>key</strong> is also used as the{" "}
          <code>athleteKey</code> on each history entry it produces.
          This ensures the <em>stability timeline</em> and{" "}
          <em>conformal prediction</em> do not mix data from several
          riders or setups.
        </Note>
      </Section>

      <Section title="How it works">
        <P>
          Intervals.icu is a free training-analysis platform that syncs
          your activities from Garmin, Strava, Wahoo, etc. It exposes a
          REST API that AeroProfile uses to:
        </P>
        <ol className="list-decimal ml-6 space-y-1 text-text">
          <li><strong>Connect</strong> with your API key (found in Settings → Developer Settings)</li>
          <li><strong>List</strong> all your activities over the chosen period</li>
          <li><strong>Filter</strong>: keep only cycling rides, outdoor, with power</li>
          <li><strong>Download</strong> the .FIT file of each retained ride</li>
          <li><strong>Analyze</strong> each ride with the full pipeline (weather, filtering, solver)</li>
          <li><strong>Aggregate</strong> the results into a weighted mean CdA</li>
        </ol>
      </Section>

      <Section title="The 4 filtering levels">
        <P>
          Each activity passes through 4 selection steps, from the
          coarsest to the finest:
        </P>
        <ul className="list-disc ml-6 space-y-2 text-text">
          <li><strong>Level 1 — Automatic (server)</strong>: Type = Ride or GravelRide,
            power meter required, outdoor only (excludes Zwift, trainer)</li>
          <li><strong>Level 2 — User sliders (real-time)</strong>: Distance 30–500 km,
            max elevation gain 2000 m, min duration 60 min</li>
          <li><strong>Level 3 — Post-analysis (automatic)</strong>: nRMSE &gt; 45% → ride excluded
            from the average. CdA outside the selected bike type's range → ride excluded.</li>
          <li><strong>Level 4 — Per point within each ride</strong>: 13 filters (braking,
            cornering, drafting, etc.) + iterative pass 2 (hybrid VE drift)</li>
        </ul>
      </Section>

      <Section title="Bike type and CdA bounds">
        <P>
          AeroProfile offers three bike types, each with realistic CdA
          bounds and a matching Bayesian prior. Bike type affects both
          the estimation (prior + solver bounds) and the exclusion of
          rides whose CdA falls outside the bounds:
        </P>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs">
                <th className="py-2">Type</th>
                <th className="py-2 text-right">CdA min</th>
                <th className="py-2 text-right">CdA max</th>
                <th className="py-2">Typical positions</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/30"><td className="py-1.5">Road</td><td className="text-right">0.22</td><td className="text-right">0.50</td><td className="font-sans text-muted">Drops → tops</td></tr>
              <tr className="border-b border-border/30"><td className="py-1.5">TT / Triathlon</td><td className="text-right">0.17</td><td className="text-right">0.30</td><td className="font-sans text-muted">Extensions → aero hoods</td></tr>
              <tr><td className="py-1.5">MTB / Gravel</td><td className="text-right">0.35</td><td className="text-right">0.60</td><td className="font-sans text-muted">Upright position, wide tires</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Why analyze many rides?">
        <P>
          A single ride gives a CdA with ±0.03-0.05 m² uncertainty (from
          wind, drafting, data quality). Analyzing 20, 30 or 50 rides,
          the weighted mean converges to the "true" CdA with much lower
          uncertainty. The law of large numbers guarantees:
        </P>
        <Formula>
          {String.raw`\text{95\% CI} = \pm 1.96 \times \frac{\sigma_{\text{inter-ride}}}{\sqrt{N}}`}
        </Formula>
        <P>
          With <Tex>{String.raw`N = 30`}</Tex> rides and{" "}
          <Tex>{String.raw`\sigma = 0.03`}</Tex> m², the 95% CI drops
          to <Tex>{String.raw`\pm 0.011`}</Tex> m² — enough to detect a
          position or equipment change.
        </P>
      </Section>

      <Section title="Quality weighting">
        <P>
          Not all rides are equal. AeroProfile weights each ride by its
          quality (nRMSE) and data volume:
        </P>
        <Formula>
          {String.raw`w_i = N_{\text{valid},i} \times q_i \qquad \text{where } q_i = 3 - 2 \cdot \frac{\text{nRMSE}_i - \text{nRMSE}_{\min}}{\text{nRMSE}_{\max} - \text{nRMSE}_{\min}}`}
        </Formula>
        <Formula>
          {String.raw`\overline{C_dA} = \frac{\sum_i C_dA_i \cdot w_i}{\sum_i w_i}`}
        </Formula>
        <P>
          The best ride (lowest nRMSE) gets a 3× multiplier, the worst
          retained ride 1×. Catastrophic rides (nRMSE &gt; 45%) are
          excluded entirely.
        </P>
      </Section>

      <Section title="Local cache">
        <P>
          Each analyzed ride is saved in the browser's localStorage
          (key = activity_id + mass + Crr). If you rerun the analysis
          with the same parameters, results load instantly without any
          API call.
        </P>
        <P>
          The cache is invalidated if you change mass or fixed Crr. You
          can also disable it manually with the toggle in the settings.
        </P>
      </Section>

      <Section title="Security">
        <P>
          Your API key is stored in your browser's localStorage — it
          never leaves your machine except for requests to the
          AeroProfile backend (CORS proxy). The key is not stored
          server-side.
        </P>
        <Warning>
          Do not share your API key. You can regenerate it at any time
          in Intervals.icu → Settings → Developer Settings.
        </Warning>
      </Section>
    </Article>
  );
}
