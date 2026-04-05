/**
 * Cyclist posture illustration, picked by CdA bucket.
 *
 * Each SVG shows a side-view cyclist: proper bike frame (wheels, fork, seat
 * tube, top tube, handlebar), legs articulated on pedals, and an upper body
 * whose posture changes between buckets. Rider drawn as filled silhouette
 * for readability against a dark background.
 */

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

type Bucket = "tt_pro" | "tt_am" | "drops" | "hoods" | "upright" | "cityish";

interface Posture {
  bucket: Bucket;
  name: string;
  description: string;
}

function postureFromCda(cda: number): Posture {
  if (cda < 0.22)
    return {
      bucket: "tt_pro",
      name: "CLM pro (Superman)",
      description: "Prolongateurs, dos plat, position CLM pro",
    };
  if (cda < 0.26)
    return {
      bucket: "tt_am",
      name: "CLM amateur",
      description: "Prolongateurs, dos et bras tendus",
    };
  if (cda < 0.33)
    return {
      bucket: "drops",
      name: "Route, mains en bas",
      description: "Mains en bas du cintre, dos modérément plat",
    };
  if (cda < 0.39)
    return {
      bucket: "hoods",
      name: "Route, mains sur cocottes",
      description: "Position standard sur cocottes",
    };
  if (cda < 0.46)
    return {
      bucket: "upright",
      name: "Route, position relevée",
      description: "Mains sur le haut du cintre, buste relevé",
    };
  return {
    bucket: "cityish",
    name: "Position droite / VTT",
    description: "Position droite, type VTT ou vélo ville",
  };
}

/**
 * Shared bike geometry. All coordinates are in a 400×200 viewBox with
 * wheels on y=160, ground at y=190.
 *
 *   rear wheel    front wheel
 *   cx=90, r=38   cx=310, r=38
 *   BB: (180, 155)
 *   saddle: (125, 85)
 *   head tube top: (260, 80)
 *   handlebar: (280, 75)
 */
const BIKE = (
  <g stroke="#8b8ba0" strokeWidth={2.5} fill="none" strokeLinecap="round">
    {/* ground */}
    <line x1={20} y1={192} x2={380} y2={192} stroke="#262633" strokeWidth={1} />
    {/* wheels */}
    <circle cx={90} cy={160} r={38} />
    <circle cx={310} cy={160} r={38} />
    {/* spokes hint */}
    <line x1={90} y1={122} x2={90} y2={198} strokeWidth={1} opacity={0.4} />
    <line x1={52} y1={160} x2={128} y2={160} strokeWidth={1} opacity={0.4} />
    <line x1={310} y1={122} x2={310} y2={198} strokeWidth={1} opacity={0.4} />
    <line x1={272} y1={160} x2={348} y2={160} strokeWidth={1} opacity={0.4} />
    {/* bottom bracket */}
    <circle cx={180} cy={155} r={4} fill="#8b8ba0" />
    {/* chainstay & seatstay (triangle rear) */}
    <line x1={180} y1={155} x2={90} y2={160} />
    <line x1={125} y1={85} x2={90} y2={160} />
    {/* seat tube */}
    <line x1={180} y1={155} x2={125} y2={85} />
    {/* top tube */}
    <line x1={125} y1={85} x2={255} y2={82} />
    {/* down tube */}
    <line x1={180} y1={155} x2={255} y2={82} />
    {/* head tube + fork */}
    <line x1={255} y1={82} x2={265} y2={110} strokeWidth={3} />
    <line x1={265} y1={110} x2={310} y2={160} />
    {/* stem + handlebar */}
    <line x1={255} y1={82} x2={278} y2={74} strokeWidth={3} />
    <circle cx={280} cy={74} r={4} fill="#8b8ba0" stroke="none" />
    {/* saddle */}
    <line x1={110} y1={82} x2={140} y2={82} strokeWidth={4} stroke="#8b8ba0" strokeLinecap="round" />
    {/* crank + pedals (simplified, showing one leg position) */}
    <line x1={180} y1={155} x2={205} y2={172} strokeWidth={2} />
    <line x1={180} y1={155} x2={155} y2={138} strokeWidth={2} />
  </g>
);

/**
 * Legs — same articulation for every bucket (hips → knee → pedal).
 * Hip is at the saddle (125, 80). BB is at (180, 155).
 * Front pedal at (205, 172), rear pedal at (155, 138).
 */
const LEGS = (
  <g stroke="#1D9E75" strokeWidth={6} fill="none" strokeLinecap="round">
    {/* thigh + shin, front leg (pushing down) */}
    <path d="M 125 80 Q 170 105 178 132 L 205 172" />
    {/* thigh + shin, rear leg (pulling up) */}
    <path d="M 125 80 Q 150 100 152 120 L 155 138" />
  </g>
);

/**
 * Upper body for each bucket. Defined by: hip point (saddle, 125,80),
 * torso tilt angle, shoulder position, arm bend, head position.
 * Drawn as a filled curved path so it reads as a silhouette.
 */
function UpperBody({ bucket }: { bucket: Bucket }) {
  switch (bucket) {
    case "tt_pro":
      // Nearly horizontal back, extended aero bars, head tucked forward
      return (
        <g>
          {/* torso: hip to shoulder, very flat */}
          <path
            d="M 125 80 Q 180 58 235 56 L 245 62 Q 200 65 130 85 Z"
            fill="#1D9E75"
          />
          {/* aero extensions / arms straight forward to bar tips */}
          <path
            d="M 240 56 L 305 48 L 308 52 L 242 62 Z"
            fill="#1D9E75"
          />
          {/* head, tucked between arms */}
          <circle cx={257} cy={44} r={10} fill="#1D9E75" />
          {/* helmet aero tail */}
          <path d="M 257 34 Q 270 38 268 50 Q 260 42 257 34 Z" fill="#1D9E75" />
        </g>
      );
    case "tt_am":
      // Flat back, slightly higher than pro, aero bars
      return (
        <g>
          <path
            d="M 125 80 Q 175 60 228 55 L 238 62 Q 195 68 130 85 Z"
            fill="#1D9E75"
          />
          <path d="M 232 55 L 295 52 L 297 57 L 234 62 Z" fill="#1D9E75" />
          <circle cx={248} cy={43} r={11} fill="#1D9E75" />
        </g>
      );
    case "drops":
      // Back 25-30° from horizontal, arms reaching to drop bars
      return (
        <g>
          <path
            d="M 125 80 Q 170 55 215 38 L 225 45 Q 190 60 130 85 Z"
            fill="#1D9E75"
          />
          {/* arms: shoulders (218,42) to drops (282,78) */}
          <path
            d="M 220 40 Q 255 50 280 74 L 284 78 Q 258 58 224 46 Z"
            fill="#1D9E75"
          />
          <circle cx={228} cy={28} r={11} fill="#1D9E75" />
        </g>
      );
    case "hoods":
      // Back ~40°, hands on brake hoods (higher than drops)
      return (
        <g>
          <path
            d="M 125 80 Q 160 45 198 22 L 208 30 Q 180 52 130 85 Z"
            fill="#1D9E75"
          />
          {/* arms: shoulders (203,25) to hoods top (276,70) */}
          <path
            d="M 205 26 Q 245 40 274 68 L 278 72 Q 248 48 210 32 Z"
            fill="#1D9E75"
          />
          <circle cx={212} cy={10} r={11} fill="#1D9E75" />
        </g>
      );
    case "upright":
      // Back ~55°, hands on tops, more vertical torso
      return (
        <g>
          <path
            d="M 125 80 Q 150 38 180 5 L 192 10 Q 170 48 130 85 Z"
            fill="#1D9E75"
          />
          {/* arms: shoulders (186,8) to tops (275,75) */}
          <path
            d="M 188 8 Q 235 36 272 72 L 278 76 Q 240 44 193 14 Z"
            fill="#1D9E75"
          />
          <circle cx={196} cy={-8} r={11} fill="#1D9E75" />
        </g>
      );
    default:
      // cityish — nearly vertical back, arms low
      return (
        <g>
          <path
            d="M 125 80 Q 138 30 164 -10 L 178 -6 Q 158 42 130 85 Z"
            fill="#1D9E75"
          />
          <path
            d="M 172 -5 Q 220 28 268 72 L 274 78 Q 228 38 178 2 Z"
            fill="#1D9E75"
          />
          <circle cx={180} cy={-24} r={12} fill="#1D9E75" />
        </g>
      );
  }
}

export default function PositionSchematic({ cda, label, size = 320 }: Props) {
  const posture = postureFromCda(cda);
  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.55}
        viewBox="20 -40 360 240"
        xmlns="http://www.w3.org/2000/svg"
      >
        {BIKE}
        {LEGS}
        <UpperBody bucket={posture.bucket} />
      </svg>
      <div className="text-center mt-2">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="text-sm font-semibold">{posture.name}</div>
        <div className="text-xs text-muted">{posture.description}</div>
      </div>
    </div>
  );
}
