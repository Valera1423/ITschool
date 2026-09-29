import { describe, it, expect } from 'vitest';
import {
  toISODate,
  startOfWeek,
  endOfWeek,
  monthMatrix,
  timeToMinutes,
  minutesToTime,
  formatTimeRange,
} from '@/lib/calendar';

describe('calendar', () => {
  it('toISODate: Date → YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 1, 5))).toBe('2026-02-05');
  });

  it('startOfWeek: понедельник', () => {
    const sun = new Date(2026, 1, 8); // вс
    const mon = startOfWeek(sun);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(2);
  });

  it('endOfWeek: воскресенье', () => {
    const sun = endOfWeek(new Date(2026, 1, 5));
    expect(sun.getDay()).toBe(0);
  });

  it('monthMatrix: 6×7', () => {
    const m = monthMatrix(2026, 1);
    expect(m.length).toBe(6);
    expect(m[0].length).toBe(7);
  });

  it('timeToMinutes: "10:30" → 630', () => {
    expect(timeToMinutes('10:30')).toBe(630);
  });

  it('minutesToTime: 630 → "10:30"', () => {
    expect(minutesToTime(630)).toBe('10:30');
  });

  it('formatTimeRange', () => {
    expect(formatTimeRange('10:30:00', '11:30:00')).toBe('10:30–11:30');
  });
});