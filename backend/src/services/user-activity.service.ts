// backend/src/services/user-activity.service.ts
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';

/**
 * Кэш действий пользователя в Redis.
 *
 * Реализует ТЗ п.4.Функц.13 «кэш работы действий пользователя»:
 *
 *   1. История действий (ZSET на пользователя) — `recent()`.
 *      Хранит последние 100 действий, TTL 30 дней.
 *      Используется виджетом «Недавно открывал» на дашборде и
 *      аудитом «кто что смотрел».
 *
 *   2. Per-user кэш тяжёлых ответов — `cacheGet()` / `cacheSet()`.
 *      Ключ: `user:cache:<userId>:<resource>:<key>`.
 *      TTL задаётся вызывающим кодом (обычно 60 сек).
 *      Используется, например, для `/reports/dashboard-summary`.
 *
 *   3. Инвалидация — `cacheInvalidate()` / `invalidateCache()`.
 *      Сбрасывает кэш пользователя при logout / смене роли.
 */

const MAX_ITEMS = 100;
const TTL_SECONDS = 30 * 24 * 3600; // 30 дней

export interface ActivityItem {
  entity: string;
  entityId: string | null;
  action: string;
  label?: string;
  ts: number;
}

function key(userId: string): string {
  return `user:activity:${userId}`;
}

function cacheKey(userId: string, resource: string, key: string): string {
  return `user:cache:${userId}:${resource}:${key}`;
}

export class UserActivityService {
  // ============================================================
  // ИСТОРИЯ ДЕЙСТВИЙ (ZSET)
  // ============================================================

  /**
   * Записать действие в ZSET (последние 100, TTL 30 дней).
   */
  static async track(
    userId: string,
    item: Omit<ActivityItem, 'ts'>,
  ): Promise<void> {
    if (!userId) return;
    try {
      const entry: ActivityItem = { ...item, ts: Date.now() };
      const k = key(userId);
      const score = entry.ts;
      const member = JSON.stringify(entry);

      await redis
        .multi()
        .zadd(k, score, member)
        .zremrangebyrank(k, 0, -MAX_ITEMS - 1)
        .expire(k, TTL_SECONDS)
        .exec();
    } catch (e) {
      logger.warn({ err: e, userId }, 'UserActivity.track failed');
    }
  }

  /**
   * Получить последние N действий (по убыванию времени).
   */
  static async recent(userId: string, limit = 20): Promise<ActivityItem[]> {
    if (!userId) return [];
    try {
      const rows = await redis.zrevrange(key(userId), 0, limit - 1);
      return rows
        .map((r) => {
          try {
            return JSON.parse(r) as ActivityItem;
          } catch {
            return null;
          }
        })
        .filter((x): x is ActivityItem => !!x);
    } catch (e) {
      logger.warn({ err: e, userId }, 'UserActivity.recent failed');
      return [];
    }
  }

  /**
   * Очистить историю (GDPR / «право на забвение»).
   */
  static async clear(userId: string): Promise<void> {
    try {
      await redis.del(key(userId));
    } catch {
      /* ignore */
    }
  }

  // ============================================================
  // PER-USER КЭШ ТЯЖЁЛЫХ ОТВЕТОВ
  //
  // Это часть реализации ТЗ п.4.Функц.13 — уровень 2 (Redis-кэш).
  //
  // Ключ: `user:cache:<userId>:<resource>:<key>`
  // TTL: задаётся вызывающим кодом (обычно 60 сек).
  // Значение: сериализованный JSON.
  //
  // ВАЖНО: возвращаемый тип — `T | undefined` (не `null`).
  // Это используется в reports.routes.ts как:
  //   const cached = await cacheGet<T>(userId, 'dashboard', 'summary');
  //   if (cached) return ok(res, cached);
  // Менять на `null` нельзя без правки всех вызовов.
  // ============================================================

  /**
   * Получить значение из per-user кэша. Возвращает undefined, если нет.
   */
  static async cacheGet<T>(
    userId: string,
    resource: string,
    cacheKeyStr: string,
  ): Promise<T | undefined> {
    if (!userId) return undefined;
    try {
      const raw = await redis.get(cacheKey(userId, resource, cacheKeyStr));
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  /**
   * Записать в per-user кэш с TTL.
   */
  static async cacheSet<T>(
    userId: string,
    resource: string,
    cacheKeyStr: string,
    value: T,
    ttlSeconds = 60,
  ): Promise<void> {
    if (!userId) return;
    try {
      await redis.setex(
        cacheKey(userId, resource, cacheKeyStr),
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch {
      /* ignore */
    }
  }

  /**
   * Инвалидировать конкретный ресурс в кэше пользователя.
   *
   * Пример: cacheInvalidate(userId, 'dashboard') — сбросит
   * dashboard-summary этого пользователя.
   */
  static async cacheInvalidate(
    userId: string,
    resource: string,
  ): Promise<void> {
    if (!userId) return;
    try {
      const pattern = `user:cache:${userId}:${resource}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      /* ignore */
    }
  }

  /**
   * Инвалидировать **весь** кэш пользователя — по всем ресурсам.
   *
   * Вызывается при logout / смене роли / изменении permissions,
   * чтобы пользователь не увидел старые данные, к которым потерял доступ.
   *
   * Отличается от `cacheInvalidate(userId, resource)`, который
   * сбрасывает только один ресурс (например, только dashboard).
   */
  static async invalidateCache(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const pattern = `user:cache:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      /* ignore */
    }
  }
}