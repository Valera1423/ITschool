import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'secret', 'access_token', 'refresh_token',
  'authorization', 'api_key', 'apiKey', 'private_key',
]);

const MAX_BODY_SIZE = 10_000;

function maskSensitive(obj: unknown, seen = new WeakSet<object>()): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj as object)) return '[Circular]';
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((v) => maskSensitive(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      out[k] = maskSensitive(v, seen);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Логирование request/response body.
 * Включается через BODY_LOGGING=true в .env.
 *
 * Не логирует:
 * - GET/HEAD/OPTIONS
 * - multipart (бинарные данные)
 * - тела > 10 KB
 * - чувствительные поля маскируются
 */
export function bodyLogger(req: Request, res: Response, next: NextFunction) {
  if (process.env.BODY_LOGGING !== 'true') return next();
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  if (req.is('multipart/form-data')) return next();

  const startTime = Date.now();

  // Логируем request
  if (req.body && Object.keys(req.body).length > 0) {
    const json = JSON.stringify(req.body);
    if (json.length <= MAX_BODY_SIZE) {
      logger.debug(
        {
          phase: 'request',
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          user: req.auth?.email,
          body: maskSensitive(req.body),
        },
        `→ ${req.method} ${req.path}`,
      );
    } else {
      logger.debug(
        {
          phase: 'request',
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          bodySize: json.length,
        },
        `→ ${req.method} ${req.path} (body too large to log)`,
      );
    }
  }

  // Перехватываем response
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode < 400 && body && typeof body === 'object') {
      const json = JSON.stringify(body);
      if (json.length <= MAX_BODY_SIZE) {
        logger.debug(
          {
            phase: 'response',
            requestId: req.requestId,
            status: res.statusCode,
            duration: Date.now() - startTime,
            body: maskSensitive(body),
          },
          `← ${res.statusCode} ${req.method} ${req.path}`,
        );
      } else {
        logger.debug(
          {
            phase: 'response',
            requestId: req.requestId,
            status: res.statusCode,
            duration: Date.now() - startTime,
            bodySize: json.length,
          },
          `← ${res.statusCode} ${req.method} ${req.path} (body too large)`,
        );
      }
    }
    return originalJson(body);
  };

  next();
}