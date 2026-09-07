import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F1720",
        surface: "#161F2C",
        surface2: "#1D2836",
        border: "#2A3644",
        accent: "#C89B5C",
        accentDim: "#8A6F47",
        ink: "#EDEFF2",
        muted: "#8A93A3",
        good: "#5C9270",
        late: "#C6924A",
        bad: "#B0483E",
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
