// frontend/src/lib/orders.ts
import { api } from './api';
import type { Order } from '@/types';

export interface OrderImportResult {
  inserted: number;
  skipped: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
}

export interface OrderStats {
  totalOrders: number;
  newOrdersLast30d: number;
  paidOrders: number;
  conversionPct: number;
  totalRevenue: number;
}

export async function listOrders(
  params: { page?: number; pageSize?: number } = {},
): Promise<Order[]> {
  try {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    return await api.get<Order[]>(`/orders?${sp.toString()}`);
  } catch {
    return [];
  }
}

export async function fetchOrderStats(): Promise<OrderStats | null> {
  try {
    return await api.get<OrderStats>('/orders/stats');
  } catch {
    return null;
  }
}

export async function importOrders(
  rows: {
    externalId: string;
    courseName: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    phone?: string | null;
    email?: string | null;
    streamNumber: number;
  }[],
): Promise<OrderImportResult> {
  try {
    return await api.post<OrderImportResult>('/orders/import', { rows });
  } catch (e) {
    return {
      inserted: 0,
      skipped: 0,
      failed: rows.length,
      errors: [
        { rowIndex: -1, message: e instanceof Error ? e.message : 'Ошибка' },
      ],
    };
  }
}