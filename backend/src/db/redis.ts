import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Redis-клиент с разделением на cache и queue.
 * BullMQ требует отдельного соединения.
 */
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

redis.on('connect', () => logger.info('✓ Redis подключён'));
redis.on('error', (e) => logger.warn({ err: e.message }, 'Redis error'));
redis.on('reconnecting', () => logger.warn('Redis переподключение…'));

/**
 * Кеш-обёртка. Если значения нет — вызывает loader, сохраняет на TTL.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) {
      logger.debug({ key }, 'Redis cache hit');
      return JSON.parse(hit) as T;
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message, key }, 'Redis get failed');
  }

  const value = await loader();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (e) {
    logger.warn({ err: (e as Error).message, key }, 'Redis set failed');
  }

  return value;
}

/**
 * Инвалидация по паттерну.
 */
export async function invalidate(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch {
    return 0;
  }
}

/**
 * Удалить конкретный ключ.
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch { /* ignore */ }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis отключён');
  } catch { /* ignore */ }
}