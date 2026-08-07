import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tailwind is configured as a *consumer* of the design tokens, never as the
 * source of truth. Every color resolves to a CSS custom property so that a
 * tenant can repaint the whole product at runtime (multi-tenant branding)
 * without a rebuild. Tokens are stored as raw RGB channels so Tailwind's
 * opacity modifiers (`bg-brand/10`) keep working.
 */
const withAlpha = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: withAlpha('--surface'),
          raised: withAlpha('--surface-raised'),
          sunken: withAlpha('--surface-sunken'),
          inverted: withAlpha('--surface-inverted'),
        },
        content: {
          DEFAULT: withAlpha('--content'),
          muted: withAlpha('--content-muted'),
          subtle: withAlpha('--content-subtle'),
          inverted: withAlpha('--content-inverted'),
        },
        line: {
          DEFAULT: withAlpha('--border'),
          strong: withAlpha('--border-strong'),
        },
        brand: {
          DEFAULT: withAlpha('--brand'),
          hover: withAlpha('--brand-hover'),
          active: withAlpha('--brand-active'),
          subtle: withAlpha('--brand-subtle'),
          contrast: withAlpha('--brand-contrast'),
        },
        success: {
          DEFAULT: withAlpha('--success'),
          subtle: withAlpha('--success-subtle'),
        },
        warning: {
          DEFAULT: withAlpha('--warning'),
          subtle: withAlpha('--warning-subtle'),
        },
        danger: {
          DEFAULT: withAlpha('--danger'),
          subtle: withAlpha('--danger-subtle'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      maxWidth: {
        container: 'var(--container-max)',
        prose: '68ch',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      keyframes: {
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'content-in': {
          from: { opacity: '0', transform: 'translate(-50%, calc(-50% + 8px)) scale(0.98)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'content-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, calc(-50% + 4px)) scale(0.99)' },
        },
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in var(--duration-base) ease-out',
        'content-in': 'content-in var(--duration-base) cubic-bezier(0.16, 1, 0.3, 1)',
        'content-out': 'content-out var(--duration-fast) ease-in',
        'sheet-in': 'sheet-in var(--duration-fast) ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
