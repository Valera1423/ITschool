import { useEffect, useState } from 'react';
import { History, RotateCcw, ArrowRight } from 'lucide-react';
import {
  listVersions, diffVersions, rollbackToVersion,
  type EntityVersionMeta, type VersionDiff,
} from '@/lib/versions';
import { Button, EmptyState, SimpleModal } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface Props {
  entity: string;
  entityId: string;
  onRollback?: (snapshot: Record<string, unknown>) => Promise<void>;
  onNotice: (msg: string) => void;
}

export function VersionsPanel({ entity, entityId, onRollback, onNotice }: Props) {
  const [versions, setVersions] = useState<EntityVersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const list = await listVersions(entity, entityId);
      setVersions(list);
      setLoading(false);
    })();
  }, [entity, entityId]);

  const showDiff = async (v: EntityVersionMeta) => {
    const prev = versions.find((x) => x.version === v.version - 1);
    if (!prev) {
      onNotice('Нет предыдущей версии для сравнения');
      return;
    }
    const d = await diffVersions(entity, entityId, prev.version, v.version);
    setDiff(d);
    setSelected(v.version);
  };

  const handleRollback = async (v: EntityVersionMeta) => {
    if (!window.confirm(`Откатить до версии ${v.version}? Текущее состояние будет сохранено как новая версия.`)) return;
    const snapshot = await rollbackToVersion(entity, entityId, v.version);
    if (!snapshot) {
      onNotice('Не удалось получить версию');
      return;
    }
    if (onRollback) {
      await onRollback(snapshot);
      onNotice(`Откат к версии ${v.version} выполнен`);
    } else {
      onNotice('Откат недоступен: не передан обработчик');
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Загрузка…</p>;
  if (versions.length === 0) return <EmptyState text="Версий нет" icon={History} />;

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
            v{v.version}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {v.comment ?? 'Без комментария'}
            </p>
            <p className="text-xs text-slate-400">
              {v.author_name ?? 'система'} · {formatDateTime(v.created_at)}
            </p>
          </div>
          <button
            onClick={() => void showDiff(v)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Показать diff"
          >
            <ArrowRight size={14} />
          </button>
          {v.version < (versions[0]?.version ?? 0) && onRollback && (
            <button
              onClick={() => void handleRollback(v)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              title="Откатить"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      ))}

      {diff && selected !== null && (
        <SimpleModal title={`Diff v${diff.from_version} → v${diff.to_version}`} onClose={() => setDiff(null)} wide>
          {diff.changes.length === 0 ? (
            <p className="text-sm text-slate-500">Нет изменений</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {diff.changes.map((c) => (
                <div key={c.field} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-xs font-semibold text-slate-500 mb-1">{c.field}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-rose-600 line-through">
                      {String(c.before ?? '—')}
                    </div>
                    <div className="text-emerald-600">
                      {String(c.after ?? '—')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SimpleModal>
      )}
    </div>
  );
}