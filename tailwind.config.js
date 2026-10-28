/** @type {import('tailwindcss').Config} */
module.exports = {
  // The design system is light-only: brand navy/blue on white. Tailwind defaults to
  // darkMode 'media', which silently darkens any element carrying a `dark:` variant
  // whenever the OS is in dark mode. Pinning it to 'class' means dark variants only
  // apply if a `dark` class is added deliberately, so OS settings cannot override
  // the brand palette.
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brandNavy: "#0B1F4D",
        brandBlue: "#1E4DB7",
        brandAccent: "#2563EB",
        brandIce: "#F7F9FC",
        // A light tint of brandBlue. brandBlue itself falls below contrast on the
        // dark hero photograph, so text and icons there use this instead.
        brandSky: "#93B4F5",
        brandGrid: "#E2E8F0",
        textDark: "#0A1628",
        textBody: "#475569",
        textMuted: "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
      },
      // The Coverage section reveals its left column once, when it scrolls into
      // view, and drifts the dashed connectors in the diagram. `both` keeps the
      // start state until the delay elapses, so the stagger does not flash.
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        dash: {
          to: { "stroke-dashoffset": "-10" },
        },
      },
      animation: {
        rise: "rise 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
        pop: "pop 450ms cubic-bezier(0.16, 1, 0.3, 1) both",
        dash: "dash 3s linear infinite",
      },
    },
  },
  plugins: [],
};

