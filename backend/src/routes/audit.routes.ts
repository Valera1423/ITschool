// backend/src/routes/audit.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requirePermission } from '../middleware/auth.js';
import { ok, okPaginated, parsePagination, buildPagination } from '../utils/response.js';

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

router.get('/', requirePermission('audit.view'), async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);
    const where = {
      entity: q.entity,
      action: q.action,
      userId: q.userId,
      ...(q.from || q.to ? {
        createdAt: {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        },
      } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

router.get('/entities', requirePermission('audit.view'), async (_req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
    });
    return ok(res, rows.map((r) => r.entity));
  } catch (e) { next(e); }
});

export default router;