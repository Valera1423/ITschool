import type { Request } from 'express';

/**
 * Возвращает IP клиента.
 *
 * ВАЖНО: НЕ парсим X-Forwarded-For вручную — заголовок можно подделать,
 * и первый элемент в нём не обязательно реальный клиент.
 *
 * Express с `app.set('trust proxy', N)` (см. index.ts) сам делает
 * корректный выбор: берёт N-й хоп с конца XFF (наши прокси) и
 * возвращает следующий за ним адрес. Если заголовок отсутствует —
 * возвращает socket-address.
 */
export function getClientIp(req: Request): string | null {
  return req.ip ?? null;
}