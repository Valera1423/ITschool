import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './useApi';
import type { AppNotification } from '@/types';

/**
 * In-app уведомления (колокольчик).
 *
 * - Загружает список с backend
 * - Обновление при возврате во вкладку
 * - markRead / markAllRead / remove
 */
export function useNotifications() {
  const api = useApi();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<AppNotification[]>('/notifications?limit=50');
      if (mountedRef.current) setItems(list);
    } catch {
      if (mountedRef.current) setItems([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await api.patch(`/notifications/${id}`, { read: true });
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      } catch {
        /* ignore */
      }
    },
    [api],
  );

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }, [api]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/notifications/${id}`);
        setItems((prev) => prev.filter((n) => n.id !== id));
      } catch {
        /* ignore */
      }
    },
    [api],
  );

  // Первичная загрузка
  useEffect(() => {
    void load();
  }, [load]);

  // Обновление при возврате во вкладку
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  return { items, loading, unread, reload: load, markRead, markAllRead, remove };
}