import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

/**
 * Управление разграничением доступа (user_scopes).
 * Доступно только администратору.
 *
 * Формат filter — плоский объект, ключи соединяются через AND:
 *   { "manager": "Анна Кузнецова" }
 *   { "city": "Москва", "status": "Переговоры" }
 *   { "direction": "Разработка" }
 *
 * Для полей-связей (managerId, directionId, productId) используем
 * точное совпадение по uuid. Для текстовых (manager, city) — по значению.
 */

const bodySchema = z.object({
  userId: z.string().uuid(),
  entity: z.string().min(1).default('universities'),
  filter: z.record(z.unknown()).default({}),
});

// GET /user-scopes — все scope'ы
router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const rows = await prisma.userScope.findMany({
      orderBy: [{ entity: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
      },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// GET /user-scopes/:userId — все scope'ы конкретного пользователя
router.get('/:userId', requireRole('admin'), async (req, res, next) => {
  try {
    const rows = await prisma.userScope.findMany({
      where: { userId: req.params.userId },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// POST /user-scopes — создать или обновить (upsert по userId+entity)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const data = bodySchema.parse(req.body);

    // Проверяем пользователя
    const profile = await prisma.profile.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });
    if (!profile) throw new AppError('NOT_FOUND', 404, { reason: 'profile' });

    const row = await prisma.userScope.upsert({
      where: {
        userId_entity: { userId: data.userId, entity: data.entity },
      },
      update: { filter: data.filter as never },
      create: {
        userId: data.userId,
        entity: data.entity,
        filter: data.filter as never,
      },
    });
    return created(res, row);
  } catch (e) { next(e); }
});

// DELETE /user-scopes/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.userScope.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;