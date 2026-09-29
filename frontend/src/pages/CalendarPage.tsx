import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Search,
  Clock,
  Video,
  Users,
} from 'lucide-react';
import type { Interaction, University } from '@/types';
import {
  Button,
  inputClass,
  selectClass,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import {
  shift,
  formatMonthYear,
  formatDayLong,
  formatWeekRange,
  startOfWeek,
  endOfWeek,
  toISODate,
  colorByType,
  formatTimeRange,
  eventColor,
  type CalendarView,
} from '@/lib/calendar';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { EventModal } from '@/components/calendar/EventModal';
import { useApi } from '@/hooks/useApi';

interface Props {
  interactions: Interaction[];
  universities: University[];
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

type DraftEvent = Partial<Interaction> & { interaction_date: string };

export function CalendarPage({
  interactions,
  universities,
  onNotice,
  onRefresh,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [view, setView] = useState<CalendarView>('month');
  const [date, setDate] = useState(new Date());
  const [managerFilter, setManagerFilter] = useState('Все');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState<DraftEvent | null>(null);
  const [isNew, setIsNew] = useState(true);

  const managers = useMemo(() => {
    const set = new Set(interactions.map((i) => i.manager).filter(Boolean));
    return ['Все', ...Array.from(set)];
  }, [interactions]);

  /**
   * ВАЖНО: нормализуем interaction_date до "YYYY-MM-DD".
   *
   * Бэкенд возвращает ISO-строку ("2026-02-05T00:00:00.000Z") или
   * Date-объект, обёрнутый в строку. Views (MonthView/WeekView/DayView)
   * группируют события по ключу `event.interaction_date` и сравнивают
   * его с `toISODate(day)` — "2026-02-05". Без нормализации ключи
   * не совпадают, и календарь пуст.
   */
  const filtered = useMemo(() => {
    return interactions
      .map((e) => ({
        ...e,
        interaction_date: String(e.interaction_date).slice(0, 10),
      }))
      .filter((e) => {
        if (managerFilter !== 'Все' && e.manager !== managerFilter) return false;
        if (
          search &&
          !`${e.title} ${e.details ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      });
  }, [interactions, managerFilter, search]);

  const headerLabel = useMemo(() => {
    if (view === 'month') return formatMonthYear(date);
    if (view === 'week')
      return formatWeekRange(startOfWeek(date), endOfWeek(date));
    return formatDayLong(date);
  }, [view, date]);

  const goPrev = () => setDate((d) => shift(d, view, -1));
  const goNext = () => setDate((d) => shift(d, view, 1));
  const goToday = () => setDate(new Date());

  /**
   * Инвалидируем реактивные запросы после мутаций — это синхронизирует
   * календарь, Dashboard, страницу «Взаимодействия» и виджеты.
   */
  const invalidateInteractions = async () => {
    await queryClient.invalidateQueries({ queryKey: ['interactions'] });
    await queryClient.invalidateQueries({ queryKey: ['calls', 'list'] });
    await queryClient.invalidateQueries({ queryKey: ['universities'] });
  };

  const openNew = (d: Date, hour?: number) => {
    setModalEvent({
      interaction_date: toISODate(d),
      start_time:
        hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '10:00',
      end_time:
        hour !== undefined ? `${String(hour + 1).padStart(2, '0')}:00` : '11:00',
      color: colorByType('Встреча'),
      type: 'Встреча',
      attendees: [],
    });
    setIsNew(true);
    setModalOpen(true);
  };

  const openEdit = (ev: Interaction) => {
    setModalEvent(ev);
    setIsNew(false);
    setModalOpen(true);
  };

  const handleSave = async (payload: Partial<Interaction>) => {
    if (isNew) {
      await api.post('/interactions', {
        ...payload,
        color: payload.color ?? colorByType(payload.type ?? 'Встреча'),
      });
      onNotice('Событие создано.');
    } else if (modalEvent?.id) {
      await api.patch(`/interactions/${modalEvent.id}`, payload);
      onNotice('Событие обновлено.');
    }
    await onRefresh();
    await invalidateInteractions();
    setModalOpen(false);
    setModalEvent(null);
  };

  const handleDelete = async () => {
    if (!modalEvent?.id) return;
    await api.delete(`/interactions/${modalEvent.id}`);
    onNotice('Событие удалено.');
    await onRefresh();
    await invalidateInteractions();
    setModalOpen(false);
    setModalEvent(null);
  };

  const todayKey = toISODate(new Date());
  const todayEvents = filtered
    .filter((e) => e.interaction_date === todayKey)
    .sort((a, b) =>
      (a.start_time ?? '00:00').localeCompare(b.start_time ?? '00:00'),
    );

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Планирование</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Календарь
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Встречи, звонки, письма и дедлайны по всем вузам.
          </p>
        </div>
        <Button onClick={() => openNew(date)}>
          <Plus size={18} />
          Новое событие
        </Button>
      </section>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Предыдущий период"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Сегодня
          </button>
          <button
            onClick={goNext}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Следующий период"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 lg:min-w-[220px] capitalize">
          {headerLabel}
        </h2>

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className={`${inputClass} pl-9 lg:w-56`}
          />
        </div>

        <div className="relative">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className={`${selectClass} pl-9 lg:w-48`}
          >
            {managers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-6">
        <div>
          {view === 'month' && (
            <MonthView
              date={date}
              events={filtered}
              onSelectDay={(d) => {
                setDate(d);
                setView('day');
              }}
              onSelectEvent={openEdit}
              onCreateAt={openNew}
            />
          )}
          {view === 'week' && (
            <WeekView
              date={date}
              events={filtered}
              onSelectEvent={openEdit}
              onCreateAt={(d, h) => openNew(d, h)}
              onEventMove={async (eventId, newDate, newStart, newEnd) => {
                try {
                  await api.patch(`/interactions/${eventId}`, {
                    interaction_date: newDate,
                    start_time: newStart,
                    end_time: newEnd,
                  });
                  onNotice(`Перенесено на ${newDate} ${newStart}`);
                  await onRefresh();
                  await invalidateInteractions();
                } catch (e) {
                  onNotice(
                    `Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`,
                  );
                }
              }}
            />
          )}
          {view === 'day' && (
            <DayView
              date={date}
              events={filtered}
              onSelectEvent={openEdit}
              onCreateAt={(d, h) => openNew(d, h)}
            />
          )}
        </div>

        <aside className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 h-fit xl:sticky xl:top-24">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center">
              <CalendarIcon size={17} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                Сегодня
              </p>
              <p className="text-xs text-slate-400 capitalize">
                {new Intl.DateTimeFormat('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                }).format(new Date())}
              </p>
            </div>
          </div>

          {todayEvents.length === 0 ? (
            <EmptyState
              text="Нет событий"
              hint="Наслаждайтесь свободным днём"
            />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {todayEvents.map((ev) => {
                const c = eventColor(ev.color);
                return (
                  <button
                    key={ev.id}
                    onClick={() => openEdit(ev)}
                    className={`w-full text-left rounded-xl p-3 border ${c.bg} ${c.border} hover:shadow-sm transition-shadow`}
                  >
                    <p
                      className={`text-xs font-medium flex items-center gap-1 ${c.text}`}
                    >
                      <Clock size={11} />
                      {ev.all_day
                        ? 'Весь день'
                        : formatTimeRange(ev.start_time, ev.end_time) || '—'}
                    </p>
                    <p
                      className={`text-sm font-medium mt-0.5 line-clamp-2 ${c.text}`}
                    >
                      {ev.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] opacity-70">
                      {ev.meeting_url && (
                        <span className="flex items-center gap-0.5">
                          <Video size={10} />
                          Zoom
                        </span>
                      )}
                      {ev.attendees.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Users size={10} />
                          {ev.attendees.length}
                        </span>
                      )}
                      <StatusBadge status={ev.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {modalOpen && modalEvent && (
        <EventModal
          event={modalEvent}
          isNew={isNew}
          universities={universities}
          onClose={() => {
            setModalOpen(false);
            setModalEvent(null);
          }}
          onSave={handleSave}
          onDelete={!isNew ? handleDelete : undefined}
          onNotice={onNotice}
        />
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Типы событий
        </p>
        <div className="flex flex-wrap gap-4">
          {[
            { type: 'Встреча', color: 'sky' },
            { type: 'Звонок', color: 'emerald' },
            { type: 'Письмо', color: 'amber' },
            { type: 'Документ', color: 'violet' },
          ].map(({ type, color }) => (
            <div
              key={type}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <span className={`w-3 h-3 rounded-full ${eventColor(color).dot}`} />
              {type}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}