import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';

const router = Router();

const patchBody = z.object({
  onboardingCompleted: z.boolean().optional(),
  onboardingDismissed: z.boolean().optional(),
  tourCompleted: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

router.get('/me', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return ok(res, null);

    let prefs = await prisma.userPreferences.findUnique({ where: { userId } });
    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { user: { connect: { id: userId } } },
      });
    }
    return ok(res, prefs);
  } catch (e) { next(e); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return ok(res, null);

    const data = patchBody.parse(req.body);
    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      update: { ...data, updatedAt: new Date() },
      create: { user: { connect: { id: userId } }, ...data },
    });
    return ok(res, prefs);
  } catch (e) { next(e); }
});

export default router;