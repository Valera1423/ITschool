import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { FeatureFlagsService } from '../services/feature-flags.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Публично для авторизованных — список флагов
router.get('/me', async (req, res, next) => {
  try {
    const flags = await FeatureFlagsService.getForUser(
      req.auth?.profileId ?? null,
      req.auth?.role ?? null,
    );
    return ok(res, flags);
  } catch (e) { next(e); }
});

// Admin — управление
router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const items = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const data = z.object({
      key: z.string().min(1).regex(/^[a-z0-9_.-]+$/),
      description: z.string().nullable().optional(),
      enabled: z.boolean().default(false),
      rollout: z.number().int().min(0).max(100).nullable().optional(),
      config: z.record(z.unknown()).default({}),
      allowedRoles: z.array(z.string()).default([]),
    }).parse(req.body);

    const item = await prisma.featureFlag.create({ data: data as never });
    await FeatureFlagsService.invalidate();
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:key', requireRole('admin'), async (req, res, next) => {
  try {
    const data = z.object({
      description: z.string().nullable().optional(),
      enabled: z.boolean().optional(),
      rollout: z.number().int().min(0).max(100).nullable().optional(),
      config: z.record(z.unknown()).optional(),
      allowedRoles: z.array(z.string()).optional(),
    }).parse(req.body);

    const item = await prisma.featureFlag.update({
      where: { key: req.params.key },
      data: data as never,
    });
    await FeatureFlagsService.invalidate();
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:key', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.featureFlag.delete({ where: { key: req.params.key } });
    await FeatureFlagsService.invalidate();
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;