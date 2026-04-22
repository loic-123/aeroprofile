import { useState } from "react";
import { Info } from "lucide-react";

/**
 * Inline info icon that reveals an explanation on hover / focus / tap.
 *
 * The icon scales with the surrounding text (`1em`) so it visually
 * matches the label it sits next to — a 10 px `<dt>` gets a 10 px icon,
 * a 14 px banner title gets a 14 px icon. Before 2026-04, the icon was
 * hard-coded at 13 px which looked oversized inside a text-[10px] label
 * and undersized inside a text-sm banner.
 */
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
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
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-bg border border-border rounded-md p-3 text-xs text-text shadow-xl font-sans leading-relaxed normal-case tracking-normal"
        >
          {text}
        </span>
      )}
    </span>
  );
}
