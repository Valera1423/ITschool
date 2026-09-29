import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Контекст запроса для audit-логирования.
 *
 * Express-middleware кладёт сюда объект, а Prisma-extension
 * читает userId/userEmail при каждом изменении.
 *
 * ALS (AsyncLocalStorage) автоматически пробрасывает контекст
 * через все асинхронные вызовы внутри обработки запроса.
 */

export interface AuditContext {
  userId: string | null;
  userEmail: string | null;
  ip?: string;
  userAgent?: string;
  /** Метка, если изменение сделано системой (cron, webhook) */
  source?: string;
}

export const auditContext = new AsyncLocalStorage<AuditContext>();

/** Прочитать текущий контекст. Возвращает null, если вне запроса. */
export function getAuditContext(): AuditContext | null {
  return auditContext.getStore() ?? null;
}

/** Запустить колбэк внутри нового контекста. */
export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditContext.run(ctx, fn);
}