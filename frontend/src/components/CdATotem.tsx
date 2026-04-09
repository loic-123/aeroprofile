/**
 * CdA Totem — compare the rider's CdA to a real-world object.
 * "Aérodynamiquement, vous êtes un dauphin 🐬"
 */

interface TotemEntry {
  maxCda: number;
  emoji: string;
  name: string;
  desc: string;
}

const TOTEMS: TotemEntry[] = [
  { maxCda: 0.18, emoji: "🏎️", name: "Formule 1", desc: "Vous fendez l'air comme une monoplace de GP. Position CLM d'exception." },
  { maxCda: 0.22, emoji: "🐧", name: "Pingouin empereur en glisse", desc: "Profilé comme un pingouin sur la glace. Position contre-la-montre pro." },
  { maxCda: 0.26, emoji: "🦅", name: "Aigle en piqué", desc: "Ailes repliées, vous plongez dans l'air comme un rapace. CLM amateur solide." },
  { maxCda: 0.30, emoji: "🐬", name: "Dauphin", desc: "Hydrodynamique parfait. Position route agressive, mains en bas, dos plat." },
  { maxCda: 0.34, emoji: "⚽", name: "Ballon de foot", desc: "Étonnamment aéro grâce aux coutures. Position route drops, bon compromis." },
  { maxCda: 0.38, emoji: "🎿", name: "Skieur en descente", desc: "Position de recherche de vitesse. Route sur cocottes, rien de honteux." },
  { maxCda: 0.42, emoji: "🦁", name: "Lion au galop", desc: "Puissant mais pas très profilé. Position hoods standard, marge de progression sur le buste." },
  { maxCda: 0.48, emoji: "🧱", name: "Brique posée à plat", desc: "Pas le plus aéro du zoo. Position relevée, mains en haut du cintre." },
  { maxCda: 0.55, emoji: "🐻", name: "Ours debout", desc: "Imposant face au vent. Position très droite, VTT ou vélo ville." },
  { maxCda: 9.99, emoji: "🚪", name: "Porte de grange", desc: "Vous offrez toute votre surface au vent. Il y a du travail ! 😄" },
];

function getTotem(cda: number): TotemEntry {
  for (const t of TOTEMS) {
    if (cda <= t.maxCda) return t;
  }
  return TOTEMS[TOTEMS.length - 1];
}

export default function CdATotem({ cda }: { cda: number }) {
  const totem = getTotem(cda);
  return (
    <div className="bg-panel border border-border rounded-lg p-5 text-center">
      <div className="text-5xl mb-3">{totem.emoji}</div>
      <div className="text-lg font-bold">
        Aérodynamiquement, vous êtes…
      </div>
      <div className="text-2xl font-bold text-teal mt-1">
        {totem.emoji} {totem.name}
      </div>
      <p className="text-sm text-muted mt-2 max-w-md mx-auto">
        {totem.desc}
      </p>
      <div className="text-xs text-muted mt-3 font-mono">
        CdA = {cda.toFixed(3)} m²
      </div>
    </div>
  );
}
