import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';

const router = Router();

const patchBody = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  phone: z.string().nullable().optional(),
  workspaceName: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});

/**
 * GET /settings/profile — singleton workspace settings.
 * Если записи нет — создаём с дефолтами.
 */
router.get('/profile', async (_req, res, next) => {
  try {
    let row = await prisma.profileSettings.findFirst();
    if (!row) {
      row = await prisma.profileSettings.create({
        data: {
          fullName: 'Пользователь',
          email: 'user@rt.ru',
          role: 'nam',
          workspaceName: 'ИТ Школа РТК',
          notificationsEnabled: true,
        },
      });
    }
    return ok(res, row);
  } catch (e) { next(e); }
});

router.patch('/profile', async (req, res, next) => {
  try {
    const data = patchBody.parse(req.body);
    let row = await prisma.profileSettings.findFirst();
    if (!row) {
      row = await prisma.profileSettings.create({
        data: {
          fullName: data.fullName ?? 'Пользователь',
          email: data.email ?? 'user@rt.ru',
          role: data.role ?? 'nam',
          workspaceName: data.workspaceName ?? 'ИТ Школа РТК',
          phone: data.phone ?? null,
          notificationsEnabled: data.notificationsEnabled ?? true,
        },
      });
    } else {
      row = await prisma.profileSettings.update({
        where: { id: row.id },
        data: { ...data, updatedAt: new Date() },
      });
    }
    return ok(res, row);
  } catch (e) { next(e); }
});

export default router;