import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b1020",
        "bg-panel": "#121a2b",
        "bg-panel-2": "#172033",
        "bg-input": "#0c1324",
        "text-primary": "#eef2ff",
        "text-muted": "#9fb0d0",
        "accent-cyan": "#7dd3fc",
        "accent-green": "#86efac",
        "border-dark": "#2b3957",
        "warn-amber": "#fbbf24",
      },
      backgroundColor: {
        "dark-base": "#0b1020",
        "dark-panel": "#121a2b",
        "dark-panel-2": "#172033",
        "dark-input": "#0c1324",
      },
      textColor: {
        light: "#eef2ff",
        muted: "#9fb0d0",
        accent: "#7dd3fc",
      },
      borderColor: {
        dark: "#2b3957",
      },
    },
  },
  plugins: [],
};
export default config;
