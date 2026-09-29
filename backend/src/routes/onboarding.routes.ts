import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();

router.get('/steps', async (_req, res, next) => {
  try {
    const items = await prisma.onboardingStep.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.get('/progress', async (req, res, next) => {
  try {
    const items = await prisma.onboardingProgress.findMany({
      where: { userId: req.auth!.profileId ?? undefined },
      orderBy: { completedAt: 'asc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/progress', async (req, res, next) => {
  try {
    const { stepKey } = z.object({ stepKey: z.string().min(1) }).parse(req.body);
    const userId = req.auth!.profileId;
    if (!userId) return noContent(res);

    const item = await prisma.onboardingProgress.upsert({
      where: { userId_stepKey: { userId, stepKey } },
      update: {},
      create: { userId, stepKey },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.delete('/progress', async (req, res, next) => {
  try {
    await prisma.onboardingProgress.deleteMany({
      where: { userId: req.auth!.profileId ?? undefined },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;