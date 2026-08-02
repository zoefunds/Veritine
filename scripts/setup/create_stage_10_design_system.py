#!/usr/bin/env python3
"""
Veritine - Stage 10: Design system (Tailwind + Obsidian Registry tokens).

Installs and configures Tailwind CSS in apps/web using the exact color,
spacing, typography, and radius tokens documented in
~/Documents/design/stitch_compact_dark_mode_ui/DESIGN.md, so the full
page redesigns (landing, dashboard, dispute explorer, dispute detail)
can use the same utility-class vocabulary as the Stitch mockups - as a
design-token reference, not copy-pasted markup.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_10_design_system.py
"""

import os
import sys

ROOT = os.getcwd()
FILES = {}

FILES["apps/web/tailwind.config.ts"] = """import type { Config } from 'tailwindcss';

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
"""

FILES["apps/web/postcss.config.js"] = """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"""

FILES["apps/web/app/globals.css"] = """@tailwind base;
@tailwind components;
@tailwind utilities;

/* Obsidian Registry base styles - see DESIGN.md for rationale. */

* {
  box-sizing: border-box;
}

html,
body {
  padding: 0;
  margin: 0;
  background-color: #0B0C0E;
  color: #e3e2e5;
  -webkit-font-smoothing: antialiased;
}

.ghost-border {
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.glass-nav {
  backdrop-filter: blur(12px);
  background: rgba(22, 24, 29, 0.4);
}

.status-strip-verified { border-left: 3px solid #10B981; }
.status-strip-slashed { border-left: 3px solid #EF4444; }
.status-strip-pending { border-left: 3px solid #F59E0B; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #343537; border-radius: 10px; }

/* Legacy CSS-variable aliases kept for components not yet migrated to
   Tailwind classes (e.g. inline styles in earlier-phase forms). */
:root {
  --surface: #16181d;
  --surface-container-lowest: #0d0e10;
  --surface-container-low: #1b1c1e;
  --surface-container: #1f2022;
  --surface-container-high: #292a2c;
  --on-surface: #e3e2e5;
  --border-subtle: rgba(148, 163, 184, 0.12);
  --primary: #b4c5ff;
  --on-primary-container: #eeefff;
  --primary-container: #2563eb;
  --verified: #10b981;
  --slashed: #ef4444;
  --pending: #f59e0b;
  --background: #0b0c0e;
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;
}
"""


def main():
    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)
    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
