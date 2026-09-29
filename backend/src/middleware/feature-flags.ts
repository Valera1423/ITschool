import type { Request, Response, NextFunction } from 'express';
import { FeatureFlagsService } from '../services/feature-flags.service.js';
import { logger } from '../config/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      flags?: Record<string, { enabled: boolean; config: unknown }>;
    }
  }
}

/**
 * Подгружает флаги в req.flags и отдаёт включённые клиенту
 * через заголовок X-Feature-Flags (comma-separated).
 *
 * Заголовок нужен фронту, чтобы не делать отдельный запрос /feature-flags/me.
 */
export async function loadFeatureFlags(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.auth?.profileId ?? null;
    const role = req.auth?.role ?? null;

    const flags = await FeatureFlagsService.getForUser(userId, role);
    req.flags = flags;

    const enabledKeys = Object.entries(flags)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k);

    if (enabledKeys.length > 0) {
      res.setHeader('X-Feature-Flags', enabledKeys.join(','));
    }
  } catch (e) {
    // Не блокируем запрос, если флаги упали — просто нет заголовка
    logger.warn({ err: e }, 'loadFeatureFlags failed');
  }
  next();
}

/**
 * Гейт для роутов: если флаг выключен — 404.
 *
 * ВАЖНО: при ошибке БД по умолчанию пропускает (fail-open),
 * потому что обычно фича не критичная. Для критичных роутов
 * передавайте { failClosed: true }.
 */
export function requireFlag(key: string, opts: { failClosed?: boolean } = {}) {
  const { failClosed = false } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await FeatureFlagsService.isEnabled(
        key,
        req.auth?.profileId ?? null,
        req.auth?.role ?? null,
      );
      if (!enabled) {
        return res.status(404).json({
          ok: false,
          code: 'CRM-404-001',
          message: 'Функция недоступна',
        });
      }
      next();
    } catch (e) {
      logger.warn({ err: e, flag: key }, 'requireFlag failed');
      if (failClosed) {
        return res.status(503).json({
          ok: false,
          code: 'CRM-500-004',
          message: 'Сервис временно недоступен',
        });
      }
      next();
    }
  };
}