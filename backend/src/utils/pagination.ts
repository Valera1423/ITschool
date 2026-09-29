import type { Request } from 'express';

export interface CursorPagination {
  take: number;
  cursor: { id: string } | undefined;
  skip?: number;
  direction: 'forward' | 'backward';
}

/**
 * Парсит cursor из query.
 * `?cursor=<uuid>&limit=50&dir=forward`
 */
export function parseCursor(req: Request): CursorPagination {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const dir = req.query.dir === 'backward' ? 'backward' : 'forward';

  return {
    take: limit,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0, // skip 1, чтобы не включать сам cursor
    direction: dir,
  };
}

/**
 * Формирует ответ с курсорами.
 */
export function buildCursorPage<T extends { id: string }>(
  items: T[],
  limit: number,
): {
  items: T[];
  pagination: {
    limit: number;
    count: number;
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
  };
} {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  return {
    items: sliced,
    pagination: {
      limit,
      count: sliced.length,
      nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
      prevCursor: sliced.length > 0 ? sliced[0].id : null,
      hasMore,
    },
  };
}