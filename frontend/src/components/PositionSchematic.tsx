/**
 * Draw a simplified cyclist silhouette whose torso angle and arm/back posture
 * reflect the estimated CdA. The shape is purely illustrative — a rider with
 * lower CdA is drawn more tucked.
 */

interface Props {
  cda: number;
  label?: string;
  size?: number;
}

interface Posture {
  name: string;
  torsoAngleDeg: number; // 0 = horizontal, 90 = upright
  backCurve: number; // 0 = flat, 1 = hunched
  elbowBend: number; // 0 = straight, 1 = tucked
  description: string;
}

function postureFromCda(cda: number): Posture {
  if (cda < 0.22) {
    return {
      name: "CLM pro (Superman)",
      torsoAngleDeg: 5,
      backCurve: 0.1,
      elbowBend: 0.95,
      description: "Position CLM professionnelle, prolongateurs, dos plat",
    };
  }
  if (cda < 0.26) {
    return {
      name: "CLM amateur bien réglé",
      torsoAngleDeg: 12,
      backCurve: 0.2,
      elbowBend: 0.85,
      description: "Prolongateurs, position basse et aéro",
    };
  }
  if (cda < 0.33) {
    return {
      name: "Route, mains en bas (drops)",
      torsoAngleDeg: 25,
      backCurve: 0.35,
      elbowBend: 0.55,
      description: "Mains en bas du cintre, dos modérément plat",
    };
  }
  if (cda < 0.39) {
    return {
      name: "Route, mains sur cocottes",
      torsoAngleDeg: 38,
      backCurve: 0.5,
      elbowBend: 0.35,
      description: "Position standard, mains sur cocottes",
    };
  }
  if (cda < 0.46) {
    return {
      name: "Route, position relevée",
      torsoAngleDeg: 55,
      backCurve: 0.6,
      elbowBend: 0.2,
      description: "Position relevée, mains sur le haut du cintre",
    };
  }
  return {
    name: "Position très droite / VTT",
    torsoAngleDeg: 75,
    backCurve: 0.7,
    elbowBend: 0.1,
    description: "Position droite, type VTT ou vélo ville",
  };
}

export default function PositionSchematic({ cda, label, size = 280 }: Props) {
  const posture = postureFromCda(cda);
  const w = size;
  const h = size * 0.7;

  // Reference geometry (side view, facing right)
  const groundY = h - 20;
  const wheelR = h * 0.17;
  const rearWheelX = w * 0.22;
  const frontWheelX = w * 0.72;
  const wheelY = groundY - wheelR;

  const bbX = (rearWheelX + frontWheelX) / 2 - 10;
  const bbY = wheelY + wheelR * 0.1;

  // Handlebar above front wheel
  const hbX = frontWheelX - 8;
  const hbY = wheelY - wheelR * 0.6;

  // Saddle above rear wheel
  const saddleX = rearWheelX + wheelR * 0.9;
  const saddleY = wheelY - wheelR * 1.0;

  // Hips = saddle
  const hipX = saddleX;
  const hipY = saddleY - 2;

  // Torso endpoint (shoulders)
  const torsoLen = h * 0.38;
  const angleRad = (posture.torsoAngleDeg * Math.PI) / 180;
  const shoulderX = hipX + torsoLen * Math.sin(angleRad);
  const shoulderY = hipY - torsoLen * Math.cos(angleRad);

  // Head
  const headR = h * 0.07;
  const neckLen = headR * 1.2;
  const headX = shoulderX + neckLen * Math.sin(angleRad);
  const headY = shoulderY - neckLen * Math.cos(angleRad);

  // Arms: shoulder → handlebar, bend based on elbowBend
  const armMidX =
    (shoulderX + hbX) / 2 + posture.elbowBend * 8 * Math.cos(angleRad);
  const armMidY = (shoulderY + hbY) / 2 - posture.elbowBend * 6;

  // Leg: hip → bottom bracket (thigh) → pedal
  const thighMidX = (hipX + bbX) / 2 - 4;
  const thighMidY = (hipY + bbY) / 2 + 8;

  // Back curve control point
  const backCtrlX =
    (hipX + shoulderX) / 2 + posture.backCurve * 14 * Math.cos(angleRad);
  const backCtrlY =
    (hipY + shoulderY) / 2 - posture.backCurve * 14 * Math.sin(angleRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* ground */}
        <line
          x1={0}
          y1={groundY}
          x2={w}
          y2={groundY}
          stroke="#262633"
          strokeWidth={1}
        />
        {/* wheels */}
        <circle
          cx={rearWheelX}
          cy={wheelY}
          r={wheelR}
          fill="none"
          stroke="#8b8ba0"
          strokeWidth={2}
        />
        <circle
          cx={frontWheelX}
          cy={wheelY}
          r={wheelR}
          fill="none"
          stroke="#8b8ba0"
          strokeWidth={2}
        />
        {/* bike frame: seat tube, top tube, down tube, chainstay, fork */}
        <line x1={bbX} y1={bbY} x2={saddleX} y2={saddleY} stroke="#8b8ba0" strokeWidth={2} />
        <line x1={saddleX} y1={saddleY} x2={hbX} y2={hbY} stroke="#8b8ba0" strokeWidth={2} />
        <line x1={bbX} y1={bbY} x2={hbX} y2={hbY} stroke="#8b8ba0" strokeWidth={2} />
        <line
          x1={bbX}
          y1={bbY}
          x2={rearWheelX}
          y2={wheelY}
          stroke="#8b8ba0"
          strokeWidth={2}
        />
        <line
          x1={hbX}
          y1={hbY}
          x2={frontWheelX}
          y2={wheelY}
          stroke="#8b8ba0"
          strokeWidth={2}
        />
        {/* rider: curved back hip→shoulder */}
        <path
          d={`M ${hipX} ${hipY} Q ${backCtrlX} ${backCtrlY} ${shoulderX} ${shoulderY}`}
          stroke="#1D9E75"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        {/* arm */}
        <path
          d={`M ${shoulderX} ${shoulderY} Q ${armMidX} ${armMidY} ${hbX} ${hbY}`}
          stroke="#1D9E75"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        {/* leg */}
        <path
          d={`M ${hipX} ${hipY} Q ${thighMidX} ${thighMidY} ${bbX} ${bbY}`}
          stroke="#1D9E75"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* neck + head */}
        <line
          x1={shoulderX}
          y1={shoulderY}
          x2={headX - Math.sin(angleRad) * headR * 0.8}
          y2={headY + Math.cos(angleRad) * headR * 0.8}
          stroke="#1D9E75"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={headX} cy={headY} r={headR} fill="#1D9E75" />
      </svg>
      <div className="text-center mt-1">
        {label && <div className="text-xs text-muted">{label}</div>}
        <div className="text-sm font-semibold">{posture.name}</div>
        <div className="text-xs text-muted">{posture.description}</div>
      </div>
    </div>
  );
}
