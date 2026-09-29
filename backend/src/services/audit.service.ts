import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import type { AuthUser } from '../middleware/auth.js';

export interface AuditContext {
  auth: AuthUser | null;
  source?: string; // 'api' | 'cron' | 'import' | 'webhook'
}

/**
 * Единая точка аудита. Пишет в audit_log с опциональным before/after.
 * Никогда не падает — аудит не должен ломать основной запрос.
 */
export async function writeAudit(params: {
  ctx: AuditContext;
  entity: string;
  entityId: string;
  action: 'insert' | 'update' | 'delete' | 'restore';
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.ctx.auth?.profileId ?? null,
        userEmail: params.ctx.auth?.email ?? params.ctx.source ?? 'system',
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        before: (params.before ?? null) as never,
        after: (params.after ?? null) as never,
      },
    });
  } catch (e) {
    logger.warn({ err: e, entity: params.entity, entityId: params.entityId }, 'audit write failed');
  }
}