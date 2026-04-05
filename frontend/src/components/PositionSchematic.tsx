/**
 * Six hand-tuned cyclist silhouettes, picked by CdA bucket.
 * Flat SVG, no runtime geometry, minimal nodes.
 */

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

interface Posture {
  bucket: "tt_pro" | "tt_am" | "drops" | "hoods" | "upright" | "cityish";
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

const PATHS: Record<Posture["bucket"], React.ReactNode> = {
  tt_pro: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 230 12" />
      <path d="M 200 40 L 252 34" strokeLinecap="round" />
      <ellipse cx="265" cy="28" rx="12" ry="8" fill="#1D9E75" stroke="none" />
      <path d="M 210 22 C 220 10, 245 8, 258 20" fill="none" />
      <path d="M 200 40 L 180 60 L 165 80" strokeLinecap="round" />
    </>
  ),
  tt_am: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 225 15" />
      <path d="M 200 40 L 255 38" strokeLinecap="round" />
      <circle cx="265" cy="32" r="9" fill="#1D9E75" stroke="none" />
      <path d="M 212 24 C 225 14, 248 14, 260 26" fill="none" />
      <path d="M 200 40 L 178 58 L 162 78" strokeLinecap="round" />
    </>
  ),
  drops: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 222 14" />
      <path d="M 222 14 L 252 44" strokeLinecap="round" />
      <circle cx="248" cy="20" r="10" fill="#1D9E75" stroke="none" />
      <path d="M 220 8 C 230 -2, 252 -2, 264 10" fill="none" />
      <path d="M 200 40 L 178 58 L 162 78" strokeLinecap="round" />
    </>
  ),
  hoods: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 218 0" />
      <path d="M 218 0 L 248 30" strokeLinecap="round" />
      <circle cx="232" cy="-12" r="11" fill="#1D9E75" stroke="none" />
      <path d="M 206 -20 C 216 -32, 242 -32, 254 -18" fill="none" />
      <path d="M 200 40 L 180 58 L 164 78" strokeLinecap="round" />
    </>
  ),
  upright: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 210 -20" />
      <path d="M 210 -20 L 240 20" strokeLinecap="round" />
      <circle cx="216" cy="-34" r="12" fill="#1D9E75" stroke="none" />
      <path d="M 190 -44 C 202 -58, 228 -58, 240 -42" fill="none" />
      <path d="M 200 40 L 182 60 L 166 80" strokeLinecap="round" />
    </>
  ),
  cityish: (
    <>
      <circle cx="140" cy="62" r="46" />
      <circle cx="260" cy="62" r="46" />
      <path d="M 140 62 L 200 40 L 260 62 L 200 40 L 140 62 M 200 40 L 204 -30" />
      <path d="M 204 -30 L 236 14" strokeLinecap="round" />
      <circle cx="208" cy="-48" r="12" fill="#1D9E75" stroke="none" />
      <path d="M 184 -58 C 196 -72, 222 -72, 232 -56" fill="none" />
      <path d="M 200 40 L 184 62 L 168 82" strokeLinecap="round" />
    </>
  ),
};

export default function PositionSchematic({ cda, label, size = 280 }: Props) {
  const posture = postureFromCda(cda);
  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.55}
        viewBox="40 -80 320 170"
        fill="none"
        stroke="#1D9E75"
        strokeWidth={3}
        strokeLinejoin="round"
      >
        <line x1={40} y1={108} x2={360} y2={108} stroke="#262633" strokeWidth={1} />
        {PATHS[posture.bucket]}
      </svg>
      <div className="text-center mt-1">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="text-sm font-semibold">{posture.name}</div>
        <div className="text-xs text-muted">{posture.description}</div>
      </div>
    </div>
  );
}
