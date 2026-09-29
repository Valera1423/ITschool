import { describe, it, expect } from 'vitest';
import {
  asArray,
  daysUntil,
  formatDate,
  todayISO,
  initials,
  formatBytes,
} from '@/lib/utils';

describe('utils', () => {
  it('asArray: массив → массив', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
  });
  it('asArray: не массив → []', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray('x')).toEqual([]);
  });

  it('formatDate: валидная → "5 февр."', () => {
    expect(formatDate('2026-02-05')).toMatch(/5.*февр/);
  });
  it('formatDate: битая → "—"', () => {
    expect(formatDate('nope')).toBe('—');
  });

  it('daysUntil: завтра → 1', () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const iso = todayISO();
    void iso;
    const tomorrow = new Date(t);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    expect(daysUntil(`${y}-${m}-${d}`)).toBe(1);
  });

  it('initials: "Иван Петров" → "ИП"', () => {
    expect(initials('Иван Петров')).toBe('ИП');
  });
  it('initials: пустое → "?"', () => {
    expect(initials('')).toBe('?');
  });

  it('formatBytes: 1024 → "1.0 КБ"', () => {
    expect(formatBytes(1024)).toBe('1.0 КБ');
  });
});