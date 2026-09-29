import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, okPaginated, created, noContent, parsePagination, buildPagination } from '../utils/response.js';

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  universityId: z.string().uuid().optional(),
  direction: z.enum(['Входящий', 'Исходящий']).optional(),
  manager: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const body = z.object({
  universityId: z.string().uuid().nullable().optional(),
  contactPhone: z.string().min(1),
  contactName: z.string().nullable().optional(),
  direction: z.enum(['Входящий', 'Исходящий']),
  durationSeconds: z.number().int().min(0).default(0),
  recordingUrl: z.string().url().nullable().optional(),
  startedAt: z.string().datetime().optional(),
  manager: z.string().min(1),
  integrationId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);

    const where = {
      universityId: q.universityId,
      direction: q.direction,
      manager: q.manager,
      ...(q.from || q.to
        ? {
            startedAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.callLog.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: 'desc' },
        include: {
          university: { select: { id: true, name: true } },
        },
      }),
      prisma.callLog.count({ where }),
    ]);

    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(req.body);
    const item = await prisma.callLog.create({
      data: {
        ...data,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(req.body);
    const item = await prisma.callLog.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.callLog.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;