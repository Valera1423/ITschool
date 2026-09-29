import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../errors/codes.js';

/**
 * Нормализует IP для использования в качестве ключа rate-limit.
 *
 * Для IPv6 отсекаем последние 64 бита (группируем по /64-подсети),
 * чтобы один клиент со сменой адресов в подсети не обходил лимит.
 * В express-rate-limit >= 7.5.0 для этого есть встроенный
 * ipKeyGenerator — здесь своя реализация, чтобы не зависеть от версии.
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // IPv4-mapped IPv6 → IPv4
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return v4mapped[1];

  // IPv6 → берём первые 4 группы (64 бита)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::/64';
  }

  return ip;
}

/**
 * Ключ: userId если залогинен, иначе нормализованный IP.
 * Защищает от ситуации, когда все за одним NAT.
 */
function userKey(req: Request): string {
  const userId = req.auth?.profileId;
  if (userId) return `u:${userId}`;
  return `ip:${normalizeIp(req.ip)}`;
}

const baseOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: {
    ok: false,
    code: ERROR_CODES.RATE_LIMIT,
    message: 'Превышен лимит запросов. Попробуйте позже',
  },
};

export const globalRateLimit = rateLimit({
  ...baseOptions,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
});

export const strictRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 60_000,
  max: 20,
  message: {
    ok: false,
    code: ERROR_CODES.RATE_LIMIT,
    message: 'Слишком много запросов к этому эндпоинту',
  },
});

export const reportRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 60_000,
  // Значение конфигурируется через ENV — чтобы нагрузочные тесты
  // не упирались в лимит 30/мин. В prod должно быть 30 (дефолт).
  max: env.REPORT_RATE_LIMIT_MAX,
  message: {
    ok: false,
    code: ERROR_CODES.RATE_LIMIT,
    message: 'Слишком много отчётов, подождите минуту',
  },
});