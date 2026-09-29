import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../src/services/analytics.service.js';

describe('AnalyticsService — classifyXyz', () => {
  // Мы не можем вызвать приватный метод напрямую. Но можем проверить
  // через публичный abcXyz() на seed-данных.

  it('abcXyz возвращает структуру', async () => {
    const r = await AnalyticsService.abcXyz();
    expect(r).toHaveProperty('abcItems');
    expect(r).toHaveProperty('xyzItems');
    expect(r).toHaveProperty('matrix');
    expect(r.matrix).toHaveProperty('AX');
    expect(r.matrix).toHaveProperty('CZ');
  });

  it('ABC-категории распределены корректно', async () => {
    const r = await AnalyticsService.abcXyz();
    for (const item of r.abcItems) {
      expect(['A', 'B', 'C']).toContain(item.category);
    }
  });

  it('rfm возвращает валидные сегменты', async () => {
    const r = await AnalyticsService.rfm();
    expect(Array.isArray(r)).toBe(true);
    for (const item of r) {
      expect(item.r_score).toBeGreaterThanOrEqual(1);
      expect(item.r_score).toBeLessThanOrEqual(5);
      expect(item.f_score).toBeGreaterThanOrEqual(1);
      expect(item.f_score).toBeLessThanOrEqual(5);
      expect(item.m_score).toBeGreaterThanOrEqual(1);
      expect(item.m_score).toBeLessThanOrEqual(5);
      expect(item.segment).toMatch(/^(champions|loyal|potential_loyalist|new|at_risk|cant_lose|lost)$/);
    }
  });

  it('ltv возвращает проекцию 12 мес', async () => {
    const r = await AnalyticsService.ltv();
    for (const item of r) {
      expect(item.projected_12m).toBe(Math.round(item.avg_monthly * 12));
    }
  });
});