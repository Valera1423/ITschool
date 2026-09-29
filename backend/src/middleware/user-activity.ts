// backend/src/middleware/user-activity.ts
import type { Request, Response, NextFunction } from 'express';
import { UserActivityService } from '../services/user-activity.service.js';

/**
 * Автоматически трекает действия пользователя:
 *   - GET: смотрит сущность
 *   - POST/PATCH: меняет
 *   - DELETE: удаляет
 *
 * Определяет сущность и id из URL. Не трекает служебные роуты.
 */

const SKIP_PATTERNS = [
  /^\/api\/v1\/(search|notifications|user-preferences|onboarding|feature-flags)/,
  /^\/api\/v1\/(jobs|inbox|smart-hints)/,
];

const ENTITY_RE = /^\/api\/v1\/([a-z-]+)(?:\/([0-9a-f-]{36}))?/i;

export function userActivity(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.auth?.profileId;
  if (!userId) return next();

  const path = req.path;
  if (SKIP_PATTERNS.some((re) => re.test(path))) return next();

  const match = path.match(ENTITY_RE);
  if (!match) return next();

  const entity = match[1];
  const entityId = match[2] ?? null;

  const method = req.method.toUpperCase();
  let action: string;
  if (method === 'GET') action = 'view';
  else if (method === 'POST') action = 'create';
  else if (method === 'PATCH' || method === 'PUT') action = 'update';
  else if (method === 'DELETE') action = 'delete';
  else return next();

  // Fire-and-forget — не блокируем запрос
  void UserActivityService.track(userId, { entity, entityId, action });

  next();
}