import { useMemo, useRef, useEffect } from 'react';
import type { Interaction } from '@/types';
import {
  toISODate,
  hoursRange,
  timeToMinutes,
  eventColor,
  formatTimeRange,
  isToday,
  formatDayLong,
} from '@/lib/calendar';

interface Props {
  date: Date;
  events: Interaction[];
  onSelectEvent: (e: Interaction) => void;
  onCreateAt: (d: Date, hour: number) => void;
}

const HOUR_HEIGHT = 64;

export function DayView({ date, events, onSelectEvent, onCreateAt }: Props) {
  const hours = hoursRange(7, 21);
  const scrollRef = useRef<HTMLDivElement>(null);
  const key = toISODate(date);

  const dayEvents = useMemo(
    () => events.filter((e) => e.interaction_date === key),
    [events, key],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (9 - 7) * HOUR_HEIGHT - 40;
    }
  }, [key]);

  const now = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60 - 7) * HOUR_HEIGHT;
  const today = isToday(date);

  return (
    <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft shadow-atmr-s overflow-hidden">
      <div className="px-5 py-3 border-b border-atmr-border-soft bg-atmr-bg-surface2 flex items-center justify-between">
        <h3 className="atmr-body-s-strong text-atmr-fg capitalize">
          {formatDayLong(date)}
        </h3>
        <span className="atmr-desc-l text-atmr-fg-muted">
          {dayEvents.length}{' '}
          {dayEvents.length === 1
            ? 'событие'
            : dayEvents.length < 5
              ? 'события'
              : 'событий'}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto">
        <div className="grid grid-cols-[70px_1fr]">
          <div className="border-r border-atmr-border-soft">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                <span className="absolute -top-2 right-3 atmr-desc-l text-atmr-fg-muted">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-atmr-border-soft hover:bg-atmr-bg-surface2 cursor-pointer transition-colors duration-atmr-fast"
                onClick={() => onCreateAt(date, h)}
              />
            ))}

            {today && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-atmr-m"
                style={{ top: nowTop }}
              >
                <div className="relative">
                  <div className="absolute -left-1 -top-1 w-2 h-2 rounded-atmr-full bg-atmr-error" />
                  <div className="h-px bg-atmr-error w-full" />
                </div>
              </div>
            )}

            <div className="absolute inset-0 pointer-events-none pr-2">
              {dayEvents
                .filter((e) => !e.all_day && e.start_time)
                .map((ev) => {
                  const start = timeToMinutes(ev.start_time);
                  const end =
                    timeToMinutes(ev.end_time ?? ev.start_time ?? undefined) ||
                    start + 60;
                  const top = (start / 60 - 7) * HOUR_HEIGHT;
                  const height = Math.max(
                    30,
                    ((end - start) / 60) * HOUR_HEIGHT - 2,
                  );
                  if (top < 0) return null;
                  const c = eventColor(ev.color);

                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      style={{ top, height, left: 8, right: 8 }}
                      className={`absolute rounded-atmr-l px-3 py-2 text-left pointer-events-auto border ${c.bg} ${c.border} hover:shadow-atmr-m transition-shadow`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`atmr-desc-l-strong ${c.text}`}>
                            {formatTimeRange(ev.start_time, ev.end_time)}
                          </p>
                          <p className={`atmr-body-s-strong mt-0.5 truncate ${c.text}`}>
                            {ev.title}
                          </p>
                          {ev.location && (
                            <p className={`atmr-desc-l mt-1 opacity-70 truncate ${c.text}`}>
                              {ev.location}
                            </p>
                          )}
                        </div>
                        <span className={`w-2 h-2 rounded-atmr-full ${c.dot} mt-1`} />
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}