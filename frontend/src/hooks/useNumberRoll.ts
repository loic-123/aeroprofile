import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface Options {
  /** Number of decimals to show in the formatted string. */
  decimals?: number;
  /** Animation duration in milliseconds. Defaults to 900ms — just
   *  long enough to feel earned, short enough not to be boring. */
  durationMs?: number;
  /** Delay in ms before the roll starts. Useful to stagger several
   *  metrics on the same screen. */
  delayMs?: number;
}

/**
 * Returns a formatted numeric string that animates from 0 up to
 * `target` on mount (and on any target change thereafter).
 *
 * Uses framer-motion's imperative `animate()` and a single setState
 * per frame. For the tiny text nodes we use this on (leaf metric
 * components), this is the simplest correct model. Respects
 * prefers-reduced-motion via useReducedMotion — returns the
 * formatted target instantly when motion is reduced.
 */
export function useNumberRoll(target: number, opts: Options = {}): string {
  const { decimals = 0, durationMs = 900, delayMs = 0 } = opts;
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const start = value;
    const controls = animate(start, target, {
      duration: durationMs / 1000,
      delay: delayMs / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce, durationMs, delayMs]);

  if (!Number.isFinite(value)) return target.toFixed(decimals);
  return value.toFixed(decimals);
}
