import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ERROR_CODES, ERROR_MESSAGES } from '../errors/codes.js';
import { logger } from '../config/logger.js';
import { isPrismaError, prismaErrorToHttp } from '../utils/prisma-errors.js';
import { captureError } from '../config/sentry.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    code: ERROR_CODES.NOT_FOUND,
    message: `Маршрут ${req.method} ${req.path} не найден`,
    requestId: req.requestId,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId ?? 'unknown';

  // 1. Zod
  if (err instanceof ZodError) {
    logger.warn({ err: err.flatten(), requestId, path: req.path }, 'Ошибка валидации');
    return res.status(400).json({
      ok: false,
      code: ERROR_CODES.VALIDATION_FAILED,
      message: ERROR_MESSAGES[ERROR_CODES.VALIDATION_FAILED],
      details: err.flatten().fieldErrors,
      requestId,
    });
  }

  // 2. Наш AppError
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, status: err.status, requestId, path: req.path },
      err.message,
    );
    return res.status(err.status).json({
      ok: false,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    });
  }

  // 3. Prisma
  if (isPrismaError(err)) {
    const mapped = prismaErrorToHttp(err);
    logger.error({ prisma: err.code, meta: err.meta, requestId }, `Prisma ${err.code}`);

    return res.status(mapped.status).json({
      ok: false,
      code: mapped.code,
      message: mapped.message,
      details: process.env.NODE_ENV === 'development' ? mapped.details : undefined,
      requestId,
    });
  }

  // 4. Всё остальное → Sentry + 500
  captureError(err, {
    requestId,
    path: req.path,
    method: req.method,
    user: req.auth?.email,
  });

  const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
  logger.error({ err, requestId, path: req.path }, 'Необработанная ошибка');

  return res.status(500).json({
    ok: false,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
    details:
      process.env.NODE_ENV === 'development'
        ? { message, stack: err instanceof Error ? err.stack : undefined }
        : undefined,
    requestId,
  });
}