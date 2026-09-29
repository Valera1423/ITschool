import { ApiError } from './errors';
import { ERROR_CODES } from './errorCodes';

/**
 * Универсальный REST-клиент для backend.
 *
 * Особенности:
 * - Автоматически подставляет Bearer-токен из OIDC
 * - Idempotency-Key для POST/PATCH (защита от двойных отправок)
 * - X-Trace-Id для сквозной трассировки
 * - Бросает ApiError, а не plain object
 * - Возвращает типизированный ответ `{ ok, data, pagination? }`
 */

const API_URL: string = import.meta.env.VITE_API_URL ?? '';

if (!API_URL) {
  // eslint-disable-next-line no-console
  console.error('[api] VITE_API_URL не задан — запросы будут падать');
}

/**
 * UUID v4 с фоллбэком для не-secure-context.
 *
 * `crypto.randomUUID` доступен только в secure context (HTTPS или localhost).
 * Если приложение когда-нибудь откроют по http://internal.crm.local, вызов
 * `crypto.randomUUID()` бросит TypeError.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Ленивый импорт oidc, чтобы избежать циклической зависимости.
 */
async function getToken(): Promise<string | null> {
  try {
    const { userManager } = await import('./oidc');
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
  } catch {
    return null;
  }
}

export class ApiClient {
  private buildQuery(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((v) => sp.append(key, String(v)));
      } else {
        sp.set(key, String(value));
      }
    });
    return sp.toString();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers = new Headers(options.headers);
    const method = (options.method ?? 'GET').toUpperCase();
    const isMutating = method === 'POST' || method === 'PATCH' || method === 'PUT';

    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }
    if (isMutating && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', uuid());
    }
    if (!headers.has('X-Trace-Id')) {
      headers.set('X-Trace-Id', uuid());
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch (e) {
      throw new ApiError(
        e instanceof Error ? e.message : 'Нет соединения с сервером',
        0,
        ERROR_CODES.NETWORK_ERROR,
      );
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    // Любая ошибка
    if (!res.ok) {
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // ignore — тело не JSON
      }

      const code =
        (body.code as string | undefined) ??
        (res.status === 401 ? ERROR_CODES.UNAUTHORIZED : `HTTP-${res.status}`);
      const message =
        (body.message as string | undefined) ?? `Ошибка ${res.status}`;

      throw new ApiError(
        message,
        res.status,
        code,
        body.details,
        body.requestId as string | undefined,
      );
    }

    // Успех
    const json = (await res.json()) as ApiEnvelope<T> | T;
    if (typeof json === 'object' && json !== null && 'ok' in json && 'data' in json) {
      return (json as ApiEnvelope<T>).data;
    }
    return json as T;
  }

  get<T>(path: string, options?: { params?: Record<string, unknown> }): Promise<T> {
    const url = options?.params ? `${path}?${this.buildQuery(options.params)}` : path;
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = void>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  /**
   * GET с пагинацией — возвращает и data, и pagination.
   */
  async getPaginated<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: T; pagination?: Pagination }> {
    const token = await getToken();
    const url = params ? `${path}?${this.buildQuery(params)}` : path;
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('X-Trace-Id')) {
      headers.set('X-Trace-Id', uuid());
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}${url}`, { headers });
    } catch (e) {
      throw new ApiError(
        e instanceof Error ? e.message : 'Нет соединения с сервером',
        0,
        ERROR_CODES.NETWORK_ERROR,
      );
    }

    if (!res.ok) {
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(
        (body.message as string) ?? `Ошибка ${res.status}`,
        res.status,
        (body.code as string) ?? `HTTP-${res.status}`,
      );
    }

    const json = (await res.json()) as ApiEnvelope<T>;
    return { data: json.data, pagination: json.pagination };
  }

  /**
   * Загрузка файла (multipart/form-data).
   */
  async upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: formData });
  }
}

/** Глобальный singleton. */
export const api = new ApiClient();