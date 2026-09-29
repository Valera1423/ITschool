import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

// ============================================================
// GET /gantt — все задачи с зависимостями
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const assignee = req.query.assignee ? String(req.query.assignee) : undefined;
    const universityId = req.query.universityId ? String(req.query.universityId) : undefined;

    const where = {
      deletedAt: null,
      status: { notIn: ['Отменено'] },
      ...(assignee ? { assignee } : {}),
      ...(universityId ? { universityId } : {}),
      ...(from || to
        ? {
            dueDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        university: { select: { id: true, name: true } },
      },
    });

    const taskIds = tasks.map((t) => t.id);

    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: { in: taskIds } },
    });

    // Считаем длительность: у нас только dueDate, поэтому
    // duration по умолчанию = 3 дня (можно поменять через кастомное поле).
    const items = tasks.map((t) => {
      const due = new Date(t.dueDate);
      const start = new Date(due);
      start.setDate(start.getDate() - 3); // -3 дня по умолчанию

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        startDate: start.toISOString(),
        endDate: due.toISOString(),
        progress: t.status === 'Готово' ? 100 : t.status === 'В работе' ? 50 : 0,
        universityId: t.universityId,
        universityName: t.university?.name ?? null,
        createdAt: t.createdAt.toISOString(),
      };
    });

    const deps = dependencies.map((d) => ({
      id: d.id,
      taskId: d.taskId,
      dependsOnTaskId: d.dependsOnTaskId,
      type: d.type,
    }));

    return ok(res, { items, dependencies: deps });
  } catch (e) { next(e); }
});

// ============================================================
// POST /gantt/dependencies
// ============================================================
router.post('/dependencies', async (req, res, next) => {
  try {
    const data = z.object({
      taskId: z.string().uuid(),
      dependsOnTaskId: z.string().uuid(),
      type: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish']).default('finish_to_start'),
    }).parse(req.body);

    if (data.taskId === data.dependsOnTaskId) {
      throw new AppError('VALIDATION_FAILED', 400, { reason: 'Задача не может зависеть от себя' });
    }

    // Проверка на цикл (упрощённая)
    const hasCycle = await checkCycle(data.taskId, data.dependsOnTaskId);
    if (hasCycle) {
      throw new AppError('STATE_CONFLICT', 409, { reason: 'Зависимость создаст цикл' });
    }

    const dep = await prisma.taskDependency.create({ data });
    return created(res, dep);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /gantt/dependencies/:id
// ============================================================
router.delete('/dependencies/:id', async (req, res, next) => {
  try {
    await prisma.taskDependency.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /gantt/:taskId — перетаскивание задачи
// ============================================================
router.patch('/:taskId', async (req, res, next) => {
  try {
    const data = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }).parse(req.body);

    if (data.endDate) {
      const task = await prisma.task.update({
        where: { id: req.params.taskId },
        data: { dueDate: new Date(data.endDate) },
      });
      return ok(res, task);
    }

    return ok(res, null);
  } catch (e) { next(e); }
});

// ============================================================
// Внутренние
// ============================================================
async function checkCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  // Проверяем, не является ли dependsOnTaskId (или его транзитивные зависимости)
  // зависимым от taskId.
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });

    for (const d of deps) {
      stack.push(d.dependsOnTaskId);
    }
  }

  return false;
}

export default router;