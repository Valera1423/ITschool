import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { AutomationService } from '../services/automation.service.js';

const router = Router();

const ruleBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  entity: z.string().default('universities'),
  trigger_type: z.enum(['on_create', 'on_update', 'on_field_change']),
  trigger_config: z.record(z.unknown()).default({}),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown().optional(),
  })).default([]),
  actions: z.array(z.object({
    type: z.string(),
    params: z.record(z.unknown()).default({}),
  })).default([]),
});

// snake_case → camelCase
function toCamel(s: string): string {
  return s.replace(/([a-z0-9])_([a-z0-9])/g, (_, p, c) => p + c.toUpperCase());
}

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.automationRule.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const data = ruleBody.parse(req.body);
    const item = await prisma.automationRule.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        enabled: data.enabled,
        entity: data.entity,
        triggerType: data.trigger_type,
        triggerConfig: data.trigger_config as never,
        conditions: data.conditions as never,
        actions: data.actions as never,
        createdBy: req.auth?.profileId ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const data = ruleBody.partial().parse(req.body);
    const item = await prisma.automationRule.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.entity !== undefined ? { entity: data.entity } : {}),
        ...(data.trigger_type !== undefined ? { triggerType: data.trigger_type } : {}),
        ...(data.trigger_config !== undefined ? { triggerConfig: data.trigger_config as never } : {}),
        ...(data.conditions !== undefined ? { conditions: data.conditions as never } : {}),
        ...(data.actions !== undefined ? { actions: data.actions as never } : {}),
        updatedAt: new Date(),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.automationRule.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * POST /automation/:id/run
 * Ручной запуск правила на конкретной сущности.
 */
router.post('/:id/run', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { entity_id } = z.object({ entity_id: z.string().uuid() }).parse(req.body);

    const rule = await prisma.automationRule.findUnique({ where: { id: req.params.id } });
    if (!rule) throw new AppError('NOT_FOUND', 404);

    // Загружаем сущность
    let data: Record<string, unknown> = {};
    if (rule.entity === 'universities') {
      const u = await prisma.university.findUnique({ where: { id: entity_id } });
      if (!u) throw new AppError('UNIVERSITY_NOT_FOUND', 404);
      data = u as unknown as Record<string, unknown>;
    } else if (rule.entity === 'tasks') {
      const t = await prisma.task.findUnique({ where: { id: entity_id } });
      if (!t) throw new AppError('TASK_NOT_FOUND', 404);
      data = t as unknown as Record<string, unknown>;
    }

    await AutomationService.runRule(rule.id, {
      entity: rule.entity,
      entityId: entity_id,
      data,
      actor: req.auth?.name ?? 'manual',
    });

    return ok(res, { ok: true });
  } catch (e) { next(e); }
});

/**
 * GET /automation/:id/runs
 */
router.get('/:id/runs', async (req, res, next) => {
  try {
    const items = await prisma.automationRun.findMany({
      where: { ruleId: req.params.id },
      orderBy: { ranAt: 'desc' },
      take: 100,
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

export default router;