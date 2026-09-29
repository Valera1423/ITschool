// backend/src/routes/notifications.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { PushService } from '../services/push.service.js';
import { WsService } from '../services/ws.service.js';

const router = Router();

/**
 * Создание уведомления.
 *
 * ВАЖНО: userId НЕ принимается от клиента. Пользователь может создавать
 * уведомления только СЕБЕ. Для системных уведомлений (cron, automation)
 * используется прямой вызов prisma.notification.create() из сервиса,
 * а не этот HTTP-эндпоинт.
 */
const createBody = z
  .object({
    type: z.string().min(1).max(50).default('system'),
    title: z.string().min(1).max(200),
    body: z.string().max(2000).nullable().optional(),
    entity: z.string().max(50).nullable().optional(),
    entityId: z.string().uuid().nullable().optional(),
    // action_url — только относительный путь нашего origin (защита от open-redirect)
    actionUrl: z
      .string()
      .refine(
        (v) => v.startsWith('/') && !v.startsWith('//'),
        'actionUrl должен начинаться с / и не быть протокол-relative',
      )
      .nullable()
      .optional(),
  })
  .strict();

const patchBody = z.object({ read: z.boolean().optional() });

// ============================================================
// GET /notifications
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const onlyUnread = req.query.onlyUnread === 'true';
    const type = req.query.type ? String(req.query.type) : undefined;
    const userId = req.auth?.profileId;

    if (!userId) return ok(res, []);

    const items = await prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { read: false } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST /notifications — только себе
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = createBody.parse(req.body);
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const item = await prisma.notification.create({
      data: {
        userId, // всегда себе
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        entity: data.entity ?? null,
        entityId: data.entityId ?? null,
        actionUrl: data.actionUrl ?? null,
      },
    });

    // Push-уведомление (web push)
    void PushService.send(userId, {
      title: item.title,
      body: item.body ?? '',
      url: item.actionUrl ?? '/',
      tag: `notif-${item.id}`,
    }).catch(() => {});

    // WebSocket broadcast — только целевому пользователю.
    // Клиенты подписываются на канал своего userId и получают уведомление
    // в реальном времени: счётчик в шапке, пополнение списка, тост.
    WsService.broadcast({
      type: 'notifications:new',
      entity: 'notifications',
      actor: 'system',
      targetUserId: userId,
      payload: {
        id: item.id,
        title: item.title,
        body: item.body,
        actionUrl: item.actionUrl,
        type: item.type,
      },
    });

    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /notifications/mark-all-read — ДО /:id
// ============================================================
router.post('/mark-all-read', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /notifications/:id — только свои
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = patchBody.parse(req.body);
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const existing = await prisma.notification.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new AppError('NOT_FOUND', 404);
    }

    const item = await prisma.notification.update({
      where: { id: req.params.id },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /notifications/:id — только свои
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);

    const existing = await prisma.notification.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== userId) {
      return noContent(res);
    }

    await prisma.notification.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;