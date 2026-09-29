import { Router } from 'express';
import { z } from 'zod';
import { PublicReportsService } from '../services/public-reports.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

const createBody = z.object({
  reportType: z.enum(['universities', 'abc-xyz', 'rfm', 'period-comparison']),
  params: z.record(z.unknown()).default({}),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  password: z.string().min(4).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);
    const links = await PublicReportsService.listByUser(userId);
    return ok(res, links);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = createBody.parse(req.body);
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const link = await PublicReportsService.create({ ...data, userId });
    return created(res, link);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);
    await PublicReportsService.revoke(req.params.id, userId);
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;