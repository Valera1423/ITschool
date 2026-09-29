// frontend/src/pages/KanbanPage.tsx
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Filter,
  GripVertical,
  Pencil,
  Plus,
  Search,
  SortAsc,
  SortDesc,
  Trash2,
  User,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type {
  Task,
  University,
  Workflow,
  WorkflowStep,
} from '@/types';
import { KANBAN_COLUMNS, TASK_PRIORITIES, UNIVERSITY_STATUSES } from '@/constants';
import {
  PriorityBadge,
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
  Avatar,
} from '@/components/ui';
import { formatDate, daysUntil, todayISO, asArray } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';

interface Props {
  tasks: Task[];
  universities: University[];
  workflows: Workflow[];
  workflowSteps: WorkflowStep[];
  managers?: string[];
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

const DEFAULT_MANAGERS = ['Анна Кузнецова', 'Максим Орлов', 'Ольга Миронова'];

type Mode = 'tasks' | 'universities';

type TaskSort =
  | 'due_asc'
  | 'due_desc'
  | 'priority_desc'
  | 'priority_asc'
  | 'title_asc';

type UniSort =
  | 'name_asc'
  | 'name_desc'
  | 'created_desc'
  | 'created_asc'
  | 'touched_desc';

export function KanbanPage({
  tasks,
  universities,
  workflows,
  workflowSteps,
  managers = DEFAULT_MANAGERS,
  onNotice,
  onRefresh,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  // ── Общие
  const [mode, setMode] = useState<Mode>('tasks');
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState('Все');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Задачи
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('Все');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'today' | 'week'>('all');
  const [taskSort, setTaskSort] = useState<TaskSort>('due_asc');

  // ── Вузы
  const [editingUni, setEditingUni] = useState<University | null>(null);
  const [directionFilter, setDirectionFilter] = useState('Все');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [uniSort, setUniSort] = useState<UniSort>('name_asc');

  // ── Локальные optimistic-переопределения шага workflow.
  //    Нужны, потому что при drag&drop мы хотим мгновенно
  //    показать карточку в целевой колонке, не дожидаясь refetch.
  const [stepOverrides, setStepOverrides] = useState<Record<string, string>>({});

  // ── Карточка «просмотр вуза» — открывается по клику на карточку в канбане.
  const [previewUni, setPreviewUni] = useState<University | null>(null);

  // ============================================================
  // ДЕРИВАЦИЯ: default workflow и его шаги
  // ============================================================
  const defaultWorkflow = useMemo(
    () => workflows.find((w) => w.is_default) ?? workflows[0] ?? null,
    [workflows],
  );

  const defaultWorkflowSteps = useMemo(() => {
    if (!defaultWorkflow) return [];
    return asArray<WorkflowStep>(workflowSteps)
      .filter((s) => s.workflow_id === defaultWorkflow.id)
      .sort((a, b) => a.step_order - b.step_order);
  }, [workflowSteps, defaultWorkflow]);

  const directions = useMemo(() => {
    const set = new Set<string>();
    universities.forEach((u) => u.direction && set.add(u.direction));
    return ['Все', ...Array.from(set)];
  }, [universities]);

  const allManagers = useMemo(() => {
    const set = new Set<string>();
    universities.forEach((u) => u.manager && set.add(u.manager));
    tasks.forEach((t) => t.assignee && set.add(t.assignee));
    return ['Все', ...Array.from(set)];
  }, [universities, tasks]);

  // ============================================================
  // ФИЛЬТРЫ + СОРТИРОВКА: ЗАДАЧИ
  // ============================================================
  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) =>
      KANBAN_COLUMNS.includes(t.status as (typeof KANBAN_COLUMNS)[number]),
    );

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description ?? '').toLowerCase().includes(s),
      );
    }
    if (managerFilter !== 'Все') list = list.filter((t) => t.assignee === managerFilter);
    if (priorityFilter !== 'Все') list = list.filter((t) => t.priority === priorityFilter);

    if (dueFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((t) => {
        const d = new Date(t.due_date);
        const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
        if (dueFilter === 'overdue') return diff < 0;
        if (dueFilter === 'today') return diff === 0;
        if (dueFilter === 'week') return diff >= 0 && diff <= 7;
        return true;
      });
    }

    return list.sort((a, b) => {
      switch (taskSort) {
        case 'due_asc':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'due_desc':
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        case 'priority_desc':
          return (
            TASK_PRIORITIES.indexOf(b.priority as (typeof TASK_PRIORITIES)[number]) -
            TASK_PRIORITIES.indexOf(a.priority as (typeof TASK_PRIORITIES)[number])
          );
        case 'priority_asc':
          return (
            TASK_PRIORITIES.indexOf(a.priority as (typeof TASK_PRIORITIES)[number]) -
            TASK_PRIORITIES.indexOf(b.priority as (typeof TASK_PRIORITIES)[number])
          );
        case 'title_asc':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [tasks, search, managerFilter, priorityFilter, dueFilter, taskSort]);

  // ============================================================
  // ФИЛЬТРЫ + СОРТИРОВКА: ВУЗЫ
  // ============================================================
  const filteredUniversities = useMemo(() => {
    let list = [...universities];

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.city.toLowerCase().includes(s),
      );
    }
    if (managerFilter !== 'Все') list = list.filter((u) => u.manager === managerFilter);
    if (directionFilter !== 'Все') list = list.filter((u) => u.direction === directionFilter);
    if (statusFilter !== 'Все') list = list.filter((u) => u.status === statusFilter);

    return list.sort((a, b) => {
      switch (uniSort) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'touched_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });
  }, [universities, search, managerFilter, directionFilter, statusFilter, uniSort]);

  // ============================================================
  // СБРОС OVERRIDE ПРИ НОВОМ FETCH
  // ============================================================
  useEffect(() => {
    setStepOverrides({});
  }, [universities]);

  // ============================================================
  // INVALIDATE
  // ============================================================
  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['universities'] });
  };

  // ============================================================
  // TASK CRUD
  // ============================================================
  const moveTask = async (id: string, status: string) => {
    await api.patch(`/tasks/${id}`, { status });
    onNotice('Задача перемещена.');
    await onRefresh();
    await invalidateAll();
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm('Удалить задачу?')) return;
    await api.delete(`/tasks/${id}`);
    onNotice('Задача удалена.');
    await onRefresh();
    await invalidateAll();
  };

  const saveTask = async (data: Record<string, string>, id?: string) => {
    const payload = {
      universityId: data.university_id || null,
      title: data.title,
      description: data.description || null,
      status: data.status || 'К выполнению',
      priority: data.priority || 'Средний',
      dueDate: data.due_date,
      reminderAt: data.reminder_at ? `${data.reminder_at}T09:00:00` : null,
      assignee: data.assignee || managers[0],
    };
    if (id) await api.patch(`/tasks/${id}`, payload);
    else await api.post('/tasks', payload);
    setModalOpen(false);
    setEditingTask(null);
    await onRefresh();
    await invalidateAll();
  };

  const handleSubmitTask = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    void saveTask(data, editingTask?.id);
  };

  // ============================================================
  // UNIVERSITY — смена шага workflow
  // ============================================================
  const moveUniversity = async (uniId: string, toStepId: string) => {
    if (!defaultWorkflow) {
      onNotice('Нет активного workflow. Создайте его в разделе Workflow.');
      return;
    }

    setStepOverrides((m) => ({ ...m, [uniId]: toStepId }));

    try {
      const targetStep = defaultWorkflowSteps.find((s) => s.id === toStepId);
      await api.post('/workflows/transitions', {
        stepId: toStepId,
        universityId: uniId,
        fromStatus: null,
        toStatus: targetStep?.status_code ?? 'in_progress',
        comment: 'Перетаскивание на канбане',
        attachments: [],
        actorName: 'Канбан',
      });
      onNotice('Шаг обновлён.');
      await onRefresh();
      await invalidateAll();
    } catch (e) {
      setStepOverrides((m) => {
        const { [uniId]: _removed, ...rest } = m;
        return rest;
      });
      onNotice(
        `Ошибка: ${e instanceof Error ? e.message : 'не удалось переместить'}`,
      );
    }
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================
  const onDragStart = (id: string) => setDraggedId(id);
  const onDragOver = (e: DragEvent, col: string) => {
    e.preventDefault();
    setDragOverCol(col);
  };
  const onDropTask = (e: DragEvent, col: string) => {
    e.preventDefault();
    if (draggedId) void moveTask(draggedId, col);
    setDraggedId(null);
    setDragOverCol(null);
  };
  const onDropUniversity = (e: DragEvent, stepId: string) => {
    e.preventDefault();
    if (draggedId) void moveUniversity(draggedId, stepId);
    setDraggedId(null);
    setDragOverCol(null);
  };

  // ============================================================
  // РЕНДЕР
  // ============================================================
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Доска</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Канбан
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Перетаскивайте карточки для смены статуса
            {mode === 'universities' && defaultWorkflow && (
              <> · workflow «{defaultWorkflow.name}»</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => {
                setMode('tasks');
                setDraggedId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <CheckSquare size={14} /> Задачи
            </button>
            <button
              onClick={() => {
                setMode('universities');
                setDraggedId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'universities'
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <WorkflowIcon size={14} /> Вузы
            </button>
          </div>

          {mode === 'tasks' && (
            <Button
              onClick={() => {
                setEditingTask(null);
                setModalOpen(true);
              }}
            >
              <Plus size={18} /> Новая задача
            </Button>
          )}
        </div>
      </section>

      {/* ФИЛЬТРЫ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className={`${inputClass} pl-9`}
          />
        </div>

        <Field label="Ответственный">
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className={`${selectClass} min-w-[150px]`}
          >
            {allManagers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>

        {mode === 'tasks' && (
          <>
            <Field label="Приоритет">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={`${selectClass} min-w-[120px]`}
              >
                <option>Все</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="Срок">
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}
                className={`${selectClass} min-w-[130px]`}
              >
                <option value="all">Все</option>
                <option value="overdue">Просрочены</option>
                <option value="today">Сегодня</option>
                <option value="week">7 дней</option>
              </select>
            </Field>

            <Field label="Сортировка">
              <div className="flex items-center gap-1">
                <select
                  value={taskSort}
                  onChange={(e) => setTaskSort(e.target.value as TaskSort)}
                  className={`${selectClass} min-w-[150px]`}
                >
                  <option value="due_asc">Срок ↑</option>
                  <option value="due_desc">Срок ↓</option>
                  <option value="priority_desc">Приоритет ↓</option>
                  <option value="priority_asc">Приоритет ↑</option>
                  <option value="title_asc">А-Я</option>
                </select>
                {taskSort.endsWith('asc') ? (
                  <SortAsc size={16} className="text-slate-400" />
                ) : (
                  <SortDesc size={16} className="text-slate-400" />
                )}
              </div>
            </Field>
          </>
        )}

        {mode === 'universities' && (
          <>
            <Field label="Направление">
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className={`${selectClass} min-w-[150px]`}
              >
                {directions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>

            <Field label="Статус">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${selectClass} min-w-[140px]`}
              >
                <option>Все</option>
                {UNIVERSITY_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Сортировка">
              <select
                value={uniSort}
                onChange={(e) => setUniSort(e.target.value as UniSort)}
                className={`${selectClass} min-w-[170px]`}
              >
                <option value="name_asc">Название А-Я</option>
                <option value="name_desc">Название Я-А</option>
                <option value="created_desc">Создано ↓</option>
                <option value="created_asc">Создано ↑</option>
                <option value="touched_desc">Активность ↓</option>
              </select>
            </Field>
          </>
        )}

        <button
          onClick={() => {
            setSearch('');
            setManagerFilter('Все');
            setPriorityFilter('Все');
            setDueFilter('all');
            setDirectionFilter('Все');
            setStatusFilter('Все');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Filter size={13} /> Сбросить
        </button>
      </div>

      {/* КАНБАН */}
      {mode === 'tasks' ? (
        <TaskKanban
          tasks={filteredTasks}
          universities={universities}
          onEdit={(t) => {
            setEditingTask(t);
            setModalOpen(true);
          }}
          onDelete={deleteTask}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDropTask}
          dragOverCol={dragOverCol}
        />
      ) : !defaultWorkflow ? (
        <EmptyState
          text="Нет активного workflow"
          hint="Создайте workflow и отметьте его как основной"
          icon={WorkflowIcon}
        />
      ) : defaultWorkflowSteps.length === 0 ? (
        <EmptyState
          text="В workflow нет шагов"
          hint="Добавьте шаги в разделе Workflow"
          icon={WorkflowIcon}
        />
      ) : (
        <UniversityKanban
          universities={filteredUniversities}
          steps={defaultWorkflowSteps}
          stepOverrides={stepOverrides}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDropUniversity}
          dragOverCol={dragOverCol}
          onOpen={(u) => setPreviewUni(u)}
        />
      )}

      {/* МОДАЛКА ЗАДАЧИ */}
      {modalOpen && mode === 'tasks' && (
        <SimpleModal
          title={editingTask ? 'Редактировать задачу' : 'Новая задача'}
          onClose={() => {
            setModalOpen(false);
            setEditingTask(null);
          }}
        >
          <form onSubmit={handleSubmitTask} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Название" wide>
                <input
                  name="title"
                  required
                  defaultValue={editingTask?.title ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Статус">
                <select
                  name="status"
                  defaultValue={editingTask?.status ?? 'К выполнению'}
                  className={selectClass}
                >
                  {KANBAN_COLUMNS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Приоритет">
                <select
                  name="priority"
                  defaultValue={editingTask?.priority ?? 'Средний'}
                  className={selectClass}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Срок">
                <input
                  name="due_date"
                  type="date"
                  required
                  defaultValue={editingTask?.due_date?.slice(0, 10) ?? todayISO()}
                  className={inputClass}
                />
              </Field>
              <Field label="Напоминание (дата)">
                <input
                  name="reminder_at"
                  type="date"
                  defaultValue={editingTask?.reminder_at?.slice(0, 10) ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Вуз (необязательно)">
                <select
                  name="university_id"
                  defaultValue={editingTask?.university_id ?? ''}
                  className={selectClass}
                >
                  <option value="">Без привязки к вузу</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ответственный">
                <select
                  name="assignee"
                  defaultValue={editingTask?.assignee ?? managers[0]}
                  className={selectClass}
                >
                  {managers.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Описание" wide>
                <textarea
                  name="description"
                  defaultValue={editingTask?.description ?? ''}
                  className={textareaClass}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setEditingTask(null);
                }}
              >
                Отмена
              </Button>
              <Button type="submit">
                {editingTask ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* МОДАЛКА ПРОСМОТРА ВУЗА (из канбана) */}
      {previewUni && (
        <SimpleModal
          title={previewUni.name}
          onClose={() => setPreviewUni(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Город" value={previewUni.city} />
              <InfoRow label="Направление" value={previewUni.direction} />
              <InfoRow label="Продукт" value={previewUni.product} />
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-1">Статус</p>
                <StatusBadge status={previewUni.status} />
              </div>
              <InfoRow label="Ответственный" value={previewUni.manager} />
              <InfoRow
                label="Лицензия"
                value={previewUni.license_signed ? 'Подписана' : 'Нет'}
              />
              <InfoRow
                label="Договор"
                value={previewUni.contract_number ?? '—'}
              />
              <InfoRow label="Создан" value={formatDate(previewUni.created_at)} />
              <InfoRow
                label="Обновлён"
                value={formatDate(previewUni.updated_at)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => setPreviewUni(null)}
              >
                Закрыть
              </Button>
              <Button
                onClick={() => {
                  const id = previewUni.id;
                  setPreviewUni(null);
                  window.dispatchEvent(
                    new CustomEvent('crm:open-university', {
                      detail: { id },
                    }),
                  );
                }}
              >
                Открыть карточку
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

// ============================================================
// TASK KANBAN
// ============================================================
function TaskKanban({
  tasks,
  universities,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverCol,
}: {
  tasks: Task[];
  universities: University[];
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: DragEvent, col: string) => void;
  onDrop: (e: DragEvent, col: string) => void;
  dragOverCol: string | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => onDragOver(e, col)}
            onDrop={(e) => onDrop(e, col)}
            className={`rounded-2xl p-4 border-2 transition-colors min-h-[400px] ${
              dragOverCol === col
                ? 'border-sky-400 bg-sky-50/50 dark:bg-sky-900/20'
                : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">
                {col}
              </h3>
              <span className="text-xs font-medium text-slate-400 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg">
                {colTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {colTasks.map((task) => {
                const uni = universities.find((u) => u.id === task.university_id);
                const d = daysUntil(task.due_date);
                const overdue = d !== null && d < 0;
                const dueSoon = d !== null && d >= 0 && d <= 1;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task.id)}
                    className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <GripVertical size={14} className="text-slate-300" />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(task)}
                          className="p-1 rounded text-slate-400 hover:text-sky-600"
                          aria-label="Редактировать"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(task.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                          aria-label="Удалить"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <PriorityBadge priority={task.priority} />
                      {uni && (
                        <span className="text-xs text-slate-400 truncate">
                          {uni.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        <span
                          className={
                            overdue
                              ? 'text-rose-500'
                              : dueSoon
                                ? 'text-amber-500'
                                : ''
                          }
                        >
                          {formatDate(task.due_date)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {task.assignee.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-300 dark:text-slate-600">
                  Перетащите карточки сюда
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// UNIVERSITY KANBAN (по шагам workflow)
// ============================================================
function UniversityKanban({
  universities,
  steps,
  stepOverrides,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverCol,
  onOpen,
}: {
  universities: University[];
  steps: WorkflowStep[];
  stepOverrides: Record<string, string>;
  onDragStart: (id: string) => void;
  onDragOver: (e: DragEvent, col: string) => void;
  onDrop: (e: DragEvent, col: string) => void;
  dragOverCol: string | null;
  onOpen: (u: University) => void;
}) {
  const mapUniToStep = (u: University): string | null => {
    if (stepOverrides[u.id]) return stepOverrides[u.id];
    if (u.current_step_id) return u.current_step_id;
    const matched = steps.find(
      (s) => s.title.toLowerCase().trim() === u.status.toLowerCase().trim(),
    );
    return matched?.id ?? steps[0]?.id ?? null;
  };

  return (
    <div
      className="overflow-x-auto pb-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex gap-4" style={{ minWidth: steps.length * 300 }}>
        {steps.map((step, idx) => {
          const colUnis = universities.filter((u) => mapUniToStep(u) === step.id);
          return (
            <div
              key={step.id}
              onDragOver={(e) => onDragOver(e, step.id)}
              onDrop={(e) => onDrop(e, step.id)}
              className={`rounded-2xl p-4 border-2 transition-colors min-h-[400px] w-[280px] flex-shrink-0 ${
                dragOverCol === step.id
                  ? 'border-sky-400 bg-sky-50/50 dark:bg-sky-900/20'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <h3 className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">
                    {step.title}
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-400 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg flex-shrink-0">
                  {colUnis.length}
                </span>
              </div>

              <div className="space-y-3">
                {colUnis.map((u) => (
                  <div
                    key={u.id}
                    draggable
                    onDragStart={() => onDragStart(u.id)}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      onOpen(u);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(u);
                      }
                    }}
                    className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer active:cursor-grabbing hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800 transition-all"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Building2
                        size={14}
                        className="text-sky-500 flex-shrink-0 mt-0.5"
                      />
                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
                        {u.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      {u.city} · {u.direction}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={u.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800">
                      <Avatar name={u.manager} size="sm" />
                      <span className="truncate">{u.manager}</span>
                    </div>
                  </div>
                ))}

                {colUnis.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-300 dark:text-slate-600">
                    Перетащите вузы сюда
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ХЕЛПЕРЫ
// ============================================================
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-slate-700 dark:text-slate-200">{value || '—'}</p>
    </div>
  );
}