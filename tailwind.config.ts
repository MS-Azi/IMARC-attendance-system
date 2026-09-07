import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0A0A0C",
        surface: "#141417",
        surface2: "#1C1C21",
        border: "#2A2A31",
        accent: "#E8384F",
        accentDim: "#C22539",
        ink: "#F5F5F7",
        muted: "#8A8A95",
        good: "#5C9270",
        late: "#C6924A",
        bad: "#C0564B",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
