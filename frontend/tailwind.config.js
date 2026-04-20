/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces (dimensional layering: bg → panel → elevated)
        bg: "#0a0a0f",
        panel: "#14141c",
        "panel-2": "#1a1a24", // elevated card over panel
        border: "#262633",
        "border-strong": "#3a3a4a",

        // Foreground
        text: "#e4e4ed",
        muted: "#8b8ba0",
        "muted-strong": "#a8a8bc",

        // Brand
        teal: "#1D9E75",
        "teal-hover": "#2bb486",
        coral: "#E8654A",
        "coral-hover": "#f07b62",

        // Semantic (aliased below to brand where it makes sense)
        primary: {
          DEFAULT: "#1D9E75",
          fg: "#ffffff",
          hover: "#2bb486",
          subtle: "rgb(29 158 117 / 0.12)",
          border: "rgb(29 158 117 / 0.4)",
        },
        accent: {
          DEFAULT: "#E8654A",
          fg: "#ffffff",
          hover: "#f07b62",
          subtle: "rgb(232 101 74 / 0.12)",
          border: "rgb(232 101 74 / 0.4)",
        },
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
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui"],
      },
      // Dimensional layering: 4 elevation levels calibrated for dark mode.
      // Shadows are barely visible on pure dark bg, so we add a subtle
      // inner light ring on elevated surfaces via boxShadow.
      boxShadow: {
        "e1": "0 1px 2px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.02)",
        "e2": "0 4px 8px -2px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.04)",
        "e3": "0 12px 24px -6px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.06)",
        "e4": "0 24px 48px -12px rgb(0 0 0 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.08)",
        // Glow shadows for primary action states (subtle, 10% opacity).
        "glow-primary": "0 0 20px rgb(29 158 117 / 0.25)",
        "glow-danger": "0 0 20px rgb(239 68 68 / 0.25)",
      },
      // Consistent animation timings across the app (avoids ad-hoc
      // duration-200 / duration-300 / duration-500 inconsistencies).
      transitionDuration: {
        "fast": "120ms",
        "base": "180ms",
        "slow": "280ms",
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
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
