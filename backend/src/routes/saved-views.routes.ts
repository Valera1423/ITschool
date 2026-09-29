import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AppError } from '../errors/codes.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();

const body = z.object({
  name: z.string().min(1),
  entity: z.string().default('universities'),
  filters: z.record(z.unknown()).default({}),
  sort: z.record(z.unknown()).nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  shared: z.boolean().default(false),
  pinned: z.boolean().default(false),
});

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    const entity = req.query.entity ? String(req.query.entity) : undefined;

    const items = await prisma.savedView.findMany({
      where: {
        AND: [
          entity ? { entity } : {},
          {
            OR: [
              { userId: userId ?? undefined },
              { shared: true },
            ],
          },
        ],
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const data = body.parse(req.body);
    const item = await prisma.savedView.create({
      data: {
        userId,
        name: data.name,
        entity: data.entity,
        filters: data.filters as never,
        sort: (data.sort ?? null) as never,
                ...(data.color ? { color: data.color } : {}),
        icon: data.icon ?? null,
        shared: data.shared,
        pinned: data.pinned,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    const existing = await prisma.savedView.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 404);
    if (existing.userId !== userId && req.auth?.role !== 'admin') {
      throw new AppError('FORBIDDEN', 403);
    }

    const data = body.partial().parse(req.body);
    const item = await prisma.savedView.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        entity: data.entity,
        filters: data.filters as never,
        sort: (data.sort ?? null) as never,
                ...(data.color !== undefined ? { color: data.color } : {}),
        icon: data.icon,
        shared: data.shared,
        pinned: data.pinned,
        updatedAt: new Date(),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    const existing = await prisma.savedView.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 404);
    if (existing.userId !== userId && req.auth?.role !== 'admin') {
      throw new AppError('FORBIDDEN', 403);
    }
    await prisma.savedView.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;