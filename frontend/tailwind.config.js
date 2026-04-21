/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ───────────────────────────────────────────────────────────────
        // Direction B — Linear × Vercel × Intervals.icu
        //
        // The palette signals "tool built by someone who ships software
        // for a living". Iris primary + lime accent on a warm-neutral
        // near-black. Token NAMES are preserved so every existing
        // className resolves automatically — only hex changes.
        // ───────────────────────────────────────────────────────────────

        // Surfaces
        bg: "#0A0A0B",            // near-black, slightly warm
        panel: "#111113",         // card surface
        "panel-2": "#1A1A1D",     // elevated card
        border: "#27272A",        // hairline border, warm grey
        "border-strong": "#3F3F46",

        // Foreground
        text: "#EDEDEF",          // off-white, slightly warm
        muted: "#A1A1AA",         // Zinc 400
        "muted-strong": "#D4D4D8", // Zinc 300

        // Brand — iris (Linear-inspired purple) is the primary brand
        // colour. It's unusual for a cycling tool (teal is the default
        // in the category) and instantly signals "tool for engineers".
        teal: "#7C6FDE",           // legacy alias, resolves to iris
        "teal-hover": "#9489E5",
        coral: "#A3E635",          // legacy alias, resolves to lime (secondary)
        "coral-hover": "#BEF264",

        primary: {
          DEFAULT: "#7C6FDE",     // iris — primary brand
          fg: "#FFFFFF",
          hover: "#9489E5",
          subtle: "rgb(124 111 222 / 0.14)",
          border: "rgb(124 111 222 / 0.45)",
        },
        accent: {
          DEFAULT: "#A3E635",     // lime — secondary, "OK / positive gain"
          fg: "#0A0A0B",
          hover: "#BEF264",
          subtle: "rgb(163 230 53 / 0.12)",
          border: "rgb(163 230 53 / 0.4)",
        },

        // Semantic (untouched — universally readable colours)
        info: {
          DEFAULT: "#60A5FA",
          fg: "#0A0A0B",
          hover: "#93C5FD",
          subtle: "rgb(96 165 250 / 0.12)",
          border: "rgb(96 165 250 / 0.4)",
        },
        success: {
          DEFAULT: "#22C55E",
          fg: "#062e17",
          hover: "#3bd876",
          subtle: "rgb(34 197 94 / 0.12)",
          border: "rgb(34 197 94 / 0.4)",
        },
        warn: {
          DEFAULT: "#F59E0B",
          fg: "#1a1205",
          hover: "#FCD34D",
          subtle: "rgb(245 158 11 / 0.12)",
          border: "rgb(245 158 11 / 0.4)",
        },
        danger: {
          DEFAULT: "#F87171",
          fg: "#FFFFFF",
          hover: "#FCA5A5",
          subtle: "rgb(248 113 113 / 0.12)",
          border: "rgb(248 113 113 / 0.4)",
        },
      },
      fontFamily: {
        // Inter for body, optical-sized display for hero. Geist Mono
        // would be more on-brand for "Linear tool" but requires a self-
        // hosted font; JetBrains Mono is the closest freely-available
        // match and is already in the project.
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
        display: ['"Inter"', "ui-sans-serif", "system-ui"], // same stack, used with tracking-tight
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Calibrated for warm near-black. Inner-ring highlight at 4%.
        e1: "0 1px 2px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.02)",
        e2: "0 4px 12px -2px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.04)",
        e3: "0 14px 32px -8px rgb(0 0 0 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.06)",
        e4: "0 28px 56px -14px rgb(0 0 0 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.08)",
        // Brand glows (used sparingly on CTAs + focus).
        "glow-primary": "0 0 24px rgb(124 111 222 / 0.35)",
        "glow-accent": "0 0 24px rgb(163 230 53 / 0.25)",
        "glow-danger": "0 0 20px rgb(248 113 113 / 0.25)",
      },
      transitionDuration: {
        // Linear's signature: interactions feel under-damped.
        fast: "100ms",
        base: "150ms",
        slow: "240ms",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
