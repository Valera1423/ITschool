// ============================================================
// ЗАЩИТА ОТ undefined
// ============================================================

/** Всегда возвращает массив. */
export function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ============================================================
// БЕЗОПАСНЫЕ ДАТЫ
// ============================================================

function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const s = String(value);

  // YYYY-MM-DD без TZ — парсим как локальную дату,
  // чтобы не было сдвига на UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // ISO или иной формат — доверяем браузеру
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: string): string {
  const d = safeDate(date);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function formatDateLong(date: string): string {
  const d = safeDate(date);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string): string {
  const d = safeDate(date);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Сегодня в формате YYYY-MM-DD (локальная таймзона).
 *
 * ВАЖНО: не используем toISOString().slice(0,10) — она даёт UTC-дату,
 * и в 00:00–03:00 МСК вернёт вчерашний день.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Сколько дней до даты.
 * Возвращает null если дата невалидна — НЕ 0, чтобы не путать
 * «сегодня» и «битая дата».
 */
export function daysUntil(date: string): number | null {
  const d = safeDate(date);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  return Math.round(diff / 86400000);
}

export function isOverdue(date: string): boolean {
  const d = daysUntil(date);
  return d !== null && d < 0;
}

export function isDueSoon(date: string): boolean {
  const d = daysUntil(date);
  return d !== null && d >= 0 && d <= 2;
}

// ============================================================
// ПРОЧЕЕ
// ============================================================

export function initials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Скачать CSV. Append в DOM нужен для Safari/Firefox. */
export function downloadCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/** Скачать JSON. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/**
 * Общий хелпер для скачивания blob'а.
 * Append в DOM обязателен — иначе в Firefox/Safari click() не сработает.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Освобождаем URL асинхронно, чтобы браузер успел начать загрузку
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mailto(email: string, subject: string, body: string): void {
  const link = document.createElement('a');
  link.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: number | null = null;
  return ((...args: unknown[]) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  }) as T;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function getByPath<T = unknown>(obj: unknown, path: string): T | undefined {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj) as T | undefined;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================
// ЧЕРНОВИКИ (используется DraftForm + AuthContext.signOut)
// ============================================================

const DRAFT_PREFIX = 'crm:draft:';

/** Удалить все черновики форм. Вызывать при logout. */
export function clearAllDrafts(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DRAFT_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}