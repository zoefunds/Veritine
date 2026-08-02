import type { Config } from 'tailwindcss';

// Obsidian Registry design system - see ~/Documents/design/stitch_compact_dark_mode_ui/DESIGN.md
// for the full rationale. Tokens reproduced here as the canonical Veritine
// theme, not copy-pasted markup from the mockups.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0C0E',
        surface: '#16181D',
        'surface-dim': '#121315',
        'surface-bright': '#38393b',
        'surface-container-lowest': '#0d0e10',
        'surface-container-low': '#1b1c1e',
        'surface-container': '#1f2022',
        'surface-container-high': '#292a2c',
        'surface-container-highest': '#343537',
        'on-surface': '#e3e2e5',
        'on-surface-variant': '#c3c6d7',
        outline: '#8d90a0',
        'outline-variant': '#434655',
        primary: '#b4c5ff',
        'on-primary': '#002a78',
        'primary-container': '#2563eb',
        'on-primary-container': '#eeefff',
        secondary: '#adc6ff',
        'on-secondary': '#002e6a',
        'secondary-container': '#0566d9',
        tertiary: '#ffb596',
        'on-tertiary': '#581e00',
        'tertiary-container': '#bc4800',
        error: '#ffb4ab',
        'error-container': '#93000a',
        'text-primary': '#F8FAFC',
        'text-muted': '#94A3B8',
        verified: '#10B981',
        slashed: '#EF4444',
        pending: '#F59E0B',
        'border-subtle': 'rgba(148, 163, 184, 0.12)',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      spacing: {
        base: '4px',
        'margin-mobile': '20px',
        'gutter-mobile': '16px',
        'margin-desktop': '48px',
        'stack-lg': '32px',
        'stack-sm': '8px',
        'gutter-desktop': '24px',
        'stack-md': '16px',
      },
      fontFamily: {
        'body-sm': ['Inter', 'sans-serif'],
        'code-sm': ['JetBrains Mono', 'monospace'],
        'body-md': ['Inter', 'sans-serif'],
        'label-caps': ['JetBrains Mono', 'monospace'],
        'display-lg': ['Geist', 'sans-serif'],
        'headline-lg-mobile': ['Geist', 'sans-serif'],
        'headline-lg': ['Geist', 'sans-serif'],
      },
      fontSize: {
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'code-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};

export default config;
