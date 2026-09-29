import { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  User as UserIcon,
  RefreshCw,
  RotateCcw,
  Trash2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { AuditLogEntry } from '@/types';
import {
  EmptyState,
  StatusBadge,
  inputClass,
  selectClass,
} from '@/components/ui';
import { asArray, formatDateTime } from '@/lib/utils';

/**
 * Журнал аудита — «кто, что, когда».
 *
 * Каждое изменение в таблицах universities, tasks, interactions,
 * workflows логируется через триггер log_audit() в audit_log.
 */
interface Props {
  logs: AuditLogEntry[];
  onRefresh: () => Promise<void>;
}

const ENTITY_LABELS: Record<string, string> = {
  universities: 'Вуз',
  interactions: 'Взаимодействие',
  tasks: 'Задача',
  workflows: 'Workflow',
  comments: 'Комментарий',
  contracts: 'Договор',
  workspace_users: 'Пользователь',
  integrations: 'Интеграция',
  profiles: 'Профиль',
};

const ACTION_ICON = {
  insert: Plus,
  update: RefreshCw,
  delete: Trash2,
  restore: RotateCcw,
} as const;

const ACTION_LABEL = {
  insert: 'Создано',
  update: 'Изменено',
  delete: 'Удалено',
  restore: 'Восстановлено',
} as const;

function summarize(
  entity: string,
  row: Record<string, unknown> | null,
): string {
  if (!row) return '—';
  const title =
    row.name ?? row.title ?? row.full_name ?? row.email ?? row.body ?? row.id;
  return `${ENTITY_LABELS[entity] ?? entity}: ${String(title).slice(0, 80)}`;
}

export function JournalPage({ logs, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('Все');
  const [actionFilter, setActionFilter] = useState<
    'Все' | 'insert' | 'update' | 'delete' | 'restore'
  >('Все');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const safeLogs = asArray<AuditLogEntry>(logs);

  const entities = useMemo(
    () => ['Все', ...Array.from(new Set(safeLogs.map((l) => l.entity)))],
    [safeLogs],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return safeLogs.filter((l) => {
      const blob = `${l.user_email ?? ''} ${l.entity} ${l.entity_id ?? ''} ${JSON.stringify(
        l.after ?? {},
      )} ${JSON.stringify(l.before ?? {})}`;
      return (
        blob.toLowerCase().includes(q) &&
        (entityFilter === 'Все' || l.entity === entityFilter) &&
        (actionFilter === 'Все' || l.action === actionFilter)
      );
    });
  }, [safeLogs, search, entityFilter, actionFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Аудит изменений</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Журнал
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            История изменений всех сущностей с указанием автора и времени.
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          aria-label="Обновить"
          disabled={refreshing}
        >
          <RefreshCw
            size={18}
            className={refreshing ? 'animate-spin' : ''}
          />
        </button>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по автору или содержимому"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className={`${selectClass} sm:w-44`}
        >
          {entities.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) =>
            setActionFilter(e.target.value as typeof actionFilter)
          }
          className={`${selectClass} sm:w-44`}
        >
          <option value="Все">Все действия</option>
          <option value="insert">Создание</option>
          <option value="update">Изменение</option>
          <option value="delete">Удаление</option>
          <option value="restore">Восстановление</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Записей нет" icon={ShieldCheck} />
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const Icon = ACTION_ICON[l.action];
            const isExpanded = expanded === l.id;
            const color =
              l.action === 'delete'
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                : l.action === 'insert'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : l.action === 'restore'
                    ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300';
            return (
              <div
                key={l.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : l.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {ACTION_LABEL[l.action]} ·{' '}
                      {summarize(l.entity, l.after ?? l.before)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <UserIcon size={11} />
                        {l.user_email ?? 'система'}
                      </span>
                      <span>{formatDateTime(l.created_at)}</span>
                      <span className="font-mono text-[10px]">
                        {l.entity}#{l.entity_id?.slice(0, 8) ?? '—'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={ACTION_LABEL[l.action]} />
                </button>
                {isExpanded && (
                  <div className="grid sm:grid-cols-2 gap-4 p-4 pt-0 border-t border-slate-100 dark:border-slate-800">
                    {l.before && (
                      <div>
                        <p className="text-xs text-rose-500 font-medium mb-1">
                          До
                        </p>
                        <pre className="text-[10px] bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(l.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {l.after && (
                      <div>
                        <p className="text-xs text-emerald-600 font-medium mb-1">
                          После
                        </p>
                        <pre className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(l.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}