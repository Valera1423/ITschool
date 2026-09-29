import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';

interface Variant {
  id: string;
  weight: number;
}

export class AbService {
  /**
   * Определить вариант для пользователя.
   * Детерминированно: hash(testKey + userId) % 100 → попадает в bucket варианта.
   */
  static async getVariant(testKey: string, userId: string | null): Promise<string | null> {
    const test = await prisma.abTest.findUnique({ where: { key: testKey } });
    if (!test || !test.enabled) return null;

    const now = new Date();
    if (test.startAt && test.startAt > now) return null;
    if (test.endAt && test.endAt < now) return null;

    const variants = (test.variants ?? []) as Variant[];
    if (variants.length === 0) return null;
    if (!userId) return variants[0].id; // fallback на control

    const hash = createHash('md5').update(`${testKey}:${userId}`).digest('hex');
    const bucket = parseInt(hash.slice(0, 8), 16) % 100;

    let cumulative = 0;
    for (const v of variants) {
      cumulative += v.weight;
      if (bucket < cumulative) return v.id;
    }

    return variants[0].id;
  }

  /**
   * Записать событие.
   */
  static async track(params: {
    testKey: string;
    variant: string;
    userId: string | null;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.abTestEvent.create({
  data: {
    testKey: params.testKey,
    variant: params.variant,
    userId: params.userId,  // уже nullable после миграции
    eventType: params.eventType,
    metadata: (params.metadata ?? {}) as never,
  },
});
    } catch { /* ignore */ }
  }

  /**
   * Метрики теста.
   */
  static async stats(testKey: string) {
    const events = await prisma.abTestEvent.groupBy({
      by: ['variant', 'eventType'],
      where: { testKey },
      _count: { id: true },
    });

    const map: Record<string, Record<string, number>> = {};
    for (const e of events) {
      if (!map[e.variant]) map[e.variant] = {};
      map[e.variant][e.eventType] = e._count.id;
    }

    return map;
  }
}