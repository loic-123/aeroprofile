import { Article, Section, Formula, Note, Warning, P, Tex } from "../../components/BlogLayout";

export default function PowerMeterQuality() {
  return (
    <Article title="Le capteur de puissance : la source d'erreur que le solveur ne peut pas corriger">
      <P>
        AeroProfile suppose que la puissance mesurée par votre capteur est{" "}
        <em>vraie</em>. Tout le pipeline — filtrage, solveurs, virtual
        elevation, priors bayésiens — traite les watts comme une observation
        fiable. Si votre capteur lit 10% trop haut, le solveur compense en
        poussant <Tex>{String.raw`C_dA`}</Tex> ou <Tex>{String.raw`C_{rr}`}</Tex>{" "}
        aux bornes physiques pour équilibrer l'équation de puissance. Résultat :
        un CdA apparemment "solide" qui est en fait le symptôme d'un capteur
        biaisé.
      </P>
      <P>
        Cet article explique pourquoi nous classifions les capteurs par qualité
        et pourquoi nous calculons un <strong>ratio de calibration</strong>{" "}
        indépendant du solveur, qui peut détecter un biais même quand le fit du
        modèle est excellent.
      </P>

      <Section title="Les deux modes d'échec">
        <P>
          Deux catégories de capteurs donnent des résultats systématiquement
          moins reproductibles :
        </P>

        <h4 className="font-semibold mt-4 mb-1">Capteurs mono-jambe (left-only)</h4>
        <P>
          Les modèles comme le <strong>4iiii Precision</strong>,{" "}
          <strong>Stages gauche</strong> ou{" "}
          <strong>Rotor InPower single-side</strong> mesurent uniquement la
          manivelle gauche et multiplient par 2. Ils supposent donc{" "}
          <em>symmétrie parfaite L/R</em>, ce qui n'est vrai pour personne. Une
          étude de Bini et Hume (2014, <em>Journal of Biomechanics</em>) a
          mesuré une asymétrie L/R moyenne de <strong>5 à 15%</strong> chez des
          cyclistes amateurs, qui s'amplifie avec la fatigue et varie selon
          l'effort (montée vs plat, assis vs danseuse).
        </P>
        <P>
          Conséquence : la puissance "totale" reportée par le capteur dérive
          dans une sortie, et diffère d'une sortie à l'autre selon la
          fatigue/position. Le solveur ne peut pas distinguer cette dérive d'un
          changement de CdA.
        </P>

        <h4 className="font-semibold mt-4 mb-1">Dérive de température (zero-offset)</h4>
        <P>
          Les jauges de déformation (strain gauges) de la plupart des capteurs
          ont un zéro qui dérive avec la température : le capteur lit "X watts"
          même au repos, où l'intensité réelle est 0. Les capteurs pédales
          modernes (<strong>Favero Assioma</strong>, <strong>Garmin Rally</strong>,{" "}
          <strong>Wahoo Powrlink</strong>) recalibrent ce zéro{" "}
          <strong>automatiquement en roue libre</strong>. Les capteurs mono-jambe{" "}
          <em>n'en sont pas toujours capables</em> — il faut alors lancer un
          "zero-offset" manuel avant chaque sortie.
        </P>
        <Warning>
          Sans zero-offset, une variation de 10°C entre le stockage et la
          sortie peut facilement introduire ±15 W d'offset, soit{" "}
          <Tex>{String.raw`\pm 0.05\;m^2`}</Tex> sur votre CdA — plus que les
          gains d'une changement de position ou d'équipement.
        </Warning>
      </Section>

      <Section title="Classification qualité">
        <P>
          AeroProfile regarde le champ <code>power_meter</code> retourné par
          Intervals.icu (qui mirror la chaîne ANT+ écrite dans le fichier FIT)
          et le classe parmi :
        </P>
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Qualité</th>
                <th className="py-2">Type</th>
                <th className="py-2">Exemples</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1 text-teal font-semibold">high</td>
                <td>Pédales double, spiders</td>
                <td>Favero Assioma (Duo, Pro), Garmin Rally, SRM, Quarq, Power2Max</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-warn font-semibold">medium</td>
                <td>Pédales ancienne génération, trainers</td>
                <td>Favero bePro 1ère gen, Tacx Neo, Wahoo KICKR</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-coral font-semibold">low</td>
                <td>Mono-jambe crank</td>
                <td>4iiii Precision, Stages left, Rotor InPower L</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 text-muted font-semibold">unknown</td>
                <td>Pas de metadata</td>
                <td>FIT ré-encodé par une plateforme tierce, capteur générique</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Ratio de calibration : un test indépendant du solveur">
        <P>
          Même avec un capteur de bonne qualité, l'utilisateur peut l'avoir mal
          calibré une fois (zéro offset fait pendant que les pédales tournaient,
          température différente…). Pour détecter ce type de dérive{" "}
          <em>sans faire confiance au solveur</em>, nous calculons un ratio
          physique sur les portions plates et pédalées de la ride :
        </P>
        <Formula>{String.raw`\text{ratio} = \frac{\overline{P_{\text{mesuré}}}}{\overline{P_{\text{théorique}}(C_{dA,\text{prior}},\; C_{rr}=0.005)}}`}</Formula>
        <P>
          où <Tex>{String.raw`P_{\text{théorique}}`}</Tex> est calculé par le
          modèle Martin et al. (1998) avec un CdA "raisonnable" pour le type de
          vélo choisi (0.30 pour du route, 0.22 pour du CLM, etc.) et un Crr
          asphalte standard de 0.005. La moyenne porte sur les points vérifiant{" "}
          <Tex>{String.raw`|\text{pente}| < 2\%`}</Tex> et{" "}
          <Tex>{String.raw`P > 50\;W`}</Tex> (pas de descente en roue libre).
        </P>
        <P>
          Un ratio de 1.00 signifie que la puissance mesurée correspond
          exactement à ce qu'un cycliste "moyen" produirait dans ces conditions.
          Un ratio de 1.40 signifie que le capteur lit 40% plus haut que
          prévu — soit le cycliste est au-dessus de la moyenne, soit le capteur
          est biaisé. Dans les deux cas, le solveur va devoir compenser.
        </P>
        <Note>
          <strong>Seuils utilisés par AeroProfile</strong> :
          <ul className="list-disc pl-5 mt-1 text-sm">
            <li><span className="text-coral font-mono">ratio &gt; 1.35</span> → avertissement fort "capteur probablement mal calibré, recalibrer avant la prochaine sortie"</li>
            <li><span className="text-warn font-mono">1.20 &lt; ratio ≤ 1.35</span> → avertissement doux</li>
            <li><span className="text-teal font-mono">0.80 ≤ ratio ≤ 1.20</span> → tout va bien</li>
            <li><span className="text-warn font-mono">ratio &lt; 0.80</span> → capteur sous-estimé, ou vent arrière majeur</li>
          </ul>
        </Note>
        <P>
          <strong>Pourquoi c'est utile</strong> : ce test utilise uniquement la
          physique, pas le solveur. Un capteur biaisé qui passe toutes les
          vérifications du solveur (R² élevé, Hessienne non dégénérée) sera{" "}
          <em>quand même</em> détecté ici.
        </P>
      </Section>

      <Section title="Application : étude de cas sur un dataset réel">
        <P>
          Sur un jeu de 120 sorties d'un seul cycliste couvrant 4 phases
          capteur (4iiii → Assioma DUO → 4iiii après SAV → Assioma Pro RS-2),
          l'écart-type du CdA reconstitué sur rides "ok" évolue ainsi :
        </P>
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2">Phase</th>
                <th className="py-2">Capteur</th>
                <th className="py-2 text-right">n</th>
                <th className="py-2 text-right">% ok</th>
                <th className="py-2 text-right">σ(CdA)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30"><td className="py-1">2024</td><td>4iiii (origine)</td><td className="text-right">34</td><td className="text-right">47%</td><td className="text-right text-coral">0.069</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q1</td><td>Assioma DUO</td><td className="text-right">1</td><td className="text-right">100%</td><td className="text-right">—</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q2</td><td>4iiii (retour SAV)</td><td className="text-right">42</td><td className="text-right">81%</td><td className="text-right text-warn">0.042</td></tr>
              <tr className="border-b border-border/30"><td className="py-1">2025 Q3+</td><td>Assioma Pro RS-2</td><td className="text-right">43</td><td className="text-right">53%</td><td className="text-right text-teal">0.031</td></tr>
            </tbody>
          </table>
        </div>
        <P>
          <strong>Observation surprenante</strong> : la moyenne des CdA bouge
          très peu entre les phases (≈0.30 partout). Ce qui change drastiquement,
          c'est la <em>reproductibilité</em> : le 4iiii d'origine donne un
          écart-type <strong>2.2× plus grand</strong> que l'Assioma Pro RS-2,
          alors que les deux capteurs devraient mesurer la même réalité
          physique.
        </P>
        <P>
          Encore plus intéressant : le même 4iiii après retour de SAV (2025 Q2)
          donne un écart-type intermédiaire (0.042) — meilleur que l'original
          mais moins bon que l'Assioma. La différence avec la phase 2024 n'est{" "}
          <em>pas</em> le hardware, c'est la discipline de calibration : après
          le SAV, l'utilisateur a pris l'habitude de faire un zero-offset
          manuel à chaque départ.
        </P>
        <Note>
          Le <strong>W/CdA</strong> ou le <strong>rapport P/kg</strong> obtenus
          avec un capteur mono-jambe ne sont pas faux ; ils sont simplement{" "}
          <em>moins précis</em>. Pour des comparaisons inter-sorties fiables
          (évolution de position, test d'équipement), on recommande des pédales
          double-jambe calibrées auto.
        </Note>
      </Section>

      <Section title="Conséquence : la timeline de stabilité">
        <P>
          Comme l'écart-type de CdA change brutalement au moment des switches
          capteur, nous exposons dans l'historique un <strong>graphe de
          l'écart-type glissant sur 10 sorties consécutives</strong>. Les bandes
          colorées en arrière-plan montrent quelles périodes utilisaient quel
          capteur, et on voit immédiatement à quel moment les données sont
          devenues fiables.
        </P>
        <P>
          Ce graphe transforme une intuition ("mes sorties sont plus stables
          depuis que j'ai changé de capteur") en donnée mesurée et visible.
        </P>
      </Section>

      <Section title="Références">
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
