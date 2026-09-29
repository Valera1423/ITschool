import { ApiError, isApiError } from './errors';
import {
  ERROR_CODES,
  errorMessage,
  extractErrorCode,
  extractErrorMessage,
  toApiError,
} from './errorCodes';
import { logger } from './logger';

/**
 * Централизованная обработка ошибок.
 *
 * Что делает:
 * - Логирует ошибку на backend (в error_logs) — fire-and-forget
 * - Показывает пользователю понятное сообщение через onNotice
 * - Возвращает код ошибки для дальнейшей обработки
 */

interface LogOptions {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity?: 'warning' | 'error' | 'critical';
}

/** Классификация severity по коду/статусу. */
function severityFor(code: string, status?: number): 'warning' | 'error' | 'critical' {
  if (code.startsWith('CRM-5')) return 'critical';
  if (status && status >= 500) return 'critical';
  if (code.startsWith('CRM-4') && status !== 401 && status !== 403) return 'warning';
  if (code.startsWith('CRM-C')) return 'warning';
  return 'error';
}

/**
 * Логирование ошибки на backend.
 * Fire-and-forget — не блокируем UI.
 */
export async function logError(opts: LogOptions): Promise<void> {
  try {
    const API_URL = import.meta.env.VITE_API_URL;
    if (!API_URL) return;

    // Импортируем токен лениво, чтобы не тянуть oidc в первый рендер
    let token: string | null = null;
    try {
      const { getStoredToken } = await import('./oidc');
      token = getStoredToken();
    } catch {
      /* ignore */
    }

    await fetch(`${API_URL}/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        code: opts.code,
        message: opts.message,
        stack: opts.stack,
        context: opts.context ?? {},
        severity: opts.severity ?? 'error',
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {
      logger.warn('Не удалось залогировать ошибку', opts);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Универсальный обработчик ошибок в UI.
 *
 *   try { await api.post(...); } catch (e) { handleError(e, onNotice); }
 */
export function handleError(
  e: unknown,
  onNotice: (msg: string) => void,
  context?: Record<string, unknown>,
): string {
  const apiErr = toApiError(e);
  const code = apiErr.code;

  // Сообщение: приоритет у backend (там русский текст), потом по коду
  const msg = isApiError(e)
    ? errorMessage(apiErr.code, apiErr.message)
    : errorMessage(code, extractErrorMessage(e));

  void logError({
    code,
    message: apiErr.message,
    stack: apiErr.stack,
    context,
    severity: severityFor(code, apiErr.status),
  });

  onNotice(msg);
  return code;
}

/**
 * Обёртка для асинхронных функций: ловит ошибку и возвращает null.
 *
 *   const result = await safeAsync(() => api.get(...), onNotice);
 *   if (!result) { /* уже показано *\/ }
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onNotice?: (msg: string) => void,
  context?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (onNotice) {
      handleError(e, onNotice, context);
    } else {
      const code = extractErrorCode(e);
      void logError({
        code,
        message: extractErrorMessage(e),
        stack: e instanceof Error ? e.stack : undefined,
        context,
        severity: severityFor(code, (e as ApiError).status),
      });
    }
    return null;
  }
}

// Реэкспорт для обратной совместимости с существующим кодом
export { ERROR_CODES, errorMessage } from './errorCodes';