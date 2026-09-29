import type { Response } from 'express';
import { toSnakeCase } from './serialize.js';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data: toSnakeCase(data) });
}

export function okPaginated<T>(res: Response, items: T[], pagination: Pagination) {
  return res.status(200).json({
    ok: true,
    data: toSnakeCase(items),
    pagination,
  });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ ok: true, data: toSnakeCase(data) });
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPagination(page: number, pageSize: number, total: number): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}