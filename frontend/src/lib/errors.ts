import { ERROR_CODES, type ErrorCode } from './errorCodes';

/**
 * Единый класс ошибки API.
 *
 * Почему класс, а не plain object:
 * - `instanceof Error` работает → catch-блоки, в которых проверяют Error,
 *   получают правильную ветку.
 * - Стек сохраняется.
 * - Легко расширять.
 *
 * Никогда не бросайте `throw { code, message }` — только `throw new ApiError(...)`.
 */
export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: ErrorCode | string = ERROR_CODES.UNKNOWN,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
    // Правильный prototype для extends Error в ES5-таргетах
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Type guard для ошибок API. */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}