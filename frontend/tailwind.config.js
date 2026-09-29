/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Accent ──
        'atmr-accent': {
          DEFAULT: 'var(--atmr-accent-default)',
          hover:   'var(--atmr-accent-hover)',
          active:  'var(--atmr-accent-active)',
          soft:    'var(--atmr-accent-soft)',
          muted:   'var(--atmr-accent-muted)',
          on:      'var(--atmr-accent-on-accent)',
        },
        // ── Hover-состояния ──
        'atmr-surface-hover':  'var(--atmr-surface-hover)',
        'atmr-surface-active': 'var(--atmr-surface-active)',
        'atmr-border-hover':   'var(--atmr-border-hover)',

        // ── Foreground ──
        'atmr-fg': {
          DEFAULT:  'var(--atmr-fg-default)',
          soft:     'var(--atmr-fg-soft)',
          muted:    'var(--atmr-fg-muted)',
          disabled: 'var(--atmr-fg-disabled)',
          inverse:  'var(--atmr-fg-inverse)',
        },
        // ── Background ──
        'atmr-bg': {
          page:     'var(--atmr-bg-page)',
          filled:   'var(--atmr-bg-filled)',
          surface1: 'var(--atmr-bg-surface1)',
          surface2: 'var(--atmr-bg-surface2)',
          surface3: 'var(--atmr-bg-surface3)',
          surface4: 'var(--atmr-bg-surface4)',
          surface5: 'var(--atmr-bg-surface5)',
          disabled: 'var(--atmr-bg-disabled)',
        },
        // ── Border ──
        'atmr-border': {
          DEFAULT: 'var(--atmr-border-default)',
          soft:    'var(--atmr-border-soft)',
          muted:   'var(--atmr-border-muted)',
          strong:  'var(--atmr-border-strong)',
        },
        // ── Success ──
        'atmr-success': {
          DEFAULT: 'var(--atmr-success-default)',
          soft:    'var(--atmr-success-soft)',
          fg:      'var(--atmr-success-fg)',
          on:      'var(--atmr-success-on)',
        },
        // ── Warning ──
        'atmr-warning': {
          DEFAULT: 'var(--atmr-warning-default)',
          soft:    'var(--atmr-warning-soft)',
          fg:      'var(--atmr-warning-fg)',
          on:      'var(--atmr-warning-on)',
        },
        // ── Error ──
        'atmr-error': {
          DEFAULT: 'var(--atmr-error-default)',
          soft:    'var(--atmr-error-soft)',
          fg:      'var(--atmr-error-fg)',
          on:      'var(--atmr-error-on)',
        },
        // ── Info ──
        'atmr-info': {
          DEFAULT: 'var(--atmr-info-default)',
          soft:    'var(--atmr-info-soft)',
          fg:      'var(--atmr-info-fg)',
          on:      'var(--atmr-info-on)',
        },
        // ── Status-01..06 ──
        'atmr-status-01': {
          DEFAULT: 'var(--atmr-status-01-default)',
          soft:    'var(--atmr-status-01-soft)',
          muted:   'var(--atmr-status-01-muted)',
        },
        'atmr-status-02': {
          DEFAULT: 'var(--atmr-status-02-default)',
          soft:    'var(--atmr-status-02-soft)',
          muted:   'var(--atmr-status-02-muted)',
        },
        'atmr-status-03': {
          DEFAULT: 'var(--atmr-status-03-default)',
          soft:    'var(--atmr-status-03-soft)',
          muted:   'var(--atmr-status-03-muted)',
        },
        'atmr-status-04': {
          DEFAULT: 'var(--atmr-status-04-default)',
          soft:    'var(--atmr-status-04-soft)',
          muted:   'var(--atmr-status-04-muted)',
        },
        'atmr-status-05': {
          DEFAULT: 'var(--atmr-status-05-default)',
          soft:    'var(--atmr-status-05-soft)',
          muted:   'var(--atmr-status-05-muted)',
        },
        'atmr-status-06': {
          DEFAULT: 'var(--atmr-status-06-default)',
          soft:    'var(--atmr-status-06-soft)',
          muted:   'var(--atmr-status-06-muted)',
        },
        // ── Static ──
        'atmr-static-black': 'var(--atmr-static-black)',
        'atmr-static-white': 'var(--atmr-static-white)',
      },

      spacing: {
        'atmr-0-5': 'var(--atmr-spacing-0-5x)',
        'atmr-1':   'var(--atmr-spacing-1x)',
        'atmr-1-5': 'var(--atmr-spacing-1-5x)',
        'atmr-2':   'var(--atmr-spacing-2x)',
        'atmr-3':   'var(--atmr-spacing-3x)',
        'atmr-4':   'var(--atmr-spacing-4x)',
        'atmr-5':   'var(--atmr-spacing-5x)',
        'atmr-6':   'var(--atmr-spacing-6x)',
        'atmr-8':   'var(--atmr-spacing-8x)',
        'atmr-10':  'var(--atmr-spacing-10x)',
        'atmr-12':  'var(--atmr-spacing-12x)',
        'atmr-16':  'var(--atmr-spacing-16x)',
      },

      borderRadius: {
        'atmr-2xs':  'var(--atmr-border-radius-2xs)',
        'atmr-xs':   'var(--atmr-border-radius-xs)',
        'atmr-s':    'var(--atmr-border-radius-s)',
        'atmr-m':    'var(--atmr-border-radius-m)',
        'atmr-l':    'var(--atmr-border-radius-l)',
        'atmr-xl':   'var(--atmr-border-radius-xl)',
        'atmr-2xl':  'var(--atmr-border-radius-2xl)',
        'atmr-full': 'var(--atmr-border-radius-full)',
      },

      boxShadow: {
        'atmr-none':      'var(--atmr-shadow-none)',
        'atmr-s':         'var(--atmr-shadow-bottom-s)',
        'atmr-m':         'var(--atmr-shadow-bottom-m)',
        'atmr-l':         'var(--atmr-shadow-bottom-l)',
        'atmr-xl':        'var(--atmr-shadow-bottom-xl)',
        'atmr-accent-s':  'var(--atmr-shadow-bottom-accent-s)',
        'atmr-accent-m':  'var(--atmr-shadow-bottom-accent-m)',
        'atmr-accent-l':  'var(--atmr-shadow-bottom-accent-l)',
        'atmr-accent-xl': 'var(--atmr-shadow-bottom-accent-xl)',
        'atmr-top-s':     'var(--atmr-shadow-top-s)',
        'atmr-top-m':     'var(--atmr-shadow-top-m)',
        'atmr-top-l':     'var(--atmr-shadow-top-l)',
        'atmr-top-xl':    'var(--atmr-shadow-top-xl)',
      },

      zIndex: {
        'atmr-hide':     '-1',
        'atmr-default':  '0',
        'atmr-dropdown': '1000',
        'atmr-sticky':   '1100',
        'atmr-fab':      '1200',
        'atmr-overlay':  '1300',
        'atmr-loader':   '1400',
        'atmr-modal':    '1500',
        'atmr-toast':    '1600',
        'atmr-popover':  '1700',
        'atmr-tooltip':  '1800',
      },

      transitionDuration: {
        'atmr-2xs': '100ms',
        'atmr-xs':  '150ms',
        'atmr-s':   '200ms',
        'atmr-m':   '300ms',
        'atmr-l':   '600ms',
        'atmr-xl':  '1200ms',
      },

      transitionTimingFunction: {
        'atmr-linear':              'var(--atmr-motion-easing-linear)',
        'atmr-productive-standard': 'var(--atmr-motion-easing-productive-standard)',
        'atmr-productive-entrance': 'var(--atmr-motion-easing-productive-entrance)',
        'atmr-productive-exit':     'var(--atmr-motion-easing-productive-exit)',
        'atmr-productive-bouncing': 'var(--atmr-motion-easing-productive-bouncing)',
        'atmr-expressive-standard': 'var(--atmr-motion-easing-expressive-standard)',
        'atmr-expressive-entrance': 'var(--atmr-motion-easing-expressive-entrance)',
        'atmr-expressive-exit':     'var(--atmr-motion-easing-expressive-exit)',
        'atmr-expressive-bouncing': 'var(--atmr-motion-easing-expressive-bouncing)',
      },

      screens: {
        '2xs': '0px',
        'xs':  '480px',
        's':   '768px',
        'm':   '1024px',
        'l':   '1280px',
        'xl':  '1600px',
      },
    },
  },
  plugins: [],
};