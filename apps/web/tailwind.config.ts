/**
 * Tailwind CSS v4.1 Configuration
 * 
 * Note: Tailwind v4 uses CSS-first configuration via @theme directive in globals.css.
 * This config file is kept minimal for compatibility with tooling (shadcn/ui, etc.).
 * 
 * Most configuration is done in src/app/globals.css using:
 * - @theme directive for custom properties
 * - @custom-variant for dark mode
 * - @plugin for plugins
 * 
 * Content paths are auto-detected in v4, but we specify them here for explicit control.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode is configured in CSS via @custom-variant dark in globals.css
  // Keeping this for tooling compatibility, but CSS takes precedence
  darkMode: "class",
  
  // Content paths - Tailwind v4 auto-detects, but we specify for explicit control
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  
  // Theme configuration is primarily in globals.css via @theme directive
  // This minimal config ensures TypeScript types work correctly
  theme: {
    extend: {
      // Semantic color tokens reference CSS custom properties defined in @theme
      // This allows nested access like background.primary in TypeScript
      colors: {
        background: {
          primary: "var(--color-background-primary)",
          secondary: "var(--color-background-secondary)",
          tertiary: "var(--color-background-tertiary)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
        },
        border: {
          primary: "var(--color-border-primary)",
          secondary: "var(--color-border-secondary)",
        },
        selection: "var(--color-selection)",
      },
    },
  },
};

export default config;

