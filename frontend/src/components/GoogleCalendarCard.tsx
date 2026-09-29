import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui';

/**
 * Карточка Google Calendar.
 * Подключение / отключение / ручная синхронизация через OAuth-флоу backend.
 */
export function GoogleCalendarCard({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const api = useApi();
  const [connection, setConnection] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const c = await api.get<{ email?: string } | null>('/google/connection');
        if (!cancelled) setConnection(c);
      } catch {
        if (!cancelled) setConnection(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const connect = () => {
    // Редирект на backend, который сделает redirect на Google OAuth
    const apiUrl = import.meta.env.VITE_API_URL;
    window.location.href = `${apiUrl}/google/authorize`;
  };

  const disconnect = async () => {
    if (!window.confirm('Отключить Google Calendar?')) return;
    try {
      await api.delete('/google/connection');
      setConnection(null);
      onNotice('Отключено.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const sync = async () => {
    try {
      const r = await api.post<{ synced?: number }>('/google/sync');
      onNotice(`Синхронизировано: ${r.synced ?? 0}`);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <p className="text-sm text-slate-400">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
      <h2 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100">
        Google Calendar
      </h2>

      {connection ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✓ Подключён {connection.email ?? ''}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => void sync()}>Синхронизировать</Button>
            <Button variant="secondary" onClick={() => void disconnect()}>
              Отключить
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={connect}>Подключить Google Calendar</Button>
      )}
    </div>
  );
}