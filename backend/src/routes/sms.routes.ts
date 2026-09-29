import { Router } from 'express';
import { z } from 'zod';
import { SmsService } from '../services/sms.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return ok(res, []);
    return ok(res, await SmsService.listForUser(userId));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const data = z.object({
      phone: z.string().min(5),
      event_types: z.array(z.string()).default([]),
      enabled: z.boolean().default(true),
    }).parse(req.body);

    const item = await SmsService.upsert({
      userId,
      phone: data.phone,
      eventTypes: data.event_types,
      enabled: data.enabled,
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);
    await SmsService.remove(req.params.id, userId);
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;