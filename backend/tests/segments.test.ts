import { describe, it, expect } from 'vitest';
import { SegmentsService } from '../src/services/segments.service.js';

describe('SegmentsService', () => {
  it('evaluate возвращает items и total', async () => {
    // Создаём тестовый сегмент
    const { prisma } = await import('../src/db/prisma.js');
    const seg = await prisma.segment.create({
      data: {
        name: '__test_segment__',
        entity: 'universities',
        rules: [{ field: 'status', operator: 'equals', value: 'Новый' }],
        logic: 'AND',
      },
    });

    try {
      const r = await SegmentsService.evaluate(seg.id, { limit: 10 });
      expect(r).toHaveProperty('items');
      expect(r).toHaveProperty('total');
      expect(Array.isArray(r.items)).toBe(true);
    } finally {
      await prisma.segment.delete({ where: { id: seg.id } });
    }
  });
});