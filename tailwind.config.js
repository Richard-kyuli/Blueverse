/** @type {import('tailwindcss').Config} */
module.exports = {
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
        brandGrid: "#E2E8F0",
        textDark: "#0A1628",
        textBody: "#475569",
        textMuted: "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

