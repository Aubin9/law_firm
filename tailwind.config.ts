import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          soft: "var(--primary-soft)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--foreground)",
        },
        muted: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          foreground: "var(--primary-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
          foreground: "var(--warning-foreground)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
          foreground: "var(--danger-foreground)",
        },
        info: {
          DEFAULT: "var(--info)",
          soft: "var(--info-soft)",
          foreground: "var(--info-foreground)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        serif: ["var(--font-source-serif)", "serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      fontSize: {
        caption: ["0.75rem", { lineHeight: "1.5" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        body: ["1rem", { lineHeight: "1.5" }],
        lead: ["1.125rem", { lineHeight: "1.5" }],
        h3: ["1.25rem", { lineHeight: "1.25" }],
        h2: ["1.5rem", { lineHeight: "1.25" }],
        h1: ["1.875rem", { lineHeight: "1.25" }],
      },
      borderRadius: {
        dialog: "var(--radius-dialog)",
        lg: "var(--radius-control)",
        md: "6px",
        sm: "4px",
        chip: "var(--radius-chip)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
      transitionDuration: {
        DEFAULT: "175ms",
      },
      transitionTimingFunction: {
        DEFAULT: " cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
