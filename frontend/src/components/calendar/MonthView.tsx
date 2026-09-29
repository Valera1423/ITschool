import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { Interaction } from '@/types';
import {
  monthMatrix,
  toISODate,
  isToday,
  isWeekend,
  WEEKDAYS_SHORT,
} from '@/lib/calendar';
import { EventCard } from './EventCard';

interface Props {
  date: Date;
  events: Interaction[];
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: Interaction) => void;
  onCreateAt: (d: Date) => void;
}

export function MonthView({
  date,
  events,
  onSelectDay,
  onSelectEvent,
  onCreateAt,
}: Props) {
  const weeks = useMemo(
    () => monthMatrix(date.getFullYear(), date.getMonth()),
    [date],
  );
  const currentMonth = date.getMonth();

  const eventsByDay = useMemo(() => {
    const map: Record<string, Interaction[]> = {};
    events.forEach((e) => {
      const key = e.interaction_date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) =>
        (a.start_time ?? '00:00').localeCompare(b.start_time ?? '00:00'),
      ),
    );
    return map;
  }, [events]);

  return (
    <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft shadow-atmr-s overflow-hidden">
      {/* Заголовки дней недели */}
      <div className="grid grid-cols-7 border-b border-atmr-border-soft bg-atmr-bg-surface2">
        {WEEKDAYS_SHORT.map((w) => (
          <div
            key={w}
            className="text-center py-2.5 atmr-desc-l-strong text-atmr-fg-muted uppercase tracking-wide"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Сетка 6×7 */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {weeks.flat().map((day, i) => {
          const key = toISODate(day);
          const dayEvents = eventsByDay[key] ?? [];
          const outside = day.getMonth() !== currentMonth;
          const weekend = isWeekend(day);
          const today = isToday(day);

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              onDoubleClick={() => onCreateAt(day)}
              className={`group relative min-h-[110px] border-b border-r border-atmr-border-soft p-1.5 transition-colors duration-atmr-fast cursor-pointer
                ${outside ? 'bg-atmr-bg-page' : 'hover:bg-atmr-bg-surface2'}
                ${weekend ? 'bg-atmr-bg-surface2/40' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`atmr-desc-l-strong w-6 h-6 flex items-center justify-center rounded-atmr-full
                    ${today
                      ? 'bg-atmr-accent text-atmr-accent-on'
                      : outside
                        ? 'text-atmr-fg-disabled'
                        : 'text-atmr-fg'}
                  `}
                >
                  {day.getDate()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateAt(day);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-atmr-s text-atmr-fg-muted hover:text-atmr-accent hover:bg-atmr-accent-soft transition-all duration-atmr-fast"
                  title="Добавить событие"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventCard key={ev.id} event={ev} compact onClick={onSelectEvent} />
                ))}
                {dayEvents.length > 3 && (
                  <p className="atmr-desc-s text-atmr-fg-muted text-center">
                    +{dayEvents.length - 3} ещё
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}