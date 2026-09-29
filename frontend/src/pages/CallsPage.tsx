import { useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Building2,
  User,
  Trash2,
} from 'lucide-react';
import type { CallLog, University } from '@/types';
import { EmptyState, selectClass, inputClass } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { MessengerLinks } from '@/components/MessengerLinks';
import { useApi } from '@/hooks/useApi';

/**
 * Журнал звонков.
 *
 * Данные поступают из виртуальной АТС через webhook.
 * Направление, длительность, менеджер, ссылка на запись.
 * Из карточки можно сразу связаться с контактом.
 */
interface Props {
  calls: CallLog[];
  universities: University[];
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0 сек';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

export function CallsPage({
  calls,
  universities,
  onNotice,
  onRefresh,
}: Props) {
  const api = useApi();
  const [filter, setFilter] = useState<'Все' | 'Входящий' | 'Исходящий'>('Все');
  const [search, setSearch] = useState('');

  const filtered = calls.filter(
    (c) =>
      (filter === 'Все' || c.direction === filter) &&
      `${c.contact_phone} ${c.contact_name ?? ''} ${c.manager} ${c.notes ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const deleteCall = async (id: string) => {
    if (!window.confirm('Удалить запись о звонке?')) return;
    await api.delete(`/calls/${id}`);
    onNotice('Запись удалена.');
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Журнал звонков</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Звонки
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          История звонков из виртуальной АТС, привязанная к карточкам вузов.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по номеру, имени или менеджеру"
          className={`${inputClass} flex-1`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className={`${selectClass} sm:w-52`}
        >
          <option>Все</option>
          <option>Входящий</option>
          <option>Исходящий</option>
        </select>
        <span className="text-sm text-slate-400 self-center whitespace-nowrap">
          {filtered.length} из {calls.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Звонков не найдено" icon={Phone} />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const uni = universities.find((u) => u.id === c.university_id);
            const Icon =
              c.direction === 'Входящий' ? PhoneIncoming : PhoneOutgoing;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    c.direction === 'Входящий'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {c.contact_phone}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        c.direction === 'Входящий'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}
                    >
                      {c.direction}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDuration(c.duration_seconds)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                    {c.contact_name && (
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {c.contact_name}
                      </span>
                    )}
                    {uni && (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} />
                        {uni.name}
                      </span>
                    )}
                    <span>{c.manager}</span>
                    <span>{formatDateTime(c.started_at)}</span>
                  </div>

                  {c.notes && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      {c.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {uni && (
                    <MessengerLinks university={uni} compact onNotice={onNotice} />
                  )}
                  {c.recording_url && (
                    <a
                      href={c.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600"
                      title="Прослушать запись"
                    >
                      <Play size={15} />
                    </a>
                  )}
                  <button
                    onClick={() => void deleteCall(c.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}