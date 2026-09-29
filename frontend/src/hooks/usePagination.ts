import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

interface Options {
  path: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
  pageSize?: number;
  enabled?: boolean;
}

interface State<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

export function usePagination<T extends { id: string }>({
  path,
  filters = {},
  pageSize = 25,
  enabled = true,
}: Options) {
  const api = useApi();
  const qc = useQueryClient();

  const [state, setState] = useState<State<T>>({
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    error: null,
  });

  const pageRef = useRef(1);

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });

  const filtersKey = JSON.stringify(filters ?? {});

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadFirst = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    pageRef.current = 1;

    try {
      const res = await api.getPaginated<T[]>(path, {
        page: 1,
        pageSize,
        ...filtersRef.current,
      });

      const items = Array.isArray(res.data) ? res.data : [];
      const total = res.pagination?.total ?? items.length;

      setState({
        items,
        loading: false,
        loadingMore: false,
        hasMore: items.length < total,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        error: e instanceof Error ? e.message : 'Ошибка загрузки',
      }));
    }
  }, [path, pageSize, api]);

  const loadMore = useCallback(async () => {
    const s = stateRef.current;
    if (s.loadingMore || !s.hasMore) return;

    const nextPage = pageRef.current + 1;
    setState((prev) => ({ ...prev, loadingMore: true }));

    try {
      const res = await api.getPaginated<T[]>(path, {
        page: nextPage,
        pageSize,
        ...filtersRef.current,
      });

      const items = Array.isArray(res.data) ? res.data : [];
      const total = res.pagination?.total ?? 0;

      pageRef.current = nextPage;

      setState((prev) => ({
        items: [...prev.items, ...items],
        loading: false,
        loadingMore: false,
        hasMore: prev.items.length + items.length < total,
        error: null,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loadingMore: false,
        error: e instanceof Error ? e.message : 'Ошибка загрузки',
      }));
    }
  }, [path, pageSize, api]);

  const reload = useCallback(() => {
    void loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    if (enabled) void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, path, pageSize, filtersKey]);

  useEffect(() => {
    if (!enabled) return;

    const prefix =
      path.replace(/^\/+/, '').split('/')[0].split('?')[0] || '';

    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;

      const key = event.query.queryKey;
      if (!Array.isArray(key) || key[0] !== prefix) return;

      void loadFirst();
    });

    return unsubscribe;
  }, [qc, path, enabled, loadFirst]);

  return { ...state, loadMore, reload };
}