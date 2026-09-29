import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();

const body = z.object({
  name: z.string().min(1),
  color: z.string().default('sky'),
  description: z.string().nullable().optional(),
});

// ============================================================
// CRUD тегов
// ============================================================
router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(req.body);
    const item = await prisma.tag.create({
      data: {
        name: data.name.trim(),
        color: data.color,
        description: data.description ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(req.body);
    const item = await prisma.tag.update({
      where: { id: req.params.id },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.tag.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// GET /tags/universities?ids=uuid1,uuid2
// Оставлен для обратной совместимости (старый вызов).
// ============================================================
router.get('/universities', async (req, res, next) => {
  try {
    const ids = String(req.query.ids ?? '').split(',').filter(Boolean);
    if (ids.length === 0) return ok(res, []);

    const items = await prisma.universityTag.findMany({
      where: { universityId: { in: ids } },
    });

    return ok(res, items.map((t) => ({
      university_id: t.universityId,
      tag_id: t.tagId,
      created_at: t.createdAt.toISOString(),
    })));
  } catch (e) { next(e); }
});

// ============================================================
// POST /tags/universities/batch
// Возвращает теги для списка вузов одним запросом (без GET-параметра с 500+ id).
// Body: { ids: string[] }
// ============================================================
router.post('/universities/batch', async (req, res, next) => {
  try {
    const { ids } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(2000),
    }).parse(req.body);

    const items = await prisma.universityTag.findMany({
      where: { universityId: { in: ids } },
    });

    return ok(res, items.map((t) => ({
      university_id: t.universityId,
      tag_id: t.tagId,
      created_at: t.createdAt.toISOString(),
    })));
  } catch (e) { next(e); }
});

export default router;