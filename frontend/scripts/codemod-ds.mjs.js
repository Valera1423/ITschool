// frontend/scripts/codemod-ds.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Codemod для миграции на дизайн-систему.
 *
 * Запуск:
 *   node scripts/codemod-ds.mjs             # dry-run, выводит план
 *   node scripts/codemod-ds.mjs --apply     # применяет изменения
 */

const APPLY = process.argv.includes('--apply');

const REPLACEMENTS = [
  // ── Типографика ──
  [/\btext-2xl\s+font-bold\b/g, 'atmr-h1'],
  [/\btext-xl\s+font-bold\b/g, 'atmr-h2'],
  [/\btext-lg\s+font-bold\b/g, 'atmr-h3'],
  [/\btext-lg\s+font-semibold\b/g, 'atmr-h3'],
  [/\btext-lg\s+font-medium\b/g, 'atmr-h3'],
  [/\btext-base\s+font-semibold\b/g, 'atmr-body-m-strong'],
  [/\btext-base\s+font-medium\b/g, 'atmr-body-m-strong'],
  [/\btext-sm\s+font-semibold\b/g, 'atmr-body-s-strong'],
  [/\btext-sm\s+font-medium\b/g, 'atmr-body-s-strong'],
  [/\btext-xs\s+font-semibold\b/g, 'atmr-desc-l-strong'],
  [/\btext-xs\s+font-medium\b/g, 'atmr-desc-l-strong'],
  [/\btext-\[11px\]\s+font-medium\b/g, 'atmr-desc-m-strong'],
  [/\btext-\[10px\]\s+font-medium\b/g, 'atmr-desc-s-strong'],

  // ── Цвета текста ──
  [/\btext-slate-900\s+dark:text-slate-100\b/g, 'text-atmr-fg'],
  [/\btext-slate-800\s+dark:text-slate-100\b/g, 'text-atmr-fg'],
  [/\btext-slate-800\s+dark:text-slate-200\b/g, 'text-atmr-fg'],
  [/\btext-slate-700\s+dark:text-slate-200\b/g, 'text-atmr-fg'],
  [/\btext-slate-700\s+dark:text-slate-300\b/g, 'text-atmr-fg'],
  [/\btext-slate-600\s+dark:text-slate-300\b/g, 'text-atmr-fg-soft'],
  [/\btext-slate-500\s+dark:text-slate-400\b/g, 'text-atmr-fg-soft'],
  [/\btext-slate-500\s+dark:text-slate-300\b/g, 'text-atmr-fg-soft'],
  [/\btext-slate-300\s+dark:text-slate-600\b/g, 'text-atmr-fg-disabled'],
  [/\btext-slate-400\b/g, 'text-atmr-fg-muted'],

  // ── Фоны ──
  [/\bbg-white\s+dark:bg-slate-900\b/g, 'bg-atmr-bg-surface1'],
  [/\bbg-white\s+dark:bg-slate-800\/60\b/g, 'bg-atmr-bg-surface1'],
  [/\bbg-white\s+dark:bg-slate-800\b/g, 'bg-atmr-bg-surface1'],
  [/\bbg-slate-50\s+dark:bg-slate-800\/60\b/g, 'bg-atmr-bg-surface2'],
  [/\bbg-slate-50\/50\s+dark:bg-slate-800\/40\b/g, 'bg-atmr-bg-surface2'],
  [/\bbg-slate-50\/60\s+dark:bg-slate-800\/40\b/g, 'bg-atmr-bg-surface2'],
  [/\bbg-slate-50\s+dark:bg-slate-800\b/g, 'bg-atmr-bg-surface2'],
  [/\bbg-slate-100\s+dark:bg-slate-800\b/g, 'bg-atmr-bg-surface2'],
  [/\bbg-slate-200\s+dark:bg-slate-700\b/g, 'bg-atmr-bg-surface3'],
  [/\bbg-slate-50\s+dark:bg-slate-950\b/g, 'bg-atmr-bg-page'],
  [/\bbg-slate-50\s+dark:bg-slate-900\b/g, 'bg-atmr-bg-page'],

  // ── Границы ──
  [/\bborder-slate-100\s+dark:border-slate-800\b/g, 'border-atmr-border-soft'],
  [/\bborder-slate-200\s+dark:border-slate-800\b/g, 'border-atmr-border'],
  [/\bborder-slate-200\s+dark:border-slate-700\b/g, 'border-atmr-border'],
  [/\bdivide-slate-50\s+dark:divide-slate-800\b/g, 'divide-atmr-border-soft'],
  [/\bdivide-slate-100\s+dark:divide-slate-800\b/g, 'divide-atmr-border-soft'],

  // ── Акценты ──
  [/\bbg-sky-600\b/g, 'bg-atmr-accent'],
  [/\bbg-sky-500\b/g, 'bg-atmr-accent'],
  [/\btext-sky-600\b/g, 'text-atmr-accent'],
  [/\btext-sky-700\b/g, 'text-atmr-accent'],
  [/\bborder-sky-400\b/g, 'border-atmr-accent'],
  [/\bborder-sky-500\b/g, 'border-atmr-accent'],
  [/\bhover:bg-sky-700\b/g, 'hover:bg-atmr-accent-hover'],
  [/\bhover:text-sky-700\b/g, 'hover:text-atmr-accent-hover'],
  [/\bfocus:ring-sky-500\b/g, 'focus:ring-atmr-accent'],
  [/\bfocus:border-sky-500\b/g, 'focus:border-atmr-accent'],
  [/\bring-sky-400\b/g, 'ring-atmr-accent'],
  [/\bring-sky-500\b/g, 'ring-atmr-accent'],
  [/\bbg-sky-100\s+dark:bg-sky-900\/40\b/g, 'bg-atmr-accent-soft'],
  [/\bbg-sky-100\s+dark:bg-sky-900\/50\b/g, 'bg-atmr-accent-soft'],
  [/\bbg-sky-100\s+dark:bg-sky-900\/60\b/g, 'bg-atmr-accent-soft'],
  [/\bbg-sky-50\s+dark:bg-sky-900\/40\b/g, 'bg-atmr-accent-soft'],
  [/\bbg-sky-50\s+dark:bg-sky-900\/20\b/g, 'bg-atmr-accent-soft'],
  [/\bbg-sky-50\/40\s+dark:bg-sky-900\/10\b/g, 'bg-atmr-accent-muted'],

  // ── Скругления ──
  [/\brounded-3xl\b/g, 'rounded-atmr-2xl'],
  [/\brounded-2xl\b/g, 'rounded-atmr-xl'],
  [/\brounded-xl\b/g, 'rounded-atmr-l'],
  [/\brounded-lg\b/g, 'rounded-atmr-m'],
  [/\brounded-full\b/g, 'rounded-atmr-full'],

  // ── Тени ──
  [/\bshadow-2xl\b/g, 'shadow-atmr-xl'],
  [/\bshadow-xl\b/g, 'shadow-atmr-l'],
  [/\bshadow-lg\b/g, 'shadow-atmr-l'],
  [/\bshadow-md\b/g, 'shadow-atmr-m'],
  [/\bshadow-sm\b/g, 'shadow-atmr-s'],

  // ── Z-index ──
  [/\bz-\[100\]\b/g, 'z-atmr-3xl'],
  [/\bz-\[90\]\b/g,  'z-atmr-3xl'],
  [/\bz-\[80\]\b/g,  'z-atmr-3xl'],
  [/\bz-\[70\]\b/g,  'z-atmr-3xl'],
  [/\bz-\[60\]\b/g,  'z-atmr-3xl'],
  [/\bz-50\b/g,      'z-atmr-3xl'],
  [/\bz-40\b/g,      'z-atmr-2xl'],
  [/\bz-30\b/g,      'z-atmr-l'],
  [/\bz-20\b/g,      'z-atmr-m'],
];

const STATUS_REPLACEMENTS = [
  // Success
  [/\btext-emerald-600\b/g, 'text-atmr-success'],
  [/\btext-emerald-500\b/g, 'text-atmr-success'],
  [/\bbg-emerald-500\b/g, 'bg-atmr-success'],
  [/\bbg-emerald-100\s+dark:bg-emerald-900\/40\b/g, 'bg-atmr-success-soft'],
  [/\bbg-emerald-50\s+dark:bg-emerald-900\/20\b/g, 'bg-atmr-success-soft'],
  [/\bbg-emerald-50\/40\s+dark:bg-emerald-900\/20\b/g, 'bg-atmr-success-soft'],
  [/\bborder-emerald-100\s+dark:border-emerald-900\/40\b/g, 'border-atmr-success-soft'],

  // Error
  [/\btext-rose-600\b/g, 'text-atmr-error'],
  [/\btext-rose-500\b/g, 'text-atmr-error'],
  [/\bbg-rose-500\b/g, 'bg-atmr-error'],
  [/\bbg-rose-100\s+dark:bg-rose-900\/40\b/g, 'bg-atmr-error-soft'],
  [/\bbg-rose-50\s+dark:bg-rose-900\/20\b/g, 'bg-atmr-error-soft'],
  [/\bbg-rose-50\/40\s+dark:bg-rose-900\/20\b/g, 'bg-atmr-error-soft'],
  [/\bborder-rose-100\s+dark:border-rose-900\/40\b/g, 'border-atmr-error-soft'],

  // Warning
  [/\btext-amber-600\b/g, 'text-atmr-warning'],
  [/\btext-amber-500\b/g, 'text-atmr-warning'],
  [/\bbg-amber-500\b/g, 'bg-atmr-warning'],
  [/\bbg-amber-100\s+dark:bg-amber-900\/40\b/g, 'bg-atmr-warning-soft'],
  [/\bbg-amber-50\s+dark:bg-amber-900\/20\b/g, 'bg-atmr-warning-soft'],
  [/\bbg-amber-50\/40\s+dark:bg-amber-900\/20\b/g, 'bg-atmr-warning-soft'],
  [/\bborder-amber-100\s+dark:border-amber-900\/40\b/g, 'border-atmr-warning-soft'],
];

const ALL_REPLACEMENTS = [...REPLACEMENTS, ...STATUS_REPLACEMENTS];

const ROOT = new URL('../src', import.meta.url).pathname;
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.storybook',
]);
const SKIP_FILES = [
  'ui.tsx', 'Skeleton.tsx', 'NotificationsPanel.tsx',
  'AutoDraftIndicator.tsx', 'SwUpdateBanner.tsx', 'OfflineBanner.tsx',
  'InstallPrompt.tsx', 'TagPicker.tsx', 'MessengerLinks.tsx',
  'InlineEdit.tsx', 'ResponsiveTable.tsx', 'ThemeProvider.tsx',
];

let changedFiles = 0;
let totalChanges = 0;
const fileReport = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p);
    } else if (st.isFile()) {
      const ext = extname(name);
      if (!['.ts', '.tsx'].includes(ext)) continue;
      if (SKIP_FILES.includes(name)) continue;
      processFile(p);
    }
  }
}

function processFile(path) {
  const original = readFileSync(path, 'utf-8');
  let text = original;
  let localChanges = 0;

  for (const [pattern, replacement] of ALL_REPLACEMENTS) {
    const before = text;
    text = text.replace(pattern, replacement);
    if (text !== before) {
      localChanges += 1;
    }
  }

  if (text !== original) {
    changedFiles += 1;
    totalChanges += localChanges;
    fileReport.push({ path, changes: localChanges });
    if (APPLY) {
      writeFileSync(path, text, 'utf-8');
    }
  }
}

walk(ROOT);

console.log('\n══════════════════════════════════════════════════════════════');
console.log(APPLY ? '  CODEMOD ПРИМЕНЁН' : '  CODEMOD — DRY RUN (ничего не изменено)');
console.log('══════════════════════════════════════════════════════════════');
console.log(`  Файлов затронуто:     ${changedFiles}`);
console.log(`  Правок:               ${totalChanges}`);
console.log('');

if (fileReport.length > 0) {
  console.log('  Топ-20 файлов по количеству правок:');
  fileReport
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 20)
    .forEach((r) => {
      const rel = r.path.replace(ROOT, 'src');
      console.log(`    ${String(r.changes).padStart(4)} — ${rel}`);
    });
  console.log('');
}

if (!APPLY) {
  console.log('  Запустите с флагом --apply, чтобы применить изменения.');
}
console.log('══════════════════════════════════════════════════════════════\n');