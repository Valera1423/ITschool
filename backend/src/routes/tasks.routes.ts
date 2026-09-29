// backend/src/routes/tasks.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  ok, okPaginated, parsePagination, buildPagination, created, noContent,
} from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { VersionsService } from '../services/versions.service.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function toCamel(str: string): string {
  return str.replace(/([a-z0-9])_([a-z0-9])/g, (_, p, c) => p + c.toUpperCase());
}

function normalizeBody(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normalizeBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[toCamel(k)] = normalizeBody(v);
  }
  return out;
}

const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  universityId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyDeleted: z.coerce.boolean().optional(),
});

const body = z.object({
  universityId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.string().default('К выполнению'),
  priority: z.string().default('Средний'),
  dueDate: z.string().date(),
  reminderAt: z.string().datetime().nullable().optional(),
  assignee: z.string().optional(),
});

const transferTaskBody = z.object({
  toAssignee: z.string().min(1).max(200),
  comment: z.string().max(500).optional(),
});

// ============================================================
// GET /tasks
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);

    const deletedFilter = q.onlyDeleted
      ? { deletedAt: { not: null } }
      : q.includeDeleted
        ? {}
        : { deletedAt: null };

    const where = {
      ...deletedFilter,
      status: q.status,
      priority: q.priority,
      assignee: q.assignee,
      universityId: q.universityId,
      ...(q.search ? {
        OR: [
          { title: { contains: q.search, mode: 'insensitive' as const } },
          { description: { contains: q.search, mode: 'insensitive' as const } },
          { assignee: { contains: q.search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(q.from || q.to
        ? {
            dueDate: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };

    const findArgs: Record<string, unknown> = {
      where,
      skip,
      take,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: { university: { select: { id: true, name: true } } },
    };
    const countArgs: Record<string, unknown> = { where };

    if (q.includeDeleted || q.onlyDeleted) {
      findArgs.__includeDeleted = true;
      countArgs.__includeDeleted = true;
    }

    const [items, total] = await prisma.$transaction([
      prisma.task.findMany(findArgs as never),
      prisma.task.count(countArgs as never),
    ]);

    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

// ============================================================
// POST /tasks
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(normalizeBody(req.body));

    const item = await prisma.task.create({
      data: {
        universityId: data.universityId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: new Date(data.dueDate),
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        assignee: data.assignee ?? 'Анна Кузнецова',
      },
    });

    await VersionsService.save(
      'tasks',
      item.id,
      item as unknown as Record<string, unknown>,
      item as unknown as Record<string, unknown>,
      {
        authorId: req.auth!.profileId,
        authorName: req.auth!.name,
        comment: 'Создание',
      },
    ).catch(() => {});

    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// GET /tasks/:id
// ============================================================
router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.task.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { university: { select: { id: true, name: true } } },
    });
    if (!item) throw new AppError('TASK_NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /tasks/:id/restore
// ============================================================
router.post('/:id/restore', async (req, res, next) => {
  try {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id },
      __includeDeleted: true,
    } as never);

    if (!existing) throw new AppError('TASK_NOT_FOUND', 404);

    const item = await prisma.task.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.auth!.profileId,
        userEmail: req.auth!.email,
        entity: 'tasks',
        entityId: req.params.id,
        action: 'restore',
        before: {
          deleted_at: (existing as { deletedAt: Date | null }).deletedAt,
        } as never,
        after: { deleted_at: null } as never,
      },
    }).catch(() => {});

    await VersionsService.save(
      'tasks',
      item.id,
      item as unknown as Record<string, unknown>,
      { before: existing, after: item } as unknown as Record<string, unknown>,
      {
        authorId: req.auth!.profileId,
        authorName: req.auth!.name,
        comment: 'Восстановление',
      },
    ).catch(() => {});

    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// POST /tasks/:id/transfer
// ============================================================
router.post(
  '/:id/transfer',
  requireRole('admin', 'manager'),
  async (req, res, next) => {
    try {
      const data = transferTaskBody.parse(req.body);

      const before = await prisma.task.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new AppError('TASK_NOT_FOUND', 404);

      if (before.assignee === data.toAssignee) {
        return res.status(409).json({
          ok: false,
          code: 'CRM-409-002',
          message: 'Задача уже назначена этому исполнителю',
        });
      }

      const item = await prisma.task.update({
        where: { id: req.params.id },
        data: { assignee: data.toAssignee },
      });

      await VersionsService.save(
        'tasks',
        item.id,
        item as unknown as Record<string, unknown>,
        {
          before,
          after: item,
          reason: 'transfer',
        } as unknown as Record<string, unknown>,
        {
          authorId: req.auth!.profileId,
          authorName: req.auth!.name,
          comment: `Передача: ${before.assignee} → ${data.toAssignee}${
            data.comment ? ` (${data.comment})` : ''
          }`,
        },
      ).catch(() => {});

      const newAssigneeProfile = await prisma.profile.findFirst({
        where: { fullName: data.toAssignee, blocked: false },
        select: { id: true },
      });
      if (newAssigneeProfile) {
        await prisma.notification
          .create({
            data: {
              userId: newAssigneeProfile.id,
              type: 'transfer',
              title: `Вам передана задача «${item.title}»`,
              body: `От: ${before.assignee}${
                data.comment ? `. ${data.comment}` : ''
              }`,
              entity: 'tasks',
              entityId: item.id,
              actionUrl: '/tasks',
            },
          })
          .catch(() => {});
      }

      return ok(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// PATCH /tasks/:id
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(normalizeBody(req.body));

    const before = await prisma.task.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!before) throw new AppError('TASK_NOT_FOUND', 404);

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (data.universityId !== undefined) patch.universityId = data.universityId;
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.dueDate = new Date(data.dueDate);
    if (data.reminderAt !== undefined) {
      patch.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
    }
    if (data.assignee !== undefined) patch.assignee = data.assignee;

    const item = await prisma.task.update({
      where: { id: req.params.id },
      data: patch as never,
    });

    await VersionsService.save(
      'tasks',
      item.id,
      item as unknown as Record<string, unknown>,
      { before, after: item } as unknown as Record<string, unknown>,
      {
        authorId: req.auth!.profileId,
        authorName: req.auth!.name,
        comment: 'Обновление',
      },
    ).catch(() => {});

    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /tasks/:id — soft delete
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await prisma.task.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!before) throw new AppError('TASK_NOT_FOUND', 404);

    const item = await prisma.task.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await VersionsService.save(
      'tasks',
      item.id,
      item as unknown as Record<string, unknown>,
      { before, after: item } as unknown as Record<string, unknown>,
      {
        authorId: req.auth!.profileId,
        authorName: req.auth!.name,
        comment: 'Удаление',
      },
    ).catch(() => {});

    return noContent(res);
  } catch (e) { next(e); }
});

export default router;