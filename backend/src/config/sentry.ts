import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from './logger.js';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry отключён (нет SENTRY_DSN)');
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: process.env.APP_VERSION ?? '1.0.0',
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    beforeSend(event) {
      // Не отправляем 4xx
      const status = event.contexts?.response?.status_code;
      if (typeof status === 'number' && status < 500) return null;
      return event;
    },
    ignoreErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'NetworkError',
    ],
  });

  logger.info('✓ Sentry инициализирован');
}

/** Обёртка для отправки ошибки в Sentry. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        scope.setContext(k, v as Record<string, unknown>);
      }
    }
    Sentry.captureException(err);
  });
}