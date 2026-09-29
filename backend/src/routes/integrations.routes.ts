// backend/src/routes/integrations.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { IntegrationsService } from '../services/integrations.service.js';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { strictRateLimit } from '../middleware/rateLimit.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

const createIntegration = z.object({
  name: z.string().min(1),
  type: z.string().default('custom_api'),
  config: z.record(z.unknown()).default({}),
  status: z.enum(['Активна', 'Отключена', 'Ошибка']).default('Отключена'),
  autoSync: z.boolean().default(false),
  syncSchedule: z.string().default('0 */2 * * *'),
});

const createEndpoint = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('GET'),
  entity: z.string().min(1),
  enabled: z.boolean().default(true),
  sortOrder: z.number().default(100),
});

const createMapping = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.enum([
    'string', 'number', 'date', 'boolean', 'json',
    'concat', 'split', 'lower', 'upper', 'trim',
  ]).default('string'),
  transformArg: z.string().nullable().optional(),
  required: z.boolean().default(false),
  defaultValue: z.string().nullable().optional(),
});

const previewQuery = z.object({
  endpointId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

const ruleBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  endpointId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().default(true),
  condition: z.record(z.unknown()).default({}),
  actions: z.array(z.record(z.unknown())).default([]),
});

router.get('/', async (_req, res, next) => {
  try {
    const list = await prisma.integration.findMany({
      where: { deletedAt: null },
      include: {
        endpoints: {
          include: { mappings: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, list);
  } catch (e) { next(e); }
});

router.post('/', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createIntegration.parse(req.body);
    const item = await prisma.integration.create({ data });
    return created(res, item);
  } catch (e) { next(e); }
});

router.get('/logs/all', async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 200);
    const logs = await IntegrationsService.listLogs(undefined, limit);
    return ok(res, logs);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.integration.findUnique({
      where: { id: req.params.id },
      include: {
        endpoints: {
          include: { mappings: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!item) throw new AppError('NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

router.patch('/:id', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createIntegration.partial().parse(req.body);
    const item = await prisma.integration.update({
      where: { id: req.params.id },
      data: { ...data, updatedAt: new Date() },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    await prisma.integration.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

router.post('/:id/test', requirePermission('integrations.manage'), strictRateLimit, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) throw new AppError('NOT_FOUND', 404);

    const { createAdapter } = await import('../services/inbox/factory.js');
    const adapter = createAdapter(integration.type, integration.config as Record<string, unknown>);
    const result = await adapter.test();

    await prisma.integration.update({
      where: { id: req.params.id },
      data: {
        lastCheckAt: new Date(),
        status: result.ok ? 'Активна' : 'Ошибка',
        lastError: result.ok ? null : (result.error ?? 'Неизвестная ошибка'),
      },
    });

    return ok(res, result);
  } catch (e) { next(e); }
});

router.post('/:id/sync', requirePermission('integrations.manage'), strictRateLimit, async (req, res, next) => {
  try {
    const actor = req.auth?.name ?? 'система';
    const results = await IntegrationsService.syncIntegration(req.params.id, 'manual', actor);
    return ok(res, results);
  } catch (e) { next(e); }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const logs = await IntegrationsService.listLogs(req.params.id, limit);
    return ok(res, logs);
  } catch (e) { next(e); }
});

router.post('/:id/endpoints', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createEndpoint.parse(req.body);
    const item = await prisma.integrationEndpoint.create({
      data: { ...data, integration: { connect: { id: req.params.id } } },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/endpoints/:endpointId', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createEndpoint.partial().parse(req.body);
    const item = await prisma.integrationEndpoint.update({
      where: { id: req.params.endpointId },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/endpoints/:endpointId', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    await prisma.integrationEndpoint.delete({ where: { id: req.params.endpointId } });
    return noContent(res);
  } catch (e) { next(e); }
});

router.post('/endpoints/:endpointId/mappings', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createMapping.parse(req.body);
    const item = await prisma.integrationFieldMapping.create({
      data: { ...data, endpoint: { connect: { id: req.params.endpointId } } },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/mappings/:mappingId', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    const data = createMapping.partial().parse(req.body);
    const item = await prisma.integrationFieldMapping.update({
      where: { id: req.params.mappingId },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/mappings/:mappingId', requirePermission('integrations.manage'), async (req, res, next) => {
  try {
    await prisma.integrationFieldMapping.delete({ where: { id: req.params.mappingId } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// GET /integrations/:id/preview
// Первые N записей из внешнего API — для UI редактора маппинга
// ============================================================
router.get(
  '/:id/preview',
  requirePermission('integrations.manage'),
  strictRateLimit,
  async (req, res, next) => {
    try {
      const q = previewQuery.parse(req.query);
      const result = await IntegrationsService.previewEndpoint({
        integrationId: req.params.id,
        endpointId: q.endpointId,
        limit: q.limit,
      });
      return ok(res, result);
    } catch (e) { next(e); }
  },
);

// ============================================================
// CRUD правил автоматизации (LMS → workflow)
// ============================================================
router.get('/:id/rules', async (req, res, next) => {
  try {
    const items = await prisma.integrationRule.findMany({
      where: { integrationId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post(
  '/:id/rules',
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      const data = ruleBody.parse(req.body);

      // Проверка: если endpointId задан — он принадлежит этой интеграции
      if (data.endpointId) {
        const exists = await prisma.integrationEndpoint.findFirst({
          where: { id: data.endpointId, integrationId: req.params.id },
          select: { id: true },
        });
        if (!exists) throw new AppError('VALIDATION_FAILED', 400, {
          reason: 'Endpoint не принадлежит этой интеграции',
        });
      }

      const item = await prisma.integrationRule.create({
        data: {
          integrationId: req.params.id,
          endpointId: data.endpointId ?? null,
          name: data.name,
          description: data.description ?? null,
          enabled: data.enabled,
          condition: data.condition as never,
          actions: data.actions as never,
        },
      });
      return created(res, item);
    } catch (e) { next(e); }
  },
);

router.patch(
  '/rules/:ruleId',
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      const data = ruleBody.partial().parse(req.body);
      const item = await prisma.integrationRule.update({
        where: { id: req.params.ruleId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.endpointId !== undefined ? { endpointId: data.endpointId } : {}),
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
          ...(data.condition !== undefined ? { condition: data.condition as never } : {}),
          ...(data.actions !== undefined ? { actions: data.actions as never } : {}),
          updatedAt: new Date(),
        },
      });
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/rules/:ruleId',
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      await prisma.integrationRule.delete({ where: { id: req.params.ruleId } });
      return noContent(res);
    } catch (e) { next(e); }
  },
);

export default router;