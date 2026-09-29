import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { InboxService } from '../services/inbox/inbox.service.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const listQuery = z.object({
  onlyUnread: z.coerce.boolean().optional(),
  channel: z.string().optional(),
  universityId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().optional(),
});

const sendBody = z.object({
  integrationId: z.string().uuid(),
  to: z.string().min(1),
  toName: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  universityId: z.string().uuid().nullable().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const limit = Math.min(500, q.limit ?? 100);

    const where = {
      archived: false,
      ...(q.onlyUnread ? { read: false } : {}),
      ...(q.channel && q.channel !== 'all' ? { channel: q.channel } : {}),
      ...(q.universityId ? { universityId: q.universityId } : {}),
      ...(q.search
        ? {
            OR: [
              { subject: { contains: q.search, mode: 'insensitive' as const } },
              { body: { contains: q.search, mode: 'insensitive' as const } },
              { fromAddress: { contains: q.search, mode: 'insensitive' as const } },
              { fromName: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const items = await prisma.inboxMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: { university: { select: { id: true, name: true } } },
    });

    return ok(res, items);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = z.object({
      read: z.boolean().optional(),
      archived: z.boolean().optional(),
      starred: z.boolean().optional(),
    }).parse(req.body);

    const item = await prisma.inboxMessage.update({
      where: { id: req.params.id },
      data: body,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.post('/mark-all-read', async (_req, res, next) => {
  try {
    await prisma.inboxMessage.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.inboxMessage.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * POST /inbox/send
 * Отправка исходящего через выбранную интеграцию.
 */
router.post('/send', strictRateLimit, async (req, res, next) => {
  try {
    const data = sendBody.parse(req.body);

    const message = await InboxService.send({
      integrationId: data.integrationId,
      to: data.to,
      toName: data.toName ?? undefined,
      subject: data.subject ?? undefined,
      body: data.body,
      universityId: data.universityId ?? undefined,
      manager: req.auth?.name,
    });

    return ok(res, message);
  } catch (e) { next(e); }
});

/**
 * POST /inbox/:id/reply
 * Ответ на входящее через ту же интеграцию.
 */
router.post('/:id/reply', strictRateLimit, async (req, res, next) => {
  try {
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);

    const original = await prisma.inboxMessage.findUnique({
      where: { id: req.params.id },
    });
    if (!original) throw new AppError('NOT_FOUND', 404);
    if (!original.integrationId) throw new AppError('STATE_CONFLICT', 409, {
      reason: 'Исходная интеграция недоступна',
    });

    const message = await InboxService.send({
      integrationId: original.integrationId,
      to: original.fromAddress,
      toName: original.fromName ?? undefined,
      subject: original.subject ? `Re: ${original.subject}` : undefined,
      body,
      universityId: original.universityId ?? undefined,
      manager: req.auth?.name,
      channel: original.channel,
    });

    // Помечаем исходное как отвеченное
    await prisma.inboxMessage.update({
      where: { id: original.id },
      data: { replied: true, read: true },
    });

    return ok(res, message);
  } catch (e) { next(e); }
});

export default router;