// backend/src/routes/errors.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { prisma } from '../db/prisma.js';
import { noContent } from '../utils/response.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const body = z.object({
  code: z.string().max(64),
  message: z.string().max(2000),
  stack: z.string().max(20000).optional(),
  context: z.record(z.unknown()).optional(),
  severity: z.enum(['warning', 'error', 'critical']).default('error'),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
});

/**
 * POST /errors — приём клиентских ошибок.
 *
 * Публичный (без auth) — фронт может упасть до логина, поэтому
 * `req.auth` может быть пустым. Если он есть — сохраняем автора,
 * если нет — запись уходит с `userId: null`.
 *
 * Rate limit — 20 запросов/мин на IP (`strictRateLimit`).
 *
 * Пишем в два места:
 *  1. `logger.warn` — для Loki / ELK. Здесь полный payload, включая
 *     stack и context.
 *  2. `auditLog` — для UI «Журнал». Здесь обрезаем message до 1000
 *     и stack до 5000 символов, чтобы не раздувать БД гигантскими
 *     стеками из SourceMap-less сборок.
 *
 * Ошибки записи в БД не должны влиять на ответ клиенту —
 * `.catch(() => {})` гарантирует, что мы всегда отдаём 204, даже
 * если Postgres недоступен.
 */
router.post('/', strictRateLimit, async (req, res, next) => {
  try {
    const data = body.parse(req.body);

    // 1. Логируем в logger (для Loki)
    logger.warn(
      {
        source: 'frontend',
        code: data.code,
        url: data.url,
        severity: data.severity,
        context: data.context,
        userAgent: data.userAgent,
      },
      `[frontend] ${data.message}`,
    );

    // 2. И в audit_log — для UI «Журнал»
    await prisma.auditLog
      .create({
        data: {
          userId: req.auth?.profileId ?? null,
          userEmail: req.auth?.email ?? null,
          entity: 'frontend_errors',
          entityId: null,
          action: 'insert',
          before: null as never,
          after: {
            code: data.code,
            message: data.message.slice(0, 1000),
            stack: data.stack?.slice(0, 5000),
            severity: data.severity,
            url: data.url,
            context: data.context,
            userAgent: data.userAgent,
          } as never,
        },
      })
      .catch(() => {
        // Тихо игнорируем — БД может быть недоступна, но клиент
        // всё равно должен получить 204 и не пытаться отправить
        // ошибку повторно.
      });

    return noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;