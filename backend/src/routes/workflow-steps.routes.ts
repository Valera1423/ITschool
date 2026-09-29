import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, okPaginated, created, noContent, parsePagination, buildPagination } from '../utils/response.js';

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  workflowId: z.string().uuid().optional(),
  status: z.string().optional(),
});

const body = z.object({
  workflowId: z.string().uuid(),
  title: z.string().min(1),
  stepOrder: z.number().int().min(1),
  status: z.string().default('Ожидает'),
  statusCode: z.string().nullable().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);

    const where = {
      workflowId: q.workflowId,
      status: q.status,
    };

    const [items, total] = await prisma.$transaction([
      prisma.workflowStep.findMany({
        where,
        skip,
        take,
        orderBy: [{ workflowId: 'asc' }, { stepOrder: 'asc' }],
      }),
      prisma.workflowStep.count({ where }),
    ]);

    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = body.parse(req.body);
    const item = await prisma.workflowStep.create({
      data: {
        workflow: { connect: { id: data.workflowId } },
        title: data.title,
        stepOrder: data.stepOrder,
        status: data.status,
        statusCode: data.statusCode ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = body.partial().parse(req.body);
    const item = await prisma.workflowStep.update({
      where: { id: req.params.id },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.workflowStep.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;