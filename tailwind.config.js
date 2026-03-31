// tailwind.config.js
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Add Sagitine design tokens
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
        "surface-dim": "rgb(var(--surface-dim) / <alpha-value>)",
        "on-surface": "rgb(var(--on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--on-surface-variant) / <alpha-value>)",
        outline: "rgb(var(--outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-container": "rgb(var(--primary-container) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        tertiary: "rgb(var(--tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--tertiary-container) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
      },
      borderRadius: {
        // Override defaults for sharp corners
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "0px",
      },
      fontFamily: {
        serif: ["Noto Serif", "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};