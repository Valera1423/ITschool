// backend/src/routes/comments.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  ok, okPaginated, created, noContent,
  parsePagination, buildPagination,
} from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { MentionsService } from '../services/mentions.service.js';
import { WsService } from '../services/ws.service.js';

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  universityId: z.string().uuid().optional(),
  interactionId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

/**
 * ВАЖНО: author больше НЕ принимается с клиента — берётся из req.auth.
 * Это закрывает spoofing имени отправителя.
 */
const body = z
  .object({
    body: z.string().min(1).max(5000),
    universityId: z.string().uuid().nullable().optional(),
    interactionId: z.string().uuid().nullable().optional(),
    taskId: z.string().uuid().nullable().optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().min(1).max(500),
          url: z.string().url().max(2000),
          size: z.number().int().min(0).optional(),
          mime: z.string().max(200).optional(),
        }),
      )
      .max(20)
      .default([]),
  })
  .strict();

// ============================================================
// GET /comments
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);

    const where = {
      deletedAt: null,
      universityId: q.universityId,
      interactionId: q.interactionId,
      taskId: q.taskId,
    };

    const [items, total] = await prisma.$transaction([
      prisma.comment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.comment.count({ where }),
    ]);

    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

// ============================================================
// POST /comments
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(req.body);
    const actor = req.auth!;

    // Проверяем существование целевой сущности — нельзя комментировать то,
    // чего нет (в т.ч. по подделанному uuid чужой сущности).
    if (data.universityId) {
      const uni = await prisma.university.findFirst({
        where: { id: data.universityId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!uni) throw new AppError('UNIVERSITY_NOT_FOUND', 404);
    }
    if (data.interactionId) {
      const intr = await prisma.interaction.findFirst({
        where: { id: data.interactionId, deletedAt: null },
        select: { id: true },
      });
      if (!intr) throw new AppError('INTERACTION_NOT_FOUND', 404);
    }
    if (data.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: data.taskId, deletedAt: null },
        select: { id: true },
      });
      if (!task) throw new AppError('TASK_NOT_FOUND', 404);
    }

    const item = await prisma.comment.create({
      data: {
        body: data.body,
        // ВАЖНО: author из auth, НЕ из тела запроса
        author: actor.name ?? actor.email,
        universityId: data.universityId ?? null,
        interactionId: data.interactionId ?? null,
        taskId: data.taskId ?? null,
        attachments: data.attachments as never,  // NEW
      },
    });

    // Mentions — только если есть привязка к университету
    if (item.universityId) {
      const uni = await prisma.university.findUnique({
        where: { id: item.universityId },
        select: { name: true },
      });
      void MentionsService.processComment({
        commentId: item.id,
        text: item.body,
        authorId: actor.profileId ?? null,
        authorName: item.author,
        entity: 'universities',
        entityId: item.universityId,
        entityTitle: uni?.name ?? 'Вуз',
      }).catch(() => {});
    }

    // WebSocket broadcast — клиенты с открытой карточкой вуза
    // (или другого привязанного объекта) получат комментарий в реальном времени.
    WsService.broadcast({
      type: 'comments:created',
      entity: 'universities',
      entityId: item.universityId ?? undefined,
      actor: actor.email,
      payload: {
        commentId: item.id,
        author: item.author,
        body: item.body.slice(0, 120),
        universityId: item.universityId,
      },
      scopeUniversityId: item.universityId ?? undefined,
    });

    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /comments/:id
// Редактировать может только автор или admin.
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(req.body);
    const actor = req.auth!;

    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, author: true },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404);

    const isAuthor = existing.author === (actor.name ?? actor.email);
    if (!isAuthor && actor.role !== 'admin') {
      throw new AppError('FORBIDDEN', 403);
    }

    const item = await prisma.comment.update({
      where: { id: req.params.id },
      data: {
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.attachments !== undefined
          ? { attachments: data.attachments as never }
          : {}),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /comments/:id — soft delete
// Только автор или admin.
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const actor = req.auth!;
    const existing = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { id: true, author: true },
    });
    if (!existing) {
      // не раскрываем существование чужого комментария
      return noContent(res);
    }

    const isAuthor = existing.author === (actor.name ?? actor.email);
    if (!isAuthor && actor.role !== 'admin') {
      // так же 204, чтобы не палить наличие
      return noContent(res);
    }

    await prisma.comment.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;