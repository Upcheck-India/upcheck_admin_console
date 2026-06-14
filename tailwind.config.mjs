/** @type {import('tailwindcss').Config} */

/**
 * Upcheck Design System — Tailwind tokens.
 *
 * The `ocean` scale below IS the brand primary (logo blue #0B6DC7 → cyan #00CDE8).
 * We alias it to both `primary` AND `blue`, so the existing UI — which already uses
 * `blue-600` / `blue-700` / `blue-50` as its de-facto brand color — adopts the
 * Upcheck palette automatically, with no component edits required.
 */
const ocean = {
  50: '#E8FAFD',
  100: '#C2F2FB',
  200: '#7DE3F4',
  300: '#00CDE8', // brand core — logo cyan
  400: '#29BCE6',
  500: '#0EA8D8', // mid-gradient, active tab indicator
  600: '#0D84D6', // default primary button fill
  700: '#0B6DC7', // brand core — logo blue
  800: '#08508F',
  900: '#063A6B',
  950: '#042847',
};

// Brand neutral scale (cool, faintly blue-tinted). Exposed as `neutral` for new
// code. NOTE: existing UI uses `gray`/`slate`, which are intentionally left at
// Tailwind defaults to avoid a sweeping, risky neutral regression.
const neutral = {
  50: '#F5F8FA',
  100: '#EEF2F5',
  200: '#E0E8EC',
  300: '#C8D4DA',
  400: '#A3B5BF',
  500: '#7A909F',
  600: '#556878',
  700: '#3E5163',
  800: '#2C3A48',
  900: '#1A222B',
  950: '#0C1117',
};

const success = { 50: '#EAF7EE', 100: '#D4EDDA', 500: '#27A855', 700: '#1A6B3A', DEFAULT: '#27A855' };
const warning = { 50: '#FEF6E4', 100: '#FDEBC8', 500: '#F08C00', 700: '#8A4700', DEFAULT: '#F08C00' };
const danger  = { 50: '#FDF0F0', 100: '#FAD5D5', 500: '#E03535', 700: '#A41B1B', DEFAULT: '#E03535' };
const info    = { 50: '#EBF4FD', 100: '#CCDFF6', 500: '#1A7FD4', 700: '#0B4F8A', DEFAULT: '#1A7FD4' };

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Brand
        ocean,
        primary: ocean,
        blue: ocean, // remap: themes all existing `blue-*` usage on-brand
        neutral,

        // Semantic status
        success,
        warning,
        danger,
        info,

        // Role tokens (driven by CSS vars in globals.css — auto light/dark)
        surface: 'var(--surface)',
        'surface-variant': 'var(--surface-variant)',
        'border-default': 'var(--border-default)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
      },

      fontFamily: {
        // DM Sans is the default UI/body face; Nunito for display/headings;
        // DM Mono for tabular numeric data (FCR, biomass, SR …).
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-nunito)', 'var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
      },

      borderRadius: {
        // shape language — soft, continuous curves
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
      },

      boxShadow: {
        // blue-tinted, on-brand elevation
        xs: '0 1px 3px rgba(11, 109, 199, 0.06)',
        sm: '0 2px 6px rgba(11, 109, 199, 0.08)',
        md: '0 4px 12px rgba(11, 109, 199, 0.10)',
        lg: '0 8px 20px rgba(11, 109, 199, 0.12)',
        xl: '0 12px 28px rgba(11, 109, 199, 0.16)',
        'brand-glow': '0 4px 16px rgba(0, 205, 232, 0.35)',
      },

      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0B6DC7 0%, #00CDE8 100%)',
        'brand-gradient-vertical': 'linear-gradient(180deg, #0B6DC7 0%, #00CDE8 100%)',
        'brand-gradient-horizontal': 'linear-gradient(90deg, #0B6DC7 0%, #00CDE8 100%)',
        'brand-soft': 'linear-gradient(135deg, #C2F2FB 0%, #E8FAFD 100%)',
        'shimmer': 'linear-gradient(90deg, #EEF2F5 0%, #E0E8EC 50%, #EEF2F5 100%)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        shimmer: 'shimmer 0.8s linear infinite'
      }
    },
  },
  plugins: [],
};
