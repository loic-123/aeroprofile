import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike } from "lucide-react";

/**
 * Fun loading animation shown while the backend crunches a ride.
 *
 * Three layered things happen:
 *  1. A bike icon rolls across a horizontal progress track on a loop.
 *  2. A rotating set of playful "did you know" facts about cycling
 *     aerodynamics fades in/out to give the user something to read while
 *     they wait (typical analyze = 10–30 s).
 *  3. A soft pulsing glow on the track hints that work is ongoing even
 *     when the bike has rolled off-screen between iterations.
 *
 * Total file size stays small because the whole thing is CSS + a couple of
 * setTimeouts — no dependency beyond what's already in the bundle.
 */
export default function AnalysisLoading() {
  const { t } = useTranslation();
  // i18n array of strings — facts.1, facts.2, ... Read them in sequence.
  const facts = [
    t("loading.facts.1"),
    t("loading.facts.2"),
    t("loading.facts.3"),
    t("loading.facts.4"),
    t("loading.facts.5"),
    t("loading.facts.6"),
    t("loading.facts.7"),
    t("loading.facts.8"),
  ];
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFactIdx((i) => (i + 1) % facts.length);
    }, 3500);
    return () => clearInterval(id);
  }, [facts.length]);

  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      {/* Bike rolling across a track */}
      <div
        className="relative w-full max-w-md h-16 overflow-hidden"
        aria-hidden
      >
        {/* Animated underline (the "road") */}
        <div className="absolute bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        {/* Soft pulsing glow behind the road */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-8 w-48 rounded-full bg-primary/20 blur-2xl animate-pulse" />
        {/* The rolling bike */}
        <div className="absolute bottom-2.5 bike-roll">
          <Bike className="text-primary drop-shadow-[0_0_8px_rgba(124,111,222,0.6)]" size={36} />
        </div>
        {/* Speed lines behind the bike */}
        <div className="absolute bottom-3 bike-roll-lines text-primary/50 font-mono text-xs tracking-[0.3em]">
          ≈≈≈
        </div>
      </div>

      {/* Analyzing text */}
      <p className="text-sm font-mono text-muted tracking-wide">
        {t("app.loading.analyzing")}
      </p>

      {/* Rotating fact card */}
      <div className="relative w-full max-w-md h-24 flex items-center justify-center">
        {facts.map((fact, i) => (
          <p
            key={i}
            className={`absolute inset-0 flex items-center justify-center text-center text-xs text-muted-strong leading-relaxed px-4 transition-opacity duration-500 ease-out ${
              i === factIdx ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="inline-block">
              <span className="text-primary/60 font-semibold tracking-wider text-[10px] uppercase block mb-2">
                {t("loading.didYouKnow")}
              </span>
              {fact}
            </span>
          </p>
        ))}
      </div>

      <style>{`
        @keyframes bike-roll {
          0%   { left: -10%; transform: rotate(0deg); }
          50%  { transform: rotate(-2deg); }
          100% { left: 105%; transform: rotate(0deg); }
        }
        @keyframes bike-roll-lines {
          0%   { left: -20%; opacity: 0; }
          20%  { opacity: 0.8; }
          100% { left: 95%;  opacity: 0; }
        }
        .bike-roll {
          animation: bike-roll 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .bike-roll-lines {
          animation: bike-roll-lines 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
      `}</style>
    </div>
  );
}
