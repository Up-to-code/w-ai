import type { Config } from "tailwindcss";
const { fontFamily } = require("tailwindcss/defaultTheme");

const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./ui/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // ----------------------------------------------------------------
      // W-AI foundation palette + schema colors
      // All values mirror the CSS variables in globals.css so they can be
      // used both as Tailwind utilities (bg-w-green) and CSS vars.
      // ----------------------------------------------------------------
      colors: {
        // shadcn semantic tokens
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // W-AI named foundation tokens (direct hex for design fidelity)
        "w-black":  "#111111",
        "w-carbon": "#242424",
        "w-graphite": "#6B6B6B",
        "w-mist":   "#E9E9E7",
        "w-canvas": "#F7F7F5",

        // W-AI schema colors — strong + soft pairs
        "w-blue":        "hsl(var(--w-blue))",
        "w-blue-soft":   "hsl(var(--w-blue-soft))",
        "w-green":       "hsl(var(--w-green))",
        "w-green-soft":  "hsl(var(--w-green-soft))",
        "w-yellow":      "hsl(var(--w-yellow))",
        "w-yellow-soft": "hsl(var(--w-yellow-soft))",
        "w-orange":      "hsl(var(--w-orange))",
        "w-orange-soft": "hsl(var(--w-orange-soft))",
        "w-red":         "hsl(var(--w-red))",
        "w-red-soft":    "hsl(var(--w-red-soft))",
        "w-purple":      "hsl(var(--w-purple))",
        "w-purple-soft": "hsl(var(--w-purple-soft))",
        "w-pink":        "hsl(var(--w-pink))",
        "w-pink-soft":   "hsl(var(--w-pink-soft))",
        "w-brown":       "hsl(var(--w-brown))",
        "w-brown-soft":  "hsl(var(--w-brown-soft))",
      },

      // ----------------------------------------------------------------
      // Border radius — architectural, not pill-shaped SaaS
      // ----------------------------------------------------------------
      borderRadius: {
        none: "0px",
        sm:   "4px",
        DEFAULT: "8px",
        md:   "8px",
        lg:   "12px",
        // shadcn variable-driven aliases
        "shadcn-lg": "var(--radius)",
        "shadcn-md": "calc(var(--radius) - 2px)",
        "shadcn-sm": "calc(var(--radius) - 4px)",
      },

      // ----------------------------------------------------------------
      // Typography — Geist primary, Tajawal for Arabic
      // ----------------------------------------------------------------
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "var(--font-tajawal)",
          ...fontFamily.sans,
        ],
        arabic: [
          "var(--font-tajawal)",
          ...fontFamily.sans,
        ],
        mono: [
          "var(--font-geist-mono)",
          ...fontFamily.mono,
        ],
        heading: [
          "var(--font-geist-sans)",
          "var(--font-tajawal)",
          ...fontFamily.sans,
        ],
      },

      // ----------------------------------------------------------------
      // W-AI type scale
      // ----------------------------------------------------------------
      fontSize: {
        // Metadata labels
        "meta":    ["0.75rem",  { lineHeight: "1.5",   letterSpacing: "0.08em", fontWeight: "500" }],
        // Body
        "body-sm": ["0.9375rem", { lineHeight: "1.65" }],
        "body":    ["1rem",     { lineHeight: "1.65" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6"  }],
        // Headings
        "h3":      ["1.25rem",  { lineHeight: "1.4",  fontWeight: "500" }],
        "h2":      ["1.75rem",  { lineHeight: "1.3",  fontWeight: "500" }],
        "h1":      ["2.5rem",   { lineHeight: "1.2",  fontWeight: "600" }],
        // Display
        "display-sm": ["3rem",  { lineHeight: "1.1",  letterSpacing: "-0.02em", fontWeight: "600" }],
        "display":    ["3.75rem",{ lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "600" }],
        "display-lg": ["4.5rem", { lineHeight: "1",    letterSpacing: "-0.03em",  fontWeight: "600" }],
      },

      // ----------------------------------------------------------------
      // Motion — brand-spec durations only
      // ----------------------------------------------------------------
      transitionDuration: {
        "brand-fast": "200ms",
        "brand":      "250ms",
        "brand-slow": "400ms",
      },
      transitionTimingFunction: {
        "brand": "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      // ----------------------------------------------------------------
      // Keyframes (kept from original + cleaned up)
      // ----------------------------------------------------------------
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          "0%":   { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "infinite-scroll": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up":    "accordion-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-up":         "fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-down":       "fade-down 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in":         "fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "infinite-scroll": "infinite-scroll 25s linear infinite",
      },

      // ----------------------------------------------------------------
      // Box shadows — very subtle, no hard drop shadows
      // ----------------------------------------------------------------
      boxShadow: {
        "xs": "var(--shadow-xs)",
        "sm": "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        "card": "0 0 0 1px hsl(var(--border))",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config;

export default config;
