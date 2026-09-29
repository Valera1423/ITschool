// frontend/src/pages/InteractionsPage.tsx
import { useState, type FormEvent } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  History,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import type { Interaction, University } from '@/types';
import {
  INTERACTION_TYPES,
  INTERACTION_STATUSES,
  MANAGERS,
} from '@/constants';
import {
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';
import { formatDate, mailto, todayISO } from '@/lib/utils';
import { useUndo, useHistory } from '@/components/UndoProvider';
import { VersionsPanel } from '@/components/VersionsPanel';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';

/**
 * Журнал взаимодействий.
 *
 * - Три фильтра: все / предстоящие / завершённые
 * - Поиск по названию и описанию (передаётся в ?search=)
 * - Отправка письма прямо из карточки
 * - Завершение одним кликом
 * - Undo для удалённых и обновлённых (через /restore)
 * - История версий (entity="interactions")
 */
interface Props {
  universities: University[];
  onNotice: (msg: string) => void;
}

export function InteractionsPage({ universities, onNotice }: Props) {
  const api = useApi();
  const { notifyWithUndo } = useUndo();
  const history = useHistory();

  const [filter, setFilter] = useState<'Все' | 'Запланировано' | 'Завершено'>(
    'Все',
  );
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Interaction | null>(null);
  const [versionsFor, setVersionsFor] = useState<Interaction | null>(null);

  const {
    items: interactions,
    loading,
    reload,
  } = usePagination<Interaction>({
    path: '/interactions',
    filters: {
      status: filter !== 'Все' ? filter : undefined,
      // ВАЖНО: search, а не assignee — иначе пользователь ищет текст,
      // а бэкенд фильтрует по ответственному
      search: search || undefined,
    },
    pageSize: 50,
  });

  const complete = async (id: string) => {
    const old = interactions.find((i) => i.id === id);
    await api.patch(`/interactions/${id}`, { status: 'Завершено' });
    onNotice('Взаимодействие завершено.');
    await reload();

    if (old) {
      history.push({
        label: `«${old.title}» завершено`,
        do: async () => {
          await api.patch(`/interactions/${id}`, { status: 'Завершено' });
          await reload();
        },
        undo: async () => {
          await api.patch(`/interactions/${id}`, { status: old.status });
          await reload();
        },
      });
    }
  };

  const remove = async (item: Interaction) => {
    await api.delete(`/interactions/${item.id}`);
    notifyWithUndo(`«${item.title}» удалено`, async () => {
      await api.post(`/interactions/${item.id}/restore`);
      await reload();
    });
    await reload();
  };

  const save = async (data: Record<string, string>, id?: string) => {
    const payload = {
      universityId: data.university_id,
      type: data.type,
      title: data.title,
      details: data.details || null,
      interactionDate: data.interaction_date,
      status: data.status || 'Запланировано',
      manager: data.manager || MANAGERS[0],
    };

    if (id) {
      const old = interactions.find((i) => i.id === id);
      await api.patch(`/interactions/${id}`, payload);

      if (old) {
        history.push({
          label: `Взаимодействие «${payload.title}» обновлено`,
          do: async () => {
            await api.patch(`/interactions/${id}`, payload);
            await reload();
          },
          undo: async () => {
            await api.patch(`/interactions/${id}`, {
              universityId: old.university_id,
              type: old.type,
              title: old.title,
              details: old.details,
              interactionDate: old.interaction_date,
              status: old.status,
              manager: old.manager,
            });
            await reload();
          },
        });
      }
    } else {
      const res = await api.post<{ id: string }>('/interactions', payload);
      const newId = res?.id;

      history.push({
        label: `Взаимодействие «${payload.title}» создано`,
        do: async () => {
          await api.post('/interactions', payload);
          await reload();
        },
        undo: async () => {
          if (newId) {
            await api.delete(`/interactions/${newId}`);
            await reload();
          }
        },
      });
    }

    setModalOpen(false);
    setEditing(null);
    await reload();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    void save(data, editing?.id);
  };

  const sendEmail = (item: Interaction) => {
    const uni = universities.find((u) => u.id === item.university_id);
    if (!uni?.contact_email) {
      onNotice('У вуза не указан email.');
      return;
    }
    mailto(uni.contact_email, item.title, item.details ?? '');
    onNotice('Письмо открыто.');
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">История и планирование</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Взаимодействия
          </h1>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />
          Запланировать
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
            placeholder="Найти взаимодействие"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['Все', 'Запланировано', 'Завершено'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {f === 'Все'
                ? 'Все'
                : f === 'Запланировано'
                  ? 'Предстоящие'
                  : 'Завершённые'}
            </button>
          ))}
        </div>
      </div>

      {interactions.length === 0 && !loading ? (
        <EmptyState
          text="Нет подходящих взаимодействий"
          hint="Запланируйте первое взаимодействие с вузом"
          actionLabel="Запланировать"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          icon={MessageSquare}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {interactions.map((item) => {
            const Icon =
              item.type === 'Встреча'
                ? Users
                : item.type === 'Документ'
                  ? FileText
                  : item.type === 'Письмо'
                    ? Mail
                    : Phone;
            const uni = universities.find(
              (u) => u.id === item.university_id,
            );
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Icon size={16} />
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                  {item.details ?? '—'}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} />
                    {uni?.name ?? 'Вуз'}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays size={13} />
                    {formatDate(item.interaction_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    {item.type} · {item.manager}
                  </span>
                  <div className="flex items-center gap-1">
                    {item.type === 'Письмо' && item.status !== 'Завершено' && (
                      <button
                        onClick={() => sendEmail(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors"
                        title="Отправить письмо"
                      >
                        <Send size={15} />
                      </button>
                    )}
                    {item.status !== 'Завершено' && (
                      <button
                        onClick={() => void complete(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition-colors"
                        title="Завершить"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(item);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setVersionsFor(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 transition-colors"
                      title="История версий"
                    >
                      <History size={15} />
                    </button>
                    <button
                      onClick={() => void remove(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
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
          title={
            editing ? 'Редактировать взаимодействие' : 'Новое взаимодействие'
          }
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Вуз">
                <select
                  name="university_id"
                  required
                  defaultValue={editing?.university_id ?? universities[0]?.id}
                  className={selectClass}
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Тип">
                <select
                  name="type"
                  defaultValue={editing?.type ?? 'Звонок'}
                  className={selectClass}
                >
                  {INTERACTION_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Название" wide>
                <input
                  name="title"
                  required
                  defaultValue={editing?.title ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Дата">
                <input
                  name="interaction_date"
                  type="date"
                  required
                  defaultValue={
                    editing?.interaction_date?.slice(0, 10) ?? todayISO()
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Статус">
                <select
                  name="status"
                  defaultValue={editing?.status ?? 'Запланировано'}
                  className={selectClass}
                >
                  {INTERACTION_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ответственный">
                <select
                  name="manager"
                  defaultValue={editing?.manager ?? MANAGERS[0]}
                  className={selectClass}
                >
                  {MANAGERS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Комментарий" wide>
                <textarea
                  name="details"
                  defaultValue={editing?.details ?? ''}
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
              <Button type="submit">
                {editing ? 'Сохранить' : 'Запланировать'}
              </Button>
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
            entity="interactions"
            entityId={versionsFor.id}
            onRollback={async (snapshot) => {
              await api.patch(`/interactions/${versionsFor.id}`, snapshot);
              await reload();
            }}
            onNotice={onNotice}
          />
        </SimpleModal>
      )}
    </div>
  );
}