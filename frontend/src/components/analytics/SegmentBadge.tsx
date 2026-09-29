import type { RfmSegment } from '@/types';
import { RFM_SEGMENT_LABELS } from '@/lib/analytics';

/**
 * Бейдж RFM-сегмента и ABC/XYZ-категории.
 */

const COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
};

const SEGMENT_COLORS: Record<RfmSegment, keyof typeof COLORS> = {
  champions: 'emerald',
  loyal: 'sky',
  potential_loyalist: 'teal',
  new: 'violet',
  promising: 'indigo',
  need_attention: 'amber',
  about_to_sleep: 'orange',
  at_risk: 'rose',
  cant_lose: 'red',
  hibernating: 'slate',
  lost: 'gray',
};

export function SegmentBadge({ segment }: { segment: RfmSegment }) {
  const cls = COLORS[SEGMENT_COLORS[segment]] ?? COLORS.slate;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
    >
      {RFM_SEGMENT_LABELS[segment]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: 'A' | 'B' | 'C' | 'X' | 'Y' | 'Z' }) {
  const map: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    C: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    X: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    Y: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    Z: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${map[category]}`}
    >
      {category}
    </span>
  );
}