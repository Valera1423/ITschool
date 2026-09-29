// frontend/src/pages/TasksPage.tsx
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import type { Task, University } from '@/types';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/constants';
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
} from '@/components/ui';
import { formatDate, daysUntil, formatDateTime, todayISO } from '@/lib/utils';
import { useUndo, useHistory } from '@/components/UndoProvider';
import { VersionsPanel } from '@/components/VersionsPanel';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';

interface Props {
  universities: University[];
  managers: string[];
  onNotice: (msg: string) => void;
}

export function TasksPage({ universities, managers, onNotice }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { notifyWithUndo } = useUndo();
  const history = useHistory();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [priorityFilter, setPriorityFilter] = useState('Все');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [versionsFor, setVersionsFor] = useState<Task | null>(null);

  const {
    items: tasks,
    loading,
    reload,
  } = usePagination<Task>({
    path: '/tasks',
    filters: {
      status: statusFilter !== 'Все' ? statusFilter : undefined,
      priority: priorityFilter !== 'Все' ? priorityFilter : undefined,
      search: search || undefined,
    },
    pageSize: 100,
  });

  const sorted = [...tasks].sort((a, b) => {
    const prioDiff =
      TASK_PRIORITIES.indexOf(b.priority as (typeof TASK_PRIORITIES)[number]) -
      TASK_PRIORITIES.indexOf(a.priority as (typeof TASK_PRIORITIES)[number]);
    if (prioDiff !== 0) return prioDiff;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  /**
   * Инвалидируем ВСЕ кэши с ключом ['tasks', ...].
   * Это синхронизирует Shell (который держит свой список для Kanban/Dashboard)
   * с локальным списком этой страницы.
   */
  const invalidateAllTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const remove = async (task: Task) => {
    await api.delete(`/tasks/${task.id}`);
    notifyWithUndo(`«${task.title}» удалена`, async () => {
      await api.patch(`/tasks/${task.id}`, { deleted_at: null });
      await reload();
      await invalidateAllTasks();
    });
    await reload();
    await invalidateAllTasks();
  };

  const complete = async (id: string) => {
    const old = tasks.find((t) => t.id === id);
    await api.patch(`/tasks/${id}`, { status: 'Готово' });
    onNotice('Задача завершена.');
    await reload();
    await invalidateAllTasks();

    if (old) {
      history.push({
        label: `Задача «${old.title}» завершена`,
        do: async () => {
          await api.patch(`/tasks/${id}`, { status: 'Готово' });
          await reload();
          await invalidateAllTasks();
        },
        undo: async () => {
          await api.patch(`/tasks/${id}`, { status: old.status });
          await reload();
          await invalidateAllTasks();
        },
      });
    }
  };

  const save = async (data: Record<string, string>, id?: string) => {
    const payload = {
      universityId: data.university_id || null,
      title: data.title,
      description: data.description || null,
      status: data.status || 'К выполнению',
      priority: data.priority || 'Средний',
      dueDate: data.due_date,
      reminderAt: data.reminder_at ? `${data.reminder_at}T09:00:00` : null,
      assignee: data.assignee || managers[0] || 'Анна Кузнецова',
    };

    if (id) {
      const old = tasks.find((t) => t.id === id);
      await api.patch(`/tasks/${id}`, payload);

      if (old) {
        history.push({
          label: `Задача «${payload.title}» обновлена`,
          do: async () => {
            await api.patch(`/tasks/${id}`, payload);
            await reload();
            await invalidateAllTasks();
          },
          undo: async () => {
            await api.patch(`/tasks/${id}`, {
              universityId: old.university_id,
              title: old.title,
              description: old.description,
              status: old.status,
              priority: old.priority,
              dueDate: old.due_date,
              reminderAt: old.reminder_at,
              assignee: old.assignee,
            });
            await reload();
            await invalidateAllTasks();
          },
        });
      }
    } else {
      const res = await api.post<{ id: string }>('/tasks', payload);
      const newId = res?.id;

      history.push({
        label: `Задача «${payload.title}» создана`,
        do: async () => {
          await api.post('/tasks', payload);
          await reload();
          await invalidateAllTasks();
        },
        undo: async () => {
          if (newId) {
            await api.delete(`/tasks/${newId}`);
            await reload();
            await invalidateAllTasks();
          }
        },
      });
    }

    setModalOpen(false);
    setEditing(null);
    await reload();
    await invalidateAllTasks();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    void save(data, editing?.id);
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Задачи и напоминания</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Задачи
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Приоритеты, сроки и напоминания.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Новая задача
        </Button>
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
            placeholder="Поиск задач"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${selectClass} sm:w-44`}
        >
          <option>Все</option>
          {TASK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={`${selectClass} sm:w-44`}
        >
          <option>Все</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {sorted.length === 0 && !loading ? (
        <EmptyState
          text="Нет задач по фильтрам"
          hint="Создайте новую задачу, чтобы начать"
          actionLabel="Создать задачу"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          icon={CheckCircle2}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((task) => {
            const uni = universities.find((u) => u.id === task.university_id);
            const d = daysUntil(task.due_date);
            const notDone =
              task.status !== 'Готово' && task.status !== 'Отменено';
            const overdue = d !== null && d < 0 && notDone;
            const dueSoon = d !== null && d >= 0 && d <= 2 && notDone;

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      overdue
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                        : dueSoon
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {task.status === 'Готово' ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Bell size={18} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3
                        className={`font-medium ${
                          task.status === 'Готово'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={13} />
                        <span
                          className={
                            overdue
                              ? 'text-rose-500 font-medium'
                              : dueSoon
                                ? 'text-amber-600 font-medium'
                                : ''
                          }
                        >
                          {formatDate(task.due_date)}
                          {overdue && d !== null
                            ? ` (просрочено на ${Math.abs(d)} дн.)`
                            : d === 0 && notDone
                              ? ' (сегодня)'
                              : ''}
                        </span>
                      </span>
                      {task.reminder_at && (
                        <span className="flex items-center gap-1 text-sky-500">
                          <Bell size={13} />
                          {formatDateTime(task.reminder_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User size={13} />
                        {task.assignee}
                      </span>
                      {uni && <span>· {uni.name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {notDone && (
                      <button
                        onClick={() => void complete(task.id)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600"
                        title="Завершить"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(task);
                        setModalOpen(true);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                      title="Редактировать"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setVersionsFor(task)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600"
                      title="История версий"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => void remove(task)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать задачу' : 'Новая задача'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Название" wide>
                <input
                  name="title"
                  required
                  defaultValue={editing?.title ?? ''}
                  placeholder="Что нужно сделать?"
                  className={inputClass}
                />
              </Field>
              <Field label="Статус">
                <select
                  name="status"
                  defaultValue={editing?.status ?? 'К выполнению'}
                  className={selectClass}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Приоритет">
                <select
                  name="priority"
                  defaultValue={editing?.priority ?? 'Средний'}
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
                  defaultValue={editing?.due_date?.slice(0, 10) ?? todayISO()}
                  className={inputClass}
                />
              </Field>
              <Field label="Напоминание (дата)">
                <input
                  name="reminder_at"
                  type="date"
                  defaultValue={editing?.reminder_at?.slice(0, 10) ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Вуз (необязательно)">
                <select
                  name="university_id"
                  defaultValue={editing?.university_id ?? ''}
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
                  defaultValue={
                    editing?.assignee ?? managers[0] ?? 'Анна Кузнецова'
                  }
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
                  defaultValue={editing?.description ?? ''}
                  className={textareaClass}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setEditing(null);
                }}
              >
                Отмена
              </Button>
              <Button type="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {versionsFor && (
        <SimpleModal
          title={`История: ${versionsFor.title}`}
          onClose={() => setVersionsFor(null)}
          wide
        >
          <VersionsPanel
            entity="tasks"
            entityId={versionsFor.id}
            onRollback={async (snapshot) => {
              await api.patch(`/tasks/${versionsFor.id}`, snapshot);
              await reload();
              await invalidateAllTasks();
            }}
            onNotice={onNotice}
          />
        </SimpleModal>
      )}
    </div>
  );
}