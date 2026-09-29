import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Trash2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime, asArray } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';

interface TrashItem {
  id: string;
  entity: 'universities' | 'interactions' | 'tasks' | 'workflows';
  title: string;
  deleted_at: string;
}

interface Props {
  onNotice: (msg: string) => void;
  onRefresh?: () => Promise<void>;
}

const ENTITY_LABEL: Record<TrashItem['entity'], string> = {
  universities: 'Вуз',
  interactions: 'Взаимодействие',
  tasks: 'Задача',
  workflows: 'Workflow',
};

const ENDPOINTS: Record<TrashItem['entity'], string> = {
  universities: '/universities',
  interactions: '/interactions',
  tasks: '/tasks',
  workflows: '/workflows',
};

export function TrashPage({ onNotice, onRefresh }: Props) {
  const api = useApi();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | TrashItem['entity']>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [unis, inter, tasks, wfs] = await Promise.all([
        api.get<{ id: string; name: string; deleted_at: string | null }[]>(
          '/universities?onlyDeleted=true&pageSize=100',
        ).catch(() => []),
        api.get<{ id: string; title: string; deleted_at: string | null }[]>(
          '/interactions?onlyDeleted=true&pageSize=100',
        ).catch(() => []),
        api.get<{ id: string; title: string; deleted_at: string | null }[]>(
          '/tasks?onlyDeleted=true&pageSize=100',
        ).catch(() => []),
        api.get<{ id: string; name: string; deleted_at: string | null }[]>(
          '/workflows?includeDeleted=true',
        ).catch(() => []),
      ]);

      const out: TrashItem[] = [];
      asArray(unis).forEach((u) => {
        if (u.deleted_at) out.push({ id: u.id, entity: 'universities', title: u.name, deleted_at: u.deleted_at });
      });
      asArray(inter).forEach((i) => {
        if (i.deleted_at) out.push({ id: i.id, entity: 'interactions', title: i.title, deleted_at: i.deleted_at });
      });
      asArray(tasks).forEach((t) => {
        if (t.deleted_at) out.push({ id: t.id, entity: 'tasks', title: t.title, deleted_at: t.deleted_at });
      });
      asArray(wfs).forEach((w) => {
        if (w.deleted_at) out.push({ id: w.id, entity: 'workflows', title: w.name, deleted_at: w.deleted_at });
      });

      setItems(out.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const filtered = typeFilter === 'all' ? items : items.filter((i) => i.entity === typeFilter);

  const restore = async (item: TrashItem) => {
    setBusy(item.id);
    try {
      // NEW: явный /restore
      await api.post(`${ENDPOINTS[item.entity]}/${item.id}/restore`);
      onNotice(`«${item.title}» восстановлено.`);
      await load();
      await onRefresh?.();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(null);
    }
  };

  const purge = async (item: TrashItem) => {
    if (!window.confirm(`Удалить навсегда «${item.title}»? Это действие необратимо.`)) return;
    setBusy(item.id);
    try {
      await api.delete(`${ENDPOINTS[item.entity]}/${item.id}`);
      onNotice('Удалено навсегда.');
      await load();
      await onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const daysLeft = (iso: string): number => {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return 0;
    const ms = 30 * 86400000 - (Date.now() - t);
    return Math.max(0, Math.ceil(ms / 86400000));
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Удалённые записи</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Корзина</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            Записи автоматически удаляются через 30 дней.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Обновить"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </section>

      <div className="flex flex-wrap gap-2">
        {(['all', 'universities', 'interactions', 'tasks', 'workflows'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === key
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {key === 'all' ? 'Все' : ENTITY_LABEL[key]}
            <span className="ml-2 opacity-70">
              {key === 'all' ? items.length : items.filter((i) => i.entity === key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto text-sky-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState text="Корзина пуста" />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={`${item.entity}-${item.id}`}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={ENTITY_LABEL[item.entity]} />
                  <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                    осталось {daysLeft(item.deleted_at)} дн.
                  </span>
                </div>
                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</p>
                <p className="text-xs text-slate-400">Удалено {formatDateTime(item.deleted_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void restore(item)}
                  disabled={busy === item.id}
                >
                  <RotateCcw size={14} /> Восстановить
                </Button>
                <button
                  onClick={() => void purge(item)}
                  disabled={busy === item.id}
                  className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors disabled:opacity-50"
                  title="Удалить навсегда"
                  aria-label="Удалить навсегда"
                >
                  {busy === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}