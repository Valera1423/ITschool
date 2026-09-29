import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AbService } from '../services/ab.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/me', async (req, res, next) => {
  try {
    const tests = await prisma.abTest.findMany({ where: { enabled: true } });
    const result: Record<string, string | null> = {};
    for (const t of tests) {
      result[t.key] = await AbService.getVariant(t.key, req.auth?.profileId ?? null);
    }
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post('/:key/track', async (req, res, next) => {
  try {
    const data = z.object({
      variant: z.string().min(1),
      eventType: z.string().min(1),
      metadata: z.record(z.unknown()).optional(),
    }).parse(req.body);

    await AbService.track({
      testKey: req.params.key,
      variant: data.variant,
      userId: req.auth?.profileId ?? null,
      eventType: data.eventType,
      metadata: data.metadata,
    });
    return noContent(res);
  } catch (e) { next(e); }
});

// Admin — управление
router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const tests = await prisma.abTest.findMany({ orderBy: { createdAt: 'desc' } });
    return ok(res, tests);
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const data = z.object({
      key: z.string().min(1),
      description: z.string().nullable().optional(),
      variants: z.array(z.object({
        id: z.string(),
        weight: z.number().int().min(1).max(100),
      })).min(2),
      enabled: z.boolean().default(false),
      startAt: z.string().datetime().nullable().optional(),
      endAt: z.string().datetime().nullable().optional(),
    }).parse(req.body);

    // Проверка, что вес = 100
    const total = data.variants.reduce((s, v) => s + v.weight, 0);
    if (total !== 100) {
      return res.status(400).json({
        ok: false,
        code: 'CRM-400-001',
        message: `Сумма весов должна быть 100, получилось ${total}`,
      });
    }

    const item = await prisma.abTest.create({
      data: {
        key: data.key,
        description: data.description ?? null,
        variants: data.variants as never,
        enabled: data.enabled,
        startAt: data.startAt ? new Date(data.startAt) : null,
        endAt: data.endAt ? new Date(data.endAt) : null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.get('/:key/stats', requireRole('admin'), async (req, res, next) => {
  try {
    const stats = await AbService.stats(req.params.key);
    return ok(res, stats);
  } catch (e) { next(e); }
});

export default router;