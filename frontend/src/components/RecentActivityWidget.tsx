// frontend/src/components/RecentActivityWidget.tsx
import { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { fetchRecentActivity, clearActivity, ACTION_LABELS, type ActivityItem } from '@/lib/activity';
import { EmptyState } from '@/components/ui';

interface Props {
  onNavigate?: (view: string, entityId?: string) => void;
  onNotice?: (msg: string) => void;
}

export function RecentActivityWidget({ onNavigate, onNotice }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchRecentActivity(15);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Очистить историю действий?')) return;
    await clearActivity();
    onNotice?.('История очищена.');
    await load();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
        <p className="text-sm text-slate-400">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <History size={18} className="text-sky-500" />
          Недавние действия
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Обновить"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {items.length > 0 && (
            <button
              onClick={() => void handleClear()}
              className="text-xs text-slate-400 hover:text-rose-500"
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState text="Действий пока нет" />
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {items.map((it, i) => (
            <button
              key={`${it.ts}-${i}`}
              onClick={() =>
                onNavigate?.(it.entity, it.entityId ?? undefined)
              }
              className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                {it.entity[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                  {ACTION_LABELS[it.action]} · {it.entity}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(it.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}