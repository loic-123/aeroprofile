/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ───────────────────────────────────────────────────────────────
        // Premium Research Lab palette — warm near-black + copper +
        // deep indigo. Token NAMES are preserved from the previous
        // palette so all existing className usages resolve to the new
        // hex automatically (no mass rename).
        // ───────────────────────────────────────────────────────────────

        // Surfaces — warm near-black, browned toward paper rather than
        // cool blue-black. The whole point of the rebrand is to escape
        // the generic "#0a0a0f dark SaaS" template.
        bg: "#0b0a08",
        panel: "#141210",
        "panel-2": "#1c1915",
        border: "rgba(232, 207, 179, 0.08)", // warm hairline
        "border-strong": "rgba(232, 207, 179, 0.16)",

        // Foreground — ivory paper, not clinical white.
        text: "#ede7db",
        muted: "#9a907f",
        "muted-strong": "#bab0a0",

        // Brand — copper is primary. Indigo is the accent / CTA fill.
        // Fg on copper is ink (#0b0a08) for readability; fg on indigo
        // is paper (#ede7db).
        teal: "#C77A4A", // legacy alias, resolves to copper for stray refs
        "teal-hover": "#D48A5A",
        coral: "#4B4E8C", // legacy alias, resolves to indigo
        "coral-hover": "#5E62A6",

        primary: {
          DEFAULT: "#C77A4A", // copper
          fg: "#0b0a08",
          hover: "#D48A5A",
          subtle: "rgb(199 122 74 / 0.12)",
          border: "rgb(199 122 74 / 0.40)",
        },
        accent: {
          DEFAULT: "#4B4E8C", // deep indigo
          fg: "#ede7db",
          hover: "#5E62A6",
          subtle: "rgb(75 78 140 / 0.14)",
          border: "rgb(75 78 140 / 0.42)",
        },

        // Paper — for inverted light cards (e.g. a quoted pullout). Kept
        // for future use; not wired into any component yet.
        paper: {
          DEFAULT: "#ede7db",
          ink: "#0b0a08",
        },

        // Semantic — kept untouched on purpose. success/warn/danger/info
        // are universal signals and shouldn't follow a brand recolour.
        info: {
          DEFAULT: "#3B82F6",
          fg: "#ffffff",
          hover: "#5b9bff",
          subtle: "rgb(59 130 246 / 0.12)",
          border: "rgb(59 130 246 / 0.4)",
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
          hover: "#ffb235",
          subtle: "rgb(245 158 11 / 0.12)",
          border: "rgb(245 158 11 / 0.4)",
        },
        danger: {
          DEFAULT: "#EF4444",
          fg: "#ffffff",
          hover: "#f66767",
          subtle: "rgb(239 68 68 / 0.12)",
          border: "rgb(239 68 68 / 0.4)",
        },
      },
      fontFamily: {
        // Inter for body — neutral, readable, modern.
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
        // Instrument Serif italic — used as eyebrows and hero titles.
        // Strict rule: only at text-2xl (24px) and above; below that it
        // gets spindly and defeats the editorial intent.
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        // JetBrains Mono for all numeric data (CdA, Crr, RMSE, etc.).
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        e1: "0 1px 2px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(232 207 179 / 0.03)",
        e2: "0 4px 10px -2px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(232 207 179 / 0.05)",
        e3: "0 14px 28px -6px rgb(0 0 0 / 0.7), inset 0 1px 0 rgb(232 207 179 / 0.07)",
        e4: "0 28px 56px -12px rgb(0 0 0 / 0.8), inset 0 1px 0 rgb(232 207 179 / 0.1)",
        "glow-primary": "0 0 24px rgb(199 122 74 / 0.22)",
        "glow-copper": "0 0 24px rgb(199 122 74 / 0.22)",
        "glow-accent": "0 0 24px rgb(75 78 140 / 0.25)",
        "glow-danger": "0 0 20px rgb(239 68 68 / 0.25)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "280ms",
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
        "hairline-draw": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "hairline-draw":
          "hairline-draw 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
