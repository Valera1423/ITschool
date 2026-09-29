import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent, okPaginated, parsePagination, buildPagination } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { SegmentsService } from '../services/segments.service.js';

const router = Router();

const body = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  entity: z.string().default('universities'),
  rules: z.array(z.object({
    field: z.string(),
    operator: z.enum([
      'equals', 'not_equals', 'greater', 'less', 'contains',
      'in', 'not_in', 'empty', 'not_empty', 'not_contains',
    ]),
    value: z.unknown().optional(),
  })).default([]),
  logic: z.enum(['AND', 'OR']).default('AND'),
  color: z.string().default('sky'),
  shared: z.boolean().default(false),
});

// ============================================================
// GET /segments
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.segment.findMany({
      where: {
        OR: [
          { createdBy: req.auth?.profileId ?? undefined },
          { shared: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST /segments
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(req.body);
    const item = await prisma.segment.create({
      data: {
        ...data,
        rules: data.rules as never,
        createdBy: req.auth?.profileId ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /segments/evaluate-inline — быстрая оценка правил без сохранения
// (для предпросмотра при редактировании)
// ============================================================
router.post('/evaluate-inline', async (req, res, next) => {
  try {
    const rules = z.array(z.object({
      field: z.string(),
      operator: z.enum([
        'equals', 'not_equals', 'greater', 'less', 'contains',
        'in', 'not_in', 'empty', 'not_empty', 'not_contains',
      ]),
      value: z.unknown().optional(),
    })).parse(req.body.rules ?? []);

    const logic = z.enum(['AND', 'OR']).parse(req.body.logic ?? 'AND');

    // Создаём временный сегмент, оцениваем, удаляем — так используем тот же движок
    const temp = await prisma.segment.create({
      data: {
        name: `__temp_${Date.now()}`,
        entity: 'universities',
        rules: rules as never,
        logic,
        createdBy: null,
      },
    });

    try {
      const { items, total } = await SegmentsService.evaluate(temp.id, { limit: 50 });
      return ok(res, { items, total });
    } finally {
      await prisma.segment.delete({ where: { id: temp.id } }).catch(() => { /* ignore */ });
    }
  } catch (e) { next(e); }
});

// ============================================================
// GET /segments/:id/evaluate — полная оценка
// ============================================================
router.get('/:id/evaluate', async (req, res, next) => {
  try {
    const q = parsePagination(req.query);
    const result = await SegmentsService.evaluate(req.params.id, {
      limit: q.take,
      skip: q.skip,
    });
    return okPaginated(
      res,
      result.items,
      buildPagination(q.page, q.pageSize, result.total),
    );
  } catch (e) { next(e); }
});

// ============================================================
// GET /segments/:id/ids — все id для массовых операций
// ============================================================
router.get('/:id/ids', async (req, res, next) => {
  try {
    const ids = await SegmentsService.evaluateIds(req.params.id);
    return ok(res, ids);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /segments/:id
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(req.body);
    const existing = await prisma.segment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('NOT_FOUND', 404);
    if (existing.createdBy !== req.auth?.profileId && req.auth?.role !== 'admin') {
      throw new AppError('FORBIDDEN', 403);
    }
    const item = await prisma.segment.update({
      where: { id: req.params.id },
      data: {
        ...data,
        rules: data.rules as never,
        updatedAt: new Date(),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /segments/:id
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.segment.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;