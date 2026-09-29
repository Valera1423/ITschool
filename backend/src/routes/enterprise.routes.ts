// backend/src/routes/enterprise.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { requirePermission, requireMfa } from '../middleware/auth.js';
import { createEnterpriseConnector } from '../services/enterprise/factory.js';
import { SecurityService } from '../services/security.service.js';
import { logger } from '../config/logger.js';

const router = Router();

const systemEnum = z.enum(['1c', 'sap', 'diadoc', 'sbis']);

/**
 * Проверка соединения Enterprise-системы.
 * POST /enterprise/:system/test
 * Body: { integrationId }
 */
router.post(
  '/:system/test',
  requireMfa,
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      const system = systemEnum.parse(req.params.system);
      const { integrationId } = z.object({
        integrationId: z.string().uuid(),
      }).parse(req.body);

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      if (!integration) throw new AppError('NOT_FOUND', 404);

      const connector = createEnterpriseConnector(system, {
        config: (integration.config ?? {}) as Record<string, unknown>,
        integrationId: integration.id,
        actor: {
          userId: req.auth?.profileId ?? null,
          email: req.auth?.email ?? 'system',
        },
      });

      const result = await connector.test();

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastCheckAt: new Date(),
          status: result.ok ? 'Активна' : 'Ошибка',
          lastError: result.ok ? null : (result.error ?? 'Неизвестная ошибка'),
        },
      });

      return ok(res, result);
    } catch (e) { next(e); }
  },
);

/**
 * Выгрузка сущности в Enterprise-систему.
 * POST /enterprise/:system/export
 * Body: { integrationId, entity, entityId, payload }
 *
 * Пишет ExternalExportLog для аудита.
 */
const exportBody = z.object({
  integrationId: z.string().uuid(),
  entity: z.string().min(1),
  entityId: z.string().uuid(),
  payload: z.record(z.unknown()),
});

router.post(
  '/:system/export',
  requireMfa,
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      const system = systemEnum.parse(req.params.system);
      const data = exportBody.parse(req.body);

      const integration = await prisma.integration.findUnique({
        where: { id: data.integrationId },
      });
      if (!integration) throw new AppError('NOT_FOUND', 404);

      const connector = createEnterpriseConnector(system, {
        config: (integration.config ?? {}) as Record<string, unknown>,
        integrationId: integration.id,
        actor: {
          userId: req.auth?.profileId ?? null,
          email: req.auth?.email ?? 'system',
        },
      });

      const startedAt = Date.now();
      let result;
      try {
        result = await connector.exportEntity({
          entity: data.entity,
          entityId: data.entityId,
          payload: data.payload,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown';
        await prisma.externalExportLog.create({
          data: {
            system,
            entity: data.entity,
            entityId: data.entityId,
            status: 'failed',
            error: message,
            createdBy: req.auth?.profileId ?? null,
            completedAt: new Date(),
          },
        });
        logger.warn({ err: e, system, entity: data.entity }, 'enterprise export failed');
        throw new AppError('EXTERNAL_API_ERROR', 502, { system, error: message });
      }

      await prisma.externalExportLog.create({
        data: {
          system,
          entity: data.entity,
          entityId: data.entityId,
          status: result.ok ? 'success' : 'failed',
          externalId: result.externalId ?? null,
          payload: data.payload as never,
          response: (result.response ?? {}) as never,
          error: result.error ?? null,
          createdBy: req.auth?.profileId ?? null,
          completedAt: new Date(),
        },
      });

      void SecurityService.log({
        eventType: 'role_changed', // используем существующий тип
        severity: 'info',
        userId: req.auth?.profileId,
        email: req.auth?.email,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] as string | undefined,
        details: {
          kind: 'enterprise_export',
          system,
          entity: data.entity,
          entityId: data.entityId,
          externalId: result.externalId,
          ok: result.ok,
          durationMs: Date.now() - startedAt,
        },
      });

      return ok(res, result);
    } catch (e) { next(e); }
  },
);

/**
 * История выгрузок.
 * GET /enterprise/exports?system=&limit=
 */
router.get(
  '/exports',
  requirePermission('integrations.manage'),
  async (req, res, next) => {
    try {
      const q = z.object({
        system: z.enum(['1c', 'sap', 'diadoc', 'sbis']).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      }).parse(req.query);

      const items = await prisma.externalExportLog.findMany({
        where: q.system ? { system: q.system } : undefined,
        orderBy: { createdAt: 'desc' },
        take: q.limit,
      });
      return ok(res, items);
    } catch (e) { next(e); }
  },
);

export default router;