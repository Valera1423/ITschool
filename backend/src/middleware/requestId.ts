import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceId: string;
    }
  }
}

/**
 * Присваивает requestId и traceId.
 *
 * - X-Request-Id — уникальный ID запроса (для дедупликации)
 * - X-Trace-Id — сквозной trace из фронта через все сервисы
 * - X-Parent-Id — ID родительского запроса (если проксируется)
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incomingReq = req.headers['x-request-id'] as string | undefined;
  const incomingTrace = req.headers['x-trace-id'] as string | undefined;

  req.requestId = incomingReq && validateUuid(incomingReq) ? incomingReq : uuidv4();
  req.traceId = incomingTrace && validateUuid(incomingTrace) ? incomingTrace : req.requestId;

  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Trace-Id', req.traceId);
  next();
}