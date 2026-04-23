import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * Inline info icon that reveals an explanation on hover / focus / tap.
 *
 * The tooltip body is rendered through a React portal into `document.body`
 * so it escapes any ancestor `overflow: hidden` / `overflow: auto` / stacking
 * context that used to clip it (cards, panels, sticky headers). Position is
 * computed from the trigger's bounding rect and flipped vertically when the
 * viewport doesn't have room below.
 *
 * The icon scales with the surrounding text (`1.1em`) so it visually matches
 * the label it sits next to.
 */
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: "top" | "bottom" } | null>(
    null,
  );

  // Width used for the tooltip bubble (matches w-72 = 18rem = 288 px).
  const TOOLTIP_W = 288;
  const GAP = 8;

  const compute = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Horizontal: centre under the icon, clamp into the viewport (8 px margin).
    const centreX = r.left + r.width / 2;
    let left = Math.round(centreX - TOOLTIP_W / 2);
    left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8));
    // Vertical: prefer below, flip to above when ≥240 px are needed and not
    // available below. The 240 px ceiling matches the longest tooltip we
    // realistically render (~4 lines of 12 px text + padding).
    const needed = 240;
    const spaceBelow = vh - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const placement: "top" | "bottom" =
      spaceBelow < needed && spaceAbove > spaceBelow ? "top" : "bottom";
    const top =
      placement === "bottom" ? Math.round(r.bottom + GAP) : Math.round(r.top - GAP);
    setPos({ left, top, placement });
  };

  // Recompute placement right before paint so the first frame of the tooltip
  // is in the right spot (no visible jump from 0,0 to target).
  useLayoutEffect(() => {
    if (open) compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep placement in sync while open: scroll / resize move the trigger.
  useEffect(() => {
    if (!open) return;
    const on = () => compute();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open]);

  return (
    <span className="relative inline-block ml-1">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="text-muted hover:text-text align-middle leading-none"
        aria-label="En savoir plus"
      >
        <Info className="w-[1.1em] h-[1.1em]" aria-hidden />
      </button>
      {open && pos &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[1000] w-72 bg-bg border border-border rounded-md p-3 shadow-xl text-text pointer-events-none"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.placement === "top" ? "translateY(-100%)" : undefined,
              fontSize: "12px",
              lineHeight: 1.5,
              fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
              fontWeight: 400,
              letterSpacing: "normal",
              textTransform: "none",
              fontVariant: "normal",
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
