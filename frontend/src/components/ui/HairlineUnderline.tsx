import { motion, useReducedMotion } from "framer-motion";
import { cn } from "./cn";

interface HairlineUnderlineProps {
  /** Full or half width. Half looks like a pulled-out editorial
   *  byline-underline; full is the default for hero metrics. */
  width?: "full" | "half";
  /** Override the colour. Defaults to copper (primary). */
  colorClass?: string;
  className?: string;
  /** Delay (ms) before the draw animation starts. Use to stagger
   *  underlines after a number-roll or section fade. */
  delayMs?: number;
}

/**
 * The signature gesture of the rebrand: a 1-pixel copper hairline
 * that draws itself left-to-right over 600 ms when its parent
 * mounts. Placed under hero metrics, section eyebrows, and any
 * figure that deserves editorial emphasis.
 *
 * Uses transform-only animation (scaleX with transformOrigin: left)
 * so it's GPU-composited and never triggers layout. Respects
 * prefers-reduced-motion via framer-motion's useReducedMotion hook:
 * the line renders at full width immediately, no animation.
 */
export function HairlineUnderline({
  width = "full",
  colorClass = "bg-primary",
  className,
  delayMs = 0,
}: HairlineUnderlineProps) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn(
        "block h-px origin-left",
        width === "half" ? "w-1/2" : "w-full",
        colorClass,
        className,
      )}
      initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              delay: delayMs / 1000,
            }
      }
      aria-hidden
    />
  );
}
