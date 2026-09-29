import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { OneCService } from '../services/exports/one-c.service.js';
import { SapService } from '../services/exports/sap.service.js';
import { ok } from '../utils/response.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.post('/1c/contracts/:id', requireRole('admin', 'manager'), strictRateLimit, async (req, res, next) => {
  try {
    const result = await OneCService.exportContract(req.params.id, req.auth!.profileId ?? '');
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post('/sap/universities/:id', requireRole('admin', 'manager'), strictRateLimit, async (req, res, next) => {
  try {
    const result = await SapService.exportUniversity(req.params.id, req.auth!.profileId ?? '');
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/logs', requireRole('admin'), async (req, res, next) => {
  try {
    const q = z.object({
      system: z.string().optional(),
      entity: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().min(1).max(500).default(100),
    }).parse(req.query);

    const items = await prisma.externalExportLog.findMany({
      where: {
        system: q.system,
        entity: q.entity,
        status: q.status,
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

export default router;