// backend/src/db/prisma.ts
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { softDeleteExtension } from './soft-delete.js';
import { realtimeExtension, flushRealtime } from './realtime-extension.js';

/**
 * Единственный Prisma-клиент на всё приложение.
 *
 * Собрано из:
 *   1) PrismaPg adapter         — используем node-postgres (pg), а не
 *      встроенный драйвер — это даёт единый pool и ускоряет работу.
 *   2) softDeleteExtension()    — findMany/findFirst/count добавляют
 *      `deletedAt: null` автоматически; findUnique возвращает null,
 *      если запись помечена удалённой.
 *   3) realtimeExtension()      — централизованный emit WS-событий
 *      при любых create/update/delete. Дебаунсится, отключён при
 *      DISABLE_REALTIME_EXTENSION=true.
 *
 * ВАЖНО: AuditLog пишется явно из сервисов через prisma.auditLog.create,
 * set_config(..., true) работает только внутри транзакции, поэтому
 * здесь этого не делаем.
 */

// ============================================================
// Подключение к PostgreSQL
// ============================================================
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Ограничиваем размер пула — по умолчанию pg открывает 10 соединений.
  // В проде имеет смысл поднять, но через ENV, чтобы не задеть
  // маленькие окружения.
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// ============================================================
// Базовый клиент (до extensions)
// ============================================================
const baseClient = new PrismaClient({
  adapter,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

baseClient.$on('warn' as never, (e: unknown) =>
  logger.warn({ prisma: e }, 'Prisma warning'),
);
baseClient.$on('error' as never, (e: unknown) =>
  logger.error({ prisma: e }, 'Prisma error'),
);

// ============================================================
// Экспорт: extensions накатываются в порядке объявления
// ============================================================
export const prisma = baseClient
  .$extends(softDeleteExtension())
  .$extends(realtimeExtension());

// ============================================================
// Graceful shutdown
// ============================================================
export async function disconnectPrisma(): Promise<void> {
  try {
    // Сначала прогнать буфер WS-событий, чтобы ничего не потерялось
    await flushRealtime().catch(() => {});
    await baseClient.$disconnect();
    logger.info('Prisma отключён');
  } catch (e) {
    logger.error({ err: e }, 'Ошибка отключения Prisma');
  }
}