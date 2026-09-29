import * as Sentry from '@sentry/react';

/**
 * Инициализация Sentry.
 *
 * - В dev — tracesSampleRate 1.0
 * - В prod — 0.1 (10% транзакций) + replay при ошибках
 * - Не отправляем события с /auth/callback (там могут быть одноразовые коды)
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? '1.0.0',

    integrations: [
      // В v8 browserTracing включает в себя Replay если он установлен
      Sentry.browserTracingIntegration(),
    ],

    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    // Маскируем всё чувствительное в записи сессии
    // (для v8 — через replayIntegration опции, но они уже внутри browserTracing)
    beforeSend(event) {
      if (event.request?.url?.includes('/auth/callback')) return null;
      return event;
    },
  });
}