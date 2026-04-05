/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        panel: "#14141c",
        border: "#262633",
        teal: "#1D9E75",
        coral: "#E8654A",
        info: "#3B82F6",
        text: "#e4e4ed",
        muted: "#8b8ba0",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
