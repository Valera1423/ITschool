import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  Play,
  Download,
  Send,
  Mail,
} from 'lucide-react';
import type { Segment, University, Interaction, Task } from '@/types';
import {
  listSegments,
  deleteSegment,
  evaluateSegmentBackend,
  segmentColor,
  describeRule,
} from '@/lib/segments';
import { useUndo } from '@/components/UndoProvider';
import {
  EmptyState,
  SimpleModal,
  Button,
  StatusBadge,
  Avatar,
} from '@/components/ui';
import { asArray, downloadCSV } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SegmentEditorModal } from '@/components/segments/SegmentEditorModal';

/**
 * Умные сегменты вузов.
 *
 * Движок сегментации — на backend (`/segments/:id/evaluate`).
 * Локальный превью без сервера — через `evaluateSegment` из lib/segments.
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  onNotice: (msg: string) => void;
}

export function SegmentsPage({
  universities,
  interactions: _interactions,
  tasks: _tasks,
  onNotice,
}: Props) {
  const { user } = useAuth();
  const { notifyWithUndo } = useUndo();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [previewSegment, setPreviewSegment] = useState<Segment | null>(null);
  const [results, setResults] = useState<Record<string, University[]>>({});
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSegments(user?.profileId ?? null);
      setSegments(asArray(list));
    } finally {
      setLoading(false);
    }
  }, [user?.profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Оценка сегментов на бэке при изменении списка
  useEffect(() => {
    if (segments.length === 0) {
      setResults({});
      return;
    }

    let cancelled = false;
    setEvaluating(true);

    void (async () => {
      const map: Record<string, University[]> = {};
      await Promise.all(
        segments.map(async (s) => {
          map[s.id] = await evaluateSegmentBackend(s.id);
        }),
      );
      if (cancelled) return;
      setResults(map);
      setEvaluating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [segments]);

  const handleDelete = async (seg: Segment) => {
    if (!window.confirm(`Удалить сегмент «${seg.name}»?`)) return;
    const err = await deleteSegment(seg.id);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    notifyWithUndo(`Сегмент «${seg.name}» удалён`, async () => {
      // backend восстанавливает удалённые сегменты по deleted_at — если поддерживает
      // если нет — просто перезагружаем
      await load();
    });
    await load();
  };

  const handleExport = (seg: Segment) => {
    const list = results[seg.id] ?? [];
    downloadCSV(`segment-${seg.name}.csv`, [
      ['Название', 'Город', 'Статус', 'Менеджер', 'Email', 'Телефон'],
      ...list.map((u) => [
        u.name,
        u.city,
        u.status,
        u.manager,
        u.contact_email ?? '',
        u.contact_phone ?? '',
      ]),
    ]);
    onNotice(`Экспортировано ${list.length} вузов.`);
  };

  const handleBulkEmail = (seg: Segment) => {
    const list = results[seg.id] ?? [];
    const emails = list
      .map((u) => u.contact_email)
      .filter((e): e is string => Boolean(e));
    if (emails.length === 0) {
      onNotice('Нет email в сегменте.');
      return;
    }
    window.location.href = `mailto:${emails.join(',')}`;
    onNotice(`Открыт почтовый клиент с ${emails.length} адресами.`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Умные группы</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Сегменты
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Правила «если — то» для автоматической группировки вузов.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Новый сегмент
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : segments.length === 0 ? (
        <EmptyState
          text="Сегментов нет"
          hint="Создайте первый сегмент, например «Без касаний 14 дней»"
          actionLabel="Создать"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          icon={Users}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((s) => {
            const list = results[s.id] ?? [];
            const c = segmentColor(s.color);
            const rules = asArray(s.rules);

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg} ${c.text}`}
                  >
                    <Users size={20} />
                  </div>
                  {s.shared && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      общий
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  {s.name}
                </h3>
                {s.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                    {s.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`px-3 py-1.5 rounded-lg ${c.bg} ${c.text} text-sm font-bold`}
                  >
                    {evaluating ? '…' : `${list.length} вузов`}
                  </div>
                  <span className="text-xs text-slate-400">
                    {rules.length} правил · {s.logic}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {rules.slice(0, 2).map((r, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                    >
                      {describeRule(r)}
                    </span>
                  ))}
                  {rules.length > 2 && (
                    <span className="text-[10px] text-slate-400">
                      +{rules.length - 2}
                    </span>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-1 pt-3 border-t border-slate-50 dark:border-slate-800">
                  <button
                    onClick={() => setPreviewSegment(s)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                    title="Предпросмотр"
                    aria-label="Предпросмотр"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => handleExport(s)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600"
                    title="Экспорт CSV"
                    aria-label="Экспорт CSV"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleBulkEmail(s)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600"
                    title="Массовое письмо"
                    aria-label="Массовое письмо"
                  >
                    <Mail size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(s);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                    title="Редактировать"
                    aria-label="Редактировать"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void handleDelete(s)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewSegment && (
        <SimpleModal
          title={`Сегмент: ${previewSegment.name}`}
          onClose={() => setPreviewSegment(null)}
          wide
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Найдено:{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {(results[previewSegment.id] ?? []).length}
              </strong>{' '}
              вузов
            </p>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {(results[previewSegment.id] ?? []).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {u.city} · {u.direction}
                    </p>
                  </div>
                  <StatusBadge status={u.status} />
                  <Avatar name={u.manager} size="sm" />
                </div>
              ))}
              {(results[previewSegment.id] ?? []).length === 0 && (
                <EmptyState text="Вузов не найдено" />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => handleExport(previewSegment)}
              >
                <Download size={14} />
                Экспорт
              </Button>
              <Button onClick={() => handleBulkEmail(previewSegment)}>
                <Send size={14} />
                Массовое письмо
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {modalOpen && (
        <SegmentEditorModal
          segment={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={load}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}