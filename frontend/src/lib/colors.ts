// frontend/src/lib/colors.ts

/**
 * Единый источник цветовых палитр.
 *
 * Все именованные цвета (sky, emerald, amber, rose, violet, teal, slate)
 * определены здесь ОДИН раз и используются везде: теги, события календаря,
 * timeline, сегменты, KB, аватары.
 */

export type ColorName =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'slate';

export interface ColorClasses {
  bg: string;
  text: string;
  dot: string;
  ring: string;
  border: string;
}

export const PALETTE: Record<ColorName, ColorClasses> = {
  sky: {
    bg:     'bg-sky-100 dark:bg-sky-900/40',
    text:   'text-sky-700 dark:text-sky-300',
    dot:    'bg-sky-500',
    ring:   'ring-sky-400',
    border: 'border-sky-300 dark:border-sky-800',
  },
  emerald: {
    bg:     'bg-emerald-100 dark:bg-emerald-900/40',
    text:   'text-emerald-700 dark:text-emerald-300',
    dot:    'bg-emerald-500',
    ring:   'ring-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  amber: {
    bg:     'bg-amber-100 dark:bg-amber-900/40',
    text:   'text-amber-700 dark:text-amber-300',
    dot:    'bg-amber-500',
    ring:   'ring-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
  },
  rose: {
    bg:     'bg-rose-100 dark:bg-rose-900/40',
    text:   'text-rose-700 dark:text-rose-300',
    dot:    'bg-rose-500',
    ring:   'ring-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
  },
  violet: {
    bg:     'bg-violet-100 dark:bg-violet-900/40',
    text:   'text-violet-700 dark:text-violet-300',
    dot:    'bg-violet-500',
    ring:   'ring-violet-400',
    border: 'border-violet-300 dark:border-violet-800',
  },
  teal: {
    bg:     'bg-teal-100 dark:bg-teal-900/40',
    text:   'text-teal-700 dark:text-teal-300',
    dot:    'bg-teal-500',
    ring:   'ring-teal-400',
    border: 'border-teal-300 dark:border-teal-800',
  },
  slate: {
    bg:     'bg-slate-100 dark:bg-slate-800',
    text:   'text-slate-700 dark:text-slate-300',
    dot:    'bg-slate-500',
    ring:   'ring-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
  },
};

export const COLOR_NAMES: ColorName[] = [
  'sky', 'emerald', 'amber', 'rose', 'violet', 'teal', 'slate',
];

export function colorClasses(name: string | null | undefined): ColorClasses {
  return PALETTE[name as ColorName] ?? PALETTE.slate;
}

/**
 * Hex-цвета для не-React компонентов (Leaflet, Recharts).
 */
export const HEX_COLORS: Record<ColorName, string> = {
  sky:     '#0ea5e9',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#ef4444',
  violet:  '#8b5cf6',
  teal:    '#14b8a6',
  slate:   '#64748b',
};

/**
 * Статус → имя цвета (для карт, где нужен hex).
 */
export const STATUS_COLOR_NAMES: Record<string, ColorName> = {
  'Новый':     'sky',
  'Переговоры': 'amber',
  'Обучение':   'violet',
  'Внедрение':  'emerald',
  'Партнёр':    'teal',
  'Отказ':      'rose',
};