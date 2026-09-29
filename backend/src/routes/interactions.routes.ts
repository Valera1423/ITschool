// backend/src/routes/interactions.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  ok, okPaginated, parsePagination, buildPagination, created, noContent,
} from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { VersionsService } from '../services/versions.service.js';

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
  universityId: z.string().uuid().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  manager: z.string().optional(),
  search: z.string().max(200).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyDeleted: z.coerce.boolean().optional(),
});

const body = z.object({
  universityId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  details: z.string().nullable().optional(),
  interactionDate: z.string().date(),
  status: z.string().default('Запланировано'),
  manager: z.string().min(1),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  allDay: z.boolean().default(false),
  meetingUrl: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  reminderMinutes: z.number().int().nullable().optional(),
  color: z.string().nullable().optional(),
});

// ============================================================
// GET /interactions
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

    const where: Record<string, unknown> = {
      ...deletedFilter,
      universityId: q.universityId,
      status: q.status,
      type: q.type,
      manager: q.manager,
      ...(q.search ? {
        OR: [
          { title: { contains: q.search, mode: 'insensitive' as const } },
          { details: { contains: q.search, mode: 'insensitive' as const } },
          { manager: { contains: q.search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(q.from || q.to
        ? {
            interactionDate: {
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
      orderBy: [{ interactionDate: 'desc' }, { createdAt: 'desc' }],
      include: { university: { select: { id: true, name: true, city: true } } },
    };
    const countArgs: Record<string, unknown> = { where };

    if (q.includeDeleted || q.onlyDeleted) {
      findArgs.__includeDeleted = true;
      countArgs.__includeDeleted = true;
    }

    const [items, total] = await prisma.$transaction([
      prisma.interaction.findMany(findArgs as never),
      prisma.interaction.count(countArgs as never),
    ]);

    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

// ============================================================
// POST /interactions
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(normalizeBody(req.body));

    const item = await prisma.interaction.create({
      data: {
        university: { connect: { id: data.universityId } },
        type: data.type,
        title: data.title,
        details: data.details ?? null,
        interactionDate: new Date(data.interactionDate),
        status: data.status,
        manager: data.manager,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        allDay: data.allDay,
        meetingUrl: data.meetingUrl || null,
        location: data.location ?? null,
        attendees: (data.attendees ?? []) as never,
        reminderMinutes: data.reminderMinutes ?? null,
        ...(data.color ? { color: data.color } : {}),
      },
    });

    await VersionsService.save(
      'interactions',
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
// GET /interactions/:id
// ============================================================
router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.interaction.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { university: { select: { id: true, name: true, city: true } } },
    });
    if (!item) throw new AppError('INTERACTION_NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /interactions/:id/restore
// ============================================================
router.post('/:id/restore', async (req, res, next) => {
  try {
    const existing = await prisma.interaction.findFirst({
      where: { id: req.params.id },
      __includeDeleted: true,
    } as never);

    if (!existing) throw new AppError('INTERACTION_NOT_FOUND', 404);

    const item = await prisma.interaction.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.auth!.profileId,
        userEmail: req.auth!.email,
        entity: 'interactions',
        entityId: req.params.id,
        action: 'restore',
        before: {
          deleted_at: (existing as { deletedAt: Date | null }).deletedAt,
        } as never,
        after: { deleted_at: null } as never,
      },
    }).catch(() => {});

    await VersionsService.save(
      'interactions',
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
// PATCH /interactions/:id
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(normalizeBody(req.body));

    const before = await prisma.interaction.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!before) throw new AppError('INTERACTION_NOT_FOUND', 404);

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (data.universityId !== undefined) patch.universityId = data.universityId;
    if (data.type !== undefined) patch.type = data.type;
    if (data.title !== undefined) patch.title = data.title;
    if (data.details !== undefined) patch.details = data.details;
    if (data.interactionDate !== undefined) {
      patch.interactionDate = new Date(data.interactionDate);
    }
    if (data.status !== undefined) patch.status = data.status;
    if (data.manager !== undefined) patch.manager = data.manager;
    if (data.startTime !== undefined) patch.startTime = data.startTime;
    if (data.endTime !== undefined) patch.endTime = data.endTime;
    if (data.allDay !== undefined) patch.allDay = data.allDay;
    if (data.meetingUrl !== undefined) patch.meetingUrl = data.meetingUrl || null;
    if (data.location !== undefined) patch.location = data.location;
    if (data.attendees !== undefined) patch.attendees = data.attendees;
    if (data.reminderMinutes !== undefined) patch.reminderMinutes = data.reminderMinutes;
    if (data.color) patch.color = data.color;

    const item = await prisma.interaction.update({
      where: { id: req.params.id },
      data: patch as never,
    });

    await VersionsService.save(
      'interactions',
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
// DELETE /interactions/:id — soft delete
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const before = await prisma.interaction.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!before) throw new AppError('INTERACTION_NOT_FOUND', 404);

    const item = await prisma.interaction.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await VersionsService.save(
      'interactions',
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