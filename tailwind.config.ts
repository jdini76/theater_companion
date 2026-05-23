import type { Config } from "tailwindcss";

// All custom colors use CSS variables with the <alpha-value> placeholder so
// Tailwind opacity modifiers (e.g. bg-accent-cyan/20) work correctly.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Generic semantic aliases (used as bg-background, border-border, etc.)
        background:        v("--color-bg"),
        border:            v("--color-border"),

        // Explicit token names
        bg:                v("--color-bg"),
        "bg-panel":        v("--color-panel"),
        "bg-panel-2":      v("--color-panel-2"),
        "bg-input":        v("--color-input"),
        "text-primary":    v("--color-text"),
        "text-muted":      v("--color-muted"),
        "accent-cyan":     v("--color-accent-cyan"),
        "accent-green":    v("--color-accent-green"),
        "border-dark":     v("--color-border"),
        "warn-amber":      v("--color-warn"),
      },
      backgroundColor: {
        "dark-base":    v("--color-bg"),
        "dark-card":    v("--color-panel"),
        "dark-panel":   v("--color-panel"),
        "dark-panel-2": v("--color-panel-2"),
        "dark-input":   v("--color-input"),
        background:     v("--color-bg"),
      },
      textColor: {
        light:  v("--color-text"),
        muted:  v("--color-muted"),
        accent: v("--color-accent-cyan"),
      },
      borderColor: {
        dark:   v("--color-border"),
        border: v("--color-border"),
      },
    },
  },
  plugins: [],
};
export default config;
