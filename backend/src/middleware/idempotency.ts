// backend/src/middleware/idempotency.ts
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

const TTL_HOURS = 24;

export function idempotency(required = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      if (required) {
        return res.status(400).json({
          ok: false,
          code: 'CRM-400-002',
          message: 'Требуется заголовок Idempotency-Key',
        });
      }
      return next();
    }

    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    const userId = req.auth?.profileId ?? 'anon';

    const composite = createHash('sha256')
      .update(`${endpoint}:${userId}:${rawKey}`)
      .digest('hex');

    logger.debug(
      { composite: composite.slice(0, 12), endpoint },
      '[idem] entered',
    );

    try {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: composite },
      });

      if (existing && existing.expiresAt >= new Date()) {
        logger.debug(
          { composite: composite.slice(0, 12) },
          '[idem] cached hit',
        );
        return res.status(existing.status).json(existing.response);
      }

      if (existing && existing.expiresAt < new Date()) {
        await prisma.idempotencyKey
          .delete({ where: { key: composite } })
          .catch(() => {});
      }
    } catch (e) {
      logger.warn({ err: e }, '[idem] lookup failed');
      return next();
    }

    const originalJson = res.json.bind(res);
    let saved = false;

    res.json = (body: unknown) => {
      if (saved) return originalJson(body);
      saved = true;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        prisma.idempotencyKey
          .create({
            data: {
              key: composite,
              userId: req.auth?.profileId ?? null,
              endpoint,
              status: res.statusCode,
              response: body as never,
              expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
            },
          })
          .catch((e) =>
            logger.warn({ err: e, composite }, '[idem] save failed'),
          );
      }
      return originalJson(body);
    };

    next();
  };
}