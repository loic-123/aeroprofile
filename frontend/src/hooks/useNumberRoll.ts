import { useEffect, useRef, useState } from "react";
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
 * Implementation notes:
 * - Uses framer-motion's imperative `animate()` on a plain number
 *   driven by an effect. We deliberately do NOT use useMotionValue
 *   + on("change") because re-rendering per frame via setState is
 *   the simplest correct model for a tiny text node and avoids a
 *   ref dance. The text is short (≤ 10 chars), and setState on a
 *   leaf component runs faster than one CPU frame.
 * - Respects prefers-reduced-motion via useReducedMotion — the hook
 *   returns the formatted target instantly in that case.
 * - Re-animates whenever `target` changes. Cancels the previous
 *   animation's controls on cleanup so overlapping updates don't
 *   fight.
 */
export function useNumberRoll(
  target: number,
  opts: Options = {},
): string {
  const { decimals = 0, durationMs = 900, delayMs = 0 } = opts;
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    // Start from whatever the current displayed value is so if the
    // target changes mid-animation we don't snap back to zero.
    const start = value;
    const controls = animate(start, target, {
      duration: durationMs / 1000,
      delay: delayMs / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
    // We intentionally depend only on `target` + reduce flags — the
    // internal `value` state must NOT retrigger the effect or we'd
    // get an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce, durationMs, delayMs]);

  // Guard NaN during the first frame or on invalid inputs.
  if (!Number.isFinite(value)) return target.toFixed(decimals);
  return value.toFixed(decimals);
}
