// backend/src/routes/dashboards.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

const widgetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  order: z.number().int(),
  config: z.record(z.unknown()).optional(),
});

const createBody = z.object({
  user_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  is_default: z.boolean().optional().default(false),
  shared: z.boolean().optional().default(false),
  layout: z.array(widgetSchema).optional().default([]),
});

const updateBody = createBody.partial().omit({ user_id: true });

// ============================================================
// GET /dashboards?userId=...
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const userId =
      (typeof req.query.userId === 'string' && req.query.userId) ||
      req.auth?.profileId;

    if (!userId) {
      throw new AppError('VALIDATION_FAILED', 400, {
        reason: 'userId обязателен',
      });
    }

    // Свой можно всегда; чужие — только если shared или admin
    const isOwn = req.auth?.profileId === userId;
    const isAdmin = req.auth?.role === 'admin';

    const items = await prisma.dashboard.findMany({
      where: isOwn || isAdmin ? { userId } : { userId, shared: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return ok(res, items);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /dashboards
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = createBody.parse(req.body);

    // Свой userId или admin
    if (
      req.auth?.profileId !== data.user_id &&
      req.auth?.role !== 'admin'
    ) {
      throw new AppError('ROLE_NOT_ALLOWED', 403);
    }

    const item = await prisma.$transaction(async (tx) => {
      if (data.is_default) {
        await tx.dashboard.updateMany({
          where: { userId: data.user_id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.dashboard.create({
        data: {
          userId: data.user_id,
          name: data.name,
          description: data.description ?? null,
          isDefault: data.is_default,
          shared: data.shared,
          layout: data.layout as never,
        },
      });
    });

    return created(res, item);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// PATCH /dashboards/:id
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateBody.parse(req.body);

    const existing = await prisma.dashboard.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404);

    if (
      existing.userId !== req.auth?.profileId &&
      req.auth?.role !== 'admin'
    ) {
      throw new AppError('ROLE_NOT_ALLOWED', 403);
    }

    const item = await prisma.$transaction(async (tx) => {
      if (data.is_default === true) {
        await tx.dashboard.updateMany({
          where: {
            userId: existing.userId,
            isDefault: true,
            id: { not: req.params.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.dashboard.update({
        where: { id: req.params.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.is_default !== undefined ? { isDefault: data.is_default } : {}),
          ...(data.shared !== undefined ? { shared: data.shared } : {}),
          ...(data.layout !== undefined ? { layout: data.layout as never } : {}),
        },
      });
    });

    return ok(res, item);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /dashboards/:id/duplicate
// ============================================================
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { userId } = z
      .object({ userId: z.string().uuid() })
      .parse(req.body);

    if (
      req.auth?.profileId !== userId &&
      req.auth?.role !== 'admin'
    ) {
      throw new AppError('ROLE_NOT_ALLOWED', 403);
    }

    const src = await prisma.dashboard.findUnique({
      where: { id: req.params.id },
    });
    if (!src) throw new AppError('NOT_FOUND', 404);
    if (!src.shared && src.userId !== userId && req.auth?.role !== 'admin') {
      throw new AppError('ROLE_NOT_ALLOWED', 403);
    }

    const copy = await prisma.dashboard.create({
      data: {
        userId,
        name: `${src.name} (копия)`,
        description: src.description,
        isDefault: false,
        shared: false,
        layout: src.layout as never,
      },
    });

    return created(res, copy);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// DELETE /dashboards/:id
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.dashboard.findUnique({
      where: { id: req.params.id },
      select: { userId: true, isDefault: true },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404);

    if (
      existing.userId !== req.auth?.profileId &&
      req.auth?.role !== 'admin'
    ) {
      throw new AppError('ROLE_NOT_ALLOWED', 403);
    }

    await prisma.dashboard.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;