import type { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';

interface Options {
  ttl?: number;
  keyPrefix?: string;
  perUser?: boolean;
}

/**
 * Кеширует ответы GET-запросов в Redis.
 * Cache-Control: no-cache в запросе или ответе — обходит кеш.
 */
export function cacheResponse(options: Options = {}) {
  const { ttl = 60, keyPrefix, perUser = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    if (req.headers['cache-control']?.includes('no-cache')) return next();

    const userId = perUser ? `:u:${req.auth?.profileId ?? 'anon'}` : '';
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    const key = `http:${keyPrefix ?? req.path}${userId}:${query || 'default'}`;

    try {
      const hit = await redis.get(key);
      if (hit) {
        const parsed = JSON.parse(hit);
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(parsed);
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message, key }, 'cache get failed');
    }

    // Перехватываем res.json ОДИН раз
    const originalJson = res.json.bind(res);
    let intercepted = false;

    res.json = (body: unknown) => {
      if (intercepted) return originalJson(body);
      intercepted = true;

      const noCache = res
        .getHeader('Cache-Control')
        ?.toString()
        .includes('no-cache');

      if (res.statusCode === 200 && !noCache) {
        redis
          .setex(key, ttl, JSON.stringify(body))
          .catch((e) =>
            logger.warn({ err: (e as Error).message, key }, 'cache set failed'),
          );
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}