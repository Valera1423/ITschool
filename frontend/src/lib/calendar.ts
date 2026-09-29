/**
 * Утилиты календаря. Без внешних зависимостей.
 * Используется компонентами Month/Week/Day views.
 */

import { colorClasses, type ColorClasses } from './colors';

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_LONG = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export type CalendarView = 'month' | 'week' | 'day';

/** Date → YYYY-MM-DD */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → Date */
export function parseISODate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

/**
 * Понедельник — первый день недели (российская традиция).
 * getDay() возвращает 0=Вс, 1=Пн ... 6=Сб.
 * Формула (day+6)%7 даёт 0=Пн ... 6=Вс.
 */
export function startOfWeek(d: Date): Date {
  const res = new Date(d);
  const day = (res.getDay() + 6) % 7;
  res.setDate(res.getDate() - day);
  res.setHours(0, 0, 0, 0);
  return res;
}

export function endOfWeek(d: Date): Date {
  const res = startOfWeek(d);
  res.setDate(res.getDate() + 6);
  res.setHours(23, 59, 59, 999);
  return res;
}

export function startOfMonth(d: Date): Date {
  const res = new Date(d.getFullYear(), d.getMonth(), 1);
  res.setHours(0, 0, 0, 0);
  return res;
}

export function endOfMonth(d: Date): Date {
  const res = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Матрица месяца 6×7 (включая дни соседних месяцев).
 * Используется в MonthView.
 */
export function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  const cur = new Date(start);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Массив из 7 дней недели */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

/** Сдвиг даты на delta единиц (день/неделя/месяц) */
export function shift(d: Date, view: CalendarView, delta: number): Date {
  const res = new Date(d);
  if (view === 'day') res.setDate(res.getDate() + delta);
  else if (view === 'week') res.setDate(res.getDate() + delta * 7);
  else res.setMonth(res.getMonth() + delta);
  return res;
}

/** Диапазон часов (7:00 – 21:00 по умолчанию) */
export function hoursRange(from = 7, to = 21): number[] {
  const out: number[] = [];
  for (let h = from; h <= to; h++) out.push(h);
  return out;
}

/** «10:30» → 630 минут */
export function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [hh, mm] = t.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

/** 630 → «10:30» */
export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** «10:30:00», «11:30:00» → «10:30–11:30» */
export function formatTimeRange(start: string | null, end: string | null): string {
  const fmt = (t: string | null) => (t ? t.slice(0, 5) : '');
  if (!start) return '';
  if (!end) return fmt(start);
  return `${fmt(start)}–${fmt(end)}`;
}

export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayLong(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function formatWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()].toLowerCase()} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()].toLowerCase()} — ${end.getDate()} ${MONTHS[end.getMonth()].toLowerCase()} ${end.getFullYear()}`;
}

// ============================================================
// ЦВЕТА СОБЫТИЙ
// ============================================================

/**
 * Цвета событий календаря.
 * @deprecated Спринт 2: используйте colorClasses() из lib/colors.ts
 */
export const EVENT_COLORS: Record<string, ColorClasses> = {
  sky:     colorClasses('sky'),
  emerald: colorClasses('emerald'),
  amber:   colorClasses('amber'),
  rose:    colorClasses('rose'),
  violet:  colorClasses('violet'),
  teal:    colorClasses('teal'),
};

/**
 * @deprecated Спринт 2: используйте colorClasses() из lib/colors.ts
 */
export function eventColor(name: string | null): ColorClasses {
  return colorClasses(name ?? 'sky');
}

/** Автоцвет по типу события. Не меняется. */
export function colorByType(type: string): string {
  switch (type) {
    case 'Встреча': return 'sky';
    case 'Звонок':  return 'emerald';
    case 'Письмо':  return 'amber';
    case 'Документ': return 'violet';
    default: return 'teal';
  }
}