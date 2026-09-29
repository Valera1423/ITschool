// frontend/src/components/BulkActionsBar.tsx
import { useState } from 'react';
import {
  CheckSquare,
  X,
  User as UserIcon,
  Tag as TagIcon,
  Trash2,
  Download,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';
import type { Tag, University } from '@/types';
import { UNIVERSITY_STATUSES } from '@/constants';

interface ManagerOption {
  id: string;
  name: string;
}

type ApplyToAllAction =
  | 'update_status'
  | 'assign_manager'
  | 'add_tag'
  | 'remove_tag';

interface Props {
  selected: University[];
  allTags: Tag[];
  managers: ManagerOption[];
  onClear: () => void;
  onChangeStatus: (status: string) => Promise<void>;
  /**
   * Передать выбранные вузы другому менеджеру.
   * В режиме `applyToAll` comment не запрашивается — bulk-by-filter
   * работает по фильтру, и один комментарий ко всем был бы странным.
   */
  onTransfer: (managerId: string, comment?: string) => Promise<void>;
  onAddTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onExport: () => void;
  canEdit: boolean;
  /** Массовое применение ко ВСЕМ найденным по фильтру */
  onApplyToAllFiltered?: (
    action: ApplyToAllAction,
    value: string,
  ) => Promise<void>;
  /** Всего найдено по текущему фильтру (для подсказки) */
  totalFiltered?: number;
}

const CHUNK_SIZE = 200;

/**
 * Панель массовых действий.
 *
 * Если выбран чекбокс «применить ко всем N», действия идут
 * не по `selected`, а по фильтру на бэкенде (bulk-by-filter).
 */
export function BulkActionsBar({
  selected,
  allTags,
  managers,
  onClear,
  onChangeStatus,
  onTransfer,
  onAddTag,
  onRemoveTag,
  onDelete,
  onExport,
  canEdit,
  onApplyToAllFiltered,
  totalFiltered,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);

  if (selected.length === 0) return null;

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const showChunkedHint = selected.length > CHUNK_SIZE;
  const chunkCount = Math.ceil(selected.length / CHUNK_SIZE);

  const canApplyToAll =
    canEdit &&
    !!onApplyToAllFiltered &&
    totalFiltered !== undefined &&
    totalFiltered > selected.length;

  const selectCls =
    'bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50';

  const handleClear = () => {
    setApplyToAll(false);
    onClear();
  };

  const handleStatus = (v: string) => {
    void wrap(() => {
      if (applyToAll && onApplyToAllFiltered) {
        return onApplyToAllFiltered('update_status', v);
      }
      return onChangeStatus(v);
    });
  };

  const handleTransfer = (managerId: string) => {
    if (applyToAll && onApplyToAllFiltered) {
      void wrap(() => onApplyToAllFiltered('assign_manager', managerId));
      return;
    }

    const comment =
      window.prompt('Комментарий к передаче (необязательно):') ?? undefined;

    void wrap(() =>
      onTransfer(managerId, comment?.trim() ? comment.trim() : undefined),
    );
  };

  const handleAddTag = (v: string) => {
    void wrap(() => {
      if (applyToAll && onApplyToAllFiltered) {
        return onApplyToAllFiltered('add_tag', v);
      }
      return onAddTag(v);
    });
  };

  const handleRemoveTag = (v: string) => {
    void wrap(() => {
      if (applyToAll && onApplyToAllFiltered) {
        return onApplyToAllFiltered('remove_tag', v);
      }
      return onRemoveTag(v);
    });
  };

  return (
    <div className="sticky top-16 z-30 mb-4 animate-slide-up">
      <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-2xl border border-slate-700/50 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <span className="text-sm font-semibold">
            Выбрано: {selected.length}
          </span>
          {totalFiltered !== undefined && totalFiltered > selected.length && (
            <span className="text-[10px] text-amber-300 bg-amber-900/40 px-1.5 py-0.5 rounded">
              всего по фильтру: {totalFiltered}
            </span>
          )}
          {showChunkedHint && (
            <span className="text-[10px] text-slate-400 bg-slate-800 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {chunkCount} порц. × {CHUNK_SIZE}
            </span>
          )}
          {busy && (
            <Loader2 size={12} className="animate-spin text-sky-400" />
          )}
          <button
            onClick={handleClear}
            disabled={busy}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Снять выделение"
          >
            <X size={14} />
          </button>
        </div>

        {canApplyToAll && (
          <label
            className="flex items-center gap-1.5 text-xs text-amber-200 cursor-pointer select-none px-2 py-1 rounded-lg bg-amber-900/30 border border-amber-700/40"
            title={`Применить действие ко всем ${totalFiltered} найденным по фильтру`}
          >
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              disabled={busy}
              className="w-3.5 h-3.5 rounded border-slate-600 text-sky-500"
            />
            <CheckSquare size={12} />
            <span>применить ко всем {totalFiltered}</span>
          </label>
        )}

        {canEdit && (
          <>
            <div className="flex items-center gap-1.5">
              <ArrowRightCircle size={14} className="text-slate-400" />
              <select
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (v) handleStatus(v);
                }}
                className={selectCls}
              >
                <option value="">Изменить статус…</option>
                {UNIVERSITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <UserIcon size={14} className="text-slate-400" />
              <select
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (v) handleTransfer(v);
                }}
                className={selectCls}
                title="Передать выбранные вузы другому менеджеру"
              >
                <option value="">Передать менеджеру…</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <TagIcon size={14} className="text-slate-400" />
              <select
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (v) handleAddTag(v);
                }}
                className={selectCls}
              >
                <option value="">Добавить тег…</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <TagIcon size={14} className="text-slate-400" />
              <select
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (v) handleRemoveTag(v);
                }}
                className={selectCls}
              >
                <option value="">Снять тег…</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={onExport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Download size={13} /> Экспорт
        </button>

        {canEdit && (
          <button
            onClick={() => {
              const target =
                applyToAll && totalFiltered
                  ? totalFiltered
                  : selected.length;
              if (
                window.confirm(
                  `Удалить ${target} вузов?` +
                    (showChunkedHint
                      ? `\n\nБудет обработано ${chunkCount} порциями по ${CHUNK_SIZE}.`
                      : ''),
                )
              ) {
                void wrap(onDelete);
              }
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-medium transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}