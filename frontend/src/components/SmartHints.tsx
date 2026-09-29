import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface SmartHint {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Smart hints — карточка «Требует внимания» на дашборде.
 *
 * Загружает подсказки типа smart_hint из уведомлений.
 * Если их нет — карточка не рендерится.
 */
export function SmartHints() {
  const api = useApi();
  const [hints, setHints] = useState<SmartHint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await api.get<SmartHint[]>(
          '/notifications?type=smart_hint&limit=20',
        );
        if (cancelled) return;
        setHints(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setHints([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!loaded || hints.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-amber-500" />
        <h3 className="font-semibold text-amber-800 dark:text-amber-200">
          Требует внимания ({hints.length})
        </h3>
      </div>
      <div className="space-y-2">
        {hints.slice(0, 5).map((h) => (
          <button
            key={h.id}
            onClick={() => {
              if (h.action_url) window.location.href = h.action_url;
            }}
            className="w-full text-left p-3 rounded-xl bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
          >
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {h.title}
            </p>
            {h.body && (
              <p className="text-xs text-slate-500 mt-0.5">{h.body}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}