import { useState } from "react";
import { Info } from "lucide-react";

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
        className="text-muted hover:text-text align-middle"
        aria-label="En savoir plus"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-bg border border-border rounded-md p-3 text-xs text-text shadow-xl font-sans leading-relaxed"
        >
          {text}
        </span>
      )}
    </span>
  );
}
