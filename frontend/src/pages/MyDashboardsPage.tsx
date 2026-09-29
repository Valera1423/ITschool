import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Check,
  Copy,
  GripVertical,
  LayoutGrid,
  Pencil,
  Plus,
  Save,
  Share2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type {
  Dashboard,
  DashboardWidget,
  WidgetType,
  University,
  Interaction,
  Task,
  Workflow,
} from '@/types';
import {
  listDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  duplicateDashboard,
  defaultLayout,
  WIDGET_LIBRARY,
  widgetTitle,
  widgetSpan,
} from '@/lib/dashboards';
import { useAuth } from '@/contexts/AuthContext';
import {
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
} from '@/components/ui';
import { WidgetRenderer } from '@/components/dashboards/WidgetRenderer';

/**
 * «Мои дашборды» — пользователь собирает свой дашборд из виджетов.
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  managers: string[];
  onNotice: (msg: string) => void;
}

// ============================================================
// SORTABLE WIDGET
// ============================================================

function SortableWidget({
  widget,
  editing,
  onRemove,
  onUpdateSpan,
  children,
}: {
  widget: DashboardWidget;
  editing: boolean;
  onRemove: (id: string) => void;
  onUpdateSpan: (id: string, span: 1 | 2 | 3) => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const spanClass =
    widget.span === 3
      ? 'lg:col-span-3'
      : widget.span === 2
        ? 'lg:col-span-2 md:col-span-2'
        : '';

  return (
    <div ref={setNodeRef} style={style} className={`relative ${spanClass}`}>
      {editing ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-dashed border-amber-300 dark:border-amber-700 h-full">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Перетащить виджет"
              >
                <GripVertical size={16} className="text-slate-400" />
              </button>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {widgetTitle(widget.type)}
              </p>
            </div>
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 rounded text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
              aria-label="Удалить виджет"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-400">Ширина:</span>
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                onClick={() => onUpdateSpan(widget.id, s)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  widget.span === s
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-24 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-center">
            <p className="text-xs text-slate-400">
              {widgetTitle(widget.type)}
            </p>
          </div>
        </div>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================

export function MyDashboardsPage({
  universities,
  interactions,
  tasks,
  workflows,
  managers,
  onNotice,
}: Props) {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardWidget[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveModal, setSaveModal] = useState<{
    open: boolean;
    name: string;
    shared: boolean;
    id?: string;
  }>({ open: false, name: '', shared: false });

  // Хуки для DnD — на уровне компонента
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraft((d) => {
      const oldIdx = d.findIndex((w) => w.id === active.id);
      const newIdx = d.findIndex((w) => w.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return d;
      const reordered = arrayMove(d, oldIdx, newIdx);
      return reordered.map((w, i) => ({ ...w, order: i + 1 }));
    });
  }, []);

  const load = useCallback(async () => {
    if (!user?.profileId) return;
    setLoading(true);
    try {
      const list = await listDashboards(user.profileId);
      setDashboards(list);

      if (list.length === 0) {
        // Создаём дашборд «Основной» при первом заходе
        const d = await createDashboard({
          user_id: user.profileId,
          name: 'Основной',
          layout: defaultLayout(),
          is_default: true,
        });
        if (d) {
          setDashboards([d]);
          setActiveId(d.id);
        }
      } else {
        const def = list.find((x) => x.is_default) ?? list[0];
        setActiveId((prev) => prev ?? def.id);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => dashboards.find((d) => d.id === activeId) ?? null,
    [dashboards, activeId],
  );

  const layout = editing ? draft : (active?.layout ?? []);

  const startEdit = () => {
    if (!active) return;
    setDraft([...active.layout].sort((a, b) => a.order - b.order));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft([]);
  };

  const saveLayout = async () => {
    if (!active) return;
    const ordered = draft.map((w, i) => ({ ...w, order: i + 1 }));
    const err = await updateDashboard(active.id, { layout: ordered });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Дашборд сохранён.');
    setEditing(false);
    await load();
  };

  const addWidget = (type: WidgetType) => {
    const id = `w_${Date.now().toString(36)}`;
    setDraft((d) => [
      ...d,
      { id, type, span: widgetSpan(type), order: d.length + 1 },
    ]);
    setPickerOpen(false);
  };

  const removeWidget = (id: string) => {
    setDraft((d) => d.filter((w) => w.id !== id));
  };

  const updateSpan = (id: string, span: 1 | 2 | 3) => {
    setDraft((d) => d.map((w) => (w.id === id ? { ...w, span } : w)));
  };

  const handleDelete = async (d: Dashboard) => {
    if (!window.confirm(`Удалить дашборд «${d.name}»?`)) return;
    const err = await deleteDashboard(d.id);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Дашборд удалён.');
    setActiveId(null);
    await load();
  };

  const handleDuplicate = async (d: Dashboard) => {
    if (!user?.profileId) return;
    const copy = await duplicateDashboard(d.id, user.profileId);
    if (!copy) {
      onNotice('Ошибка при копировании.');
      return;
    }
    onNotice(`Создан «${copy.name}».`);
    await load();
    setActiveId(copy.id);
  };

  const handleMakeDefault = async (d: Dashboard) => {
    await Promise.all(
      dashboards
        .filter((x) => x.is_default && x.id !== d.id)
        .map((x) => updateDashboard(x.id, { is_default: false })),
    );
    await updateDashboard(d.id, { is_default: true });
    onNotice('Назначен по умолчанию.');
    await load();
  };

  const handleCreateNew = async (name: string, shared: boolean) => {
    if (!user?.profileId) return;
    const d = await createDashboard({
      user_id: user.profileId,
      name,
      layout: defaultLayout(),
      shared,
    });
    if (!d) {
      onNotice('Ошибка создания.');
      return;
    }
    onNotice(`Дашборд «${name}» создан.`);
    setSaveModal({ open: false, name: '', shared: false });
    await load();
    setActiveId(d.id);
  };

  const handleRenameSave = async (name: string, shared: boolean, id: string) => {
    await updateDashboard(id, { name, shared });
    onNotice('Сохранено.');
    setSaveModal({ open: false, name: '', shared: false });
    await load();
  };

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Персональные дашборды</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Мои дашборды
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Соберите из виджетов то, что нужно именно вам
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={cancelEdit}>
                <X size={15} />
                Отмена
              </Button>
              <Button onClick={() => void saveLayout()}>
                <Save size={15} />
                Сохранить
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  setSaveModal({ open: true, name: '', shared: false })
                }
              >
                <Plus size={15} />
                Новый дашборд
              </Button>
              <Button onClick={startEdit} disabled={!active}>
                <LayoutGrid size={15} />
                Настроить
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Табы дашбордов */}
      <div className="flex flex-wrap gap-2">
        {dashboards.map((d) => (
          <div
            key={d.id}
            className={`group inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-lg transition-colors ${
              activeId === d.id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <button
              onClick={() => {
                setActiveId(d.id);
                setEditing(false);
              }}
              className="text-sm font-medium"
            >
              {d.is_default && <Star size={12} className="inline mr-1" />}
              {d.name}
              {d.shared && (
                <Share2 size={11} className="inline ml-1 opacity-70" />
              )}
            </button>

            <button
              onClick={() =>
                setSaveModal({
                  open: true,
                  name: d.name,
                  shared: d.shared,
                  id: d.id,
                })
              }
              className={`p-1 rounded hover:bg-black/10 ${
                activeId === d.id
                  ? 'text-white'
                  : 'text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
              title="Переименовать"
              aria-label="Переименовать"
            >
              <Pencil size={11} />
            </button>

            <button
              onClick={() => void handleDuplicate(d)}
              className={`p-1 rounded hover:bg-black/10 ${
                activeId === d.id
                  ? 'text-white'
                  : 'text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
              title="Дублировать"
              aria-label="Дублировать"
            >
              <Copy size={11} />
            </button>

            {!d.is_default && (
              <button
                onClick={() => void handleMakeDefault(d)}
                className={`p-1 rounded hover:bg-black/10 ${
                  activeId === d.id
                    ? 'text-white'
                    : 'text-slate-400 opacity-0 group-hover:opacity-100'
                }`}
                title="Сделать по умолчанию"
                aria-label="Сделать по умолчанию"
              >
                <Star size={11} />
              </button>
            )}

            {dashboards.length > 1 && (
              <button
                onClick={() => void handleDelete(d)}
                className={`p-1 rounded hover:bg-black/10 ${
                  activeId === d.id
                    ? 'text-white'
                    : 'text-slate-400 opacity-0 group-hover:opacity-100'
                }`}
                title="Удалить"
                aria-label="Удалить"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Баннер режима редактирования */}
      {editing && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/40 flex items-center gap-3">
          <LayoutGrid size={18} className="text-amber-600 dark:text-amber-300" />
          <div className="flex-1 text-sm text-amber-700 dark:text-amber-300">
            Режим настройки. Перетаскивайте виджеты, меняйте ширину.
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus size={13} />
            Виджет
          </Button>
        </div>
      )}

      {/* Виджеты */}
      {layout.length === 0 ? (
        <EmptyState
          text="Дашборд пуст"
          hint="Добавьте первый виджет"
          actionLabel="Добавить виджет"
          onAction={() => {
            startEdit();
            setPickerOpen(true);
          }}
          icon={LayoutGrid}
        />
      ) : editing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={layout.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {layout
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((w) => (
                  <SortableWidget
                    key={w.id}
                    widget={w}
                    editing
                    onRemove={removeWidget}
                    onUpdateSpan={updateSpan}
                  >
                    <WidgetRenderer
                      widget={w}
                      universities={universities}
                      interactions={interactions}
                      tasks={tasks}
                      workflows={workflows}
                      managers={managers}
                    />
                  </SortableWidget>
                ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">
          {layout
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((w) => (
              <div
                key={w.id}
                className={`relative ${
                  w.span === 3
                    ? 'lg:col-span-3'
                    : w.span === 2
                      ? 'lg:col-span-2 md:col-span-2'
                      : ''
                }`}
              >
                <WidgetRenderer
                  widget={w}
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  workflows={workflows}
                  managers={managers}
                />
              </div>
            ))}
        </div>
      )}

      {/* Модалка выбора виджета */}
      {pickerOpen && (
        <SimpleModal
          title="Выберите виджет"
          onClose={() => setPickerOpen(false)}
          wide
        >
          <div className="grid sm:grid-cols-2 gap-3">
            {WIDGET_LIBRARY.map((w) => (
              <button
                key={w.type}
                onClick={() => addWidget(w.type)}
                className="text-left p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-sky-300 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-colors"
              >
                <p className="font-medium text-slate-800 dark:text-slate-100 mb-0.5">
                  {w.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {w.description}
                </p>
                <p className="text-[10px] text-slate-400 mt-2">
                  Ширина: {w.span} из 3 колонок
                </p>
              </button>
            ))}
          </div>
        </SimpleModal>
      )}

      {/* Модалка сохранения / переименования */}
      {saveModal.open && (
        <SimpleModal
          title={saveModal.id ? 'Переименовать дашборд' : 'Новый дашборд'}
          onClose={() => setSaveModal({ open: false, name: '', shared: false })}
        >
          <div className="space-y-4">
            <Field label="Название">
              <input
                autoFocus
                value={saveModal.name}
                onChange={(e) =>
                  setSaveModal((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Мой дашборд"
                className={inputClass}
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveModal.shared}
                onChange={(e) =>
                  setSaveModal((s) => ({ ...s, shared: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 text-sky-600"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Общий для команды
              </span>
            </label>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  setSaveModal({ open: false, name: '', shared: false })
                }
              >
                Отмена
              </Button>
              <Button
                onClick={() => {
                  if (!saveModal.name.trim()) return;
                  if (saveModal.id)
                    void handleRenameSave(
                      saveModal.name,
                      saveModal.shared,
                      saveModal.id,
                    );
                  else void handleCreateNew(saveModal.name, saveModal.shared);
                }}
                disabled={!saveModal.name.trim()}
              >
                <Check size={14} />
                {saveModal.id ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}