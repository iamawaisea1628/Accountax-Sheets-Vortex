import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0e2a2d", 800: "#133538", 700: "#1b474b" },
        paper: "#f1f5f2",
        rule: "#d6e0d9",
        brand: { DEFAULT: "#0f7a5c", dark: "#0a5c45", soft: "#ddf0e6" },
        gold: "#d99a1b",
        danger: "#b3372f",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["'Hanken Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
