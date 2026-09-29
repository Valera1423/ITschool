import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { mockApi } from '../mocks/api';

/**
 * usePagination → useApi → useAuth.
 * Мокаем AuthContext, чтобы не тянуть OIDC/useCurrentUser.
 */
vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/AuthContext')>(
    '@/contexts/AuthContext',
  );
  return {
    ...actual,
    useAuth: () => ({
      user: { role: 'admin', permissions: [] },
      oidc: {},
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

/**
 * Мок ApiClient — иначе usePagination реально дёргает fetch
 * по относительному URL, что в jsdom падает:
 *   "Failed to parse URL from /api/v1/test?..."
 *
 * ВАЖНО: vi.mock должен быть в ЭТОМ файле. Мок из tests/mocks/api.ts
 * не хойстится в импортирующий модуль — это не работает.
 */
vi.mock('@/lib/api', () => ({ api: mockApi }));

import { usePagination } from '@/hooks/usePagination';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('usePagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('загружает первую страницу', async () => {
    mockApi.getPaginated.mockResolvedValue({
      data: [{ id: 'a' }, { id: 'b' }],
      pagination: { page: 1, pageSize: 25, total: 10, totalPages: 1 },
    });

    const { result } = renderHook(
      () => usePagination<{ id: string }>({ path: '/test' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getPaginated).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('loadMore добавляет элементы', async () => {
    mockApi.getPaginated
      .mockResolvedValueOnce({
        data: [{ id: 'a' }],
        pagination: { page: 1, pageSize: 25, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'b' }],
        pagination: { page: 2, pageSize: 25, total: 2, totalPages: 2 },
      });

    const { result } = renderHook(
      () => usePagination<{ id: string }>({ path: '/test' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('обрабатывает ошибку', async () => {
    mockApi.getPaginated.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(
      () => usePagination<{ id: string }>({ path: '/test' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('Server');
  });
});