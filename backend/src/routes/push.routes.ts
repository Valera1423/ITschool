import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { noContent } from '../utils/response.js';
import { PushService } from '../services/push.service.js';

const router = Router();

router.post('/subscribe', async (req, res, next) => {
  try {
    const data = z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
      userAgent: z.string().nullable().optional(),
    }).parse(req.body);

    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);

    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: {
        userId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null,
      },
      create: {
        userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null,
      },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

router.post('/test', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);
    const count = await PushService.send(userId, {
      title: 'ИТ Школа РТК',
      body: 'Push-уведомления работают!',
      url: '/',
    });
    return ok(res, { sent: count });
  } catch (e) { next(e); }
});

router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;