// frontend/src/components/calendar/WeekView.tsx
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { Interaction } from '@/types';
import {
  weekDays,
  toISODate,
  isToday,
  hoursRange,
  timeToMinutes,
  eventColor,
  formatTimeRange,
  WEEKDAYS_SHORT,
} from '@/lib/calendar';

interface Props {
  date: Date;
  events: Interaction[];
  onSelectEvent: (e: Interaction) => void;
  onCreateAt: (d: Date, hour: number) => void;
  onEventMove?: (
    eventId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string,
  ) => Promise<void>;
}

const HOUR_HEIGHT = 56;
const SNAP_MINUTES = 15;

function snap(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

interface DragState {
  eventId: string;
  originalDayKey: string;
  originalStartMin: number;
  originalEndMin: number;
  durationMin: number;
  pointerOffsetY: number;
  offsetMinutes: number;
}

export function WeekView({
  date,
  events,
  onSelectEvent,
  onCreateAt,
  onEventMove,
}: Props) {
  const days = useMemo(() => weekDays(date), [date]);
  const hours = hoursRange(7, 21);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    dayKey: string;
    top: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (9 - 7) * HOUR_HEIGHT - 20;
    }
  }, []);

  const eventsByDay = useMemo(() => {
    const map: Record<string, Interaction[]> = {};
    events.forEach((e) => {
      if (!map[e.interaction_date]) map[e.interaction_date] = [];
      map[e.interaction_date].push(e);
    });
    return map;
  }, [events]);

  const now = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60 - 7) * HOUR_HEIGHT;

  const startDrag = useCallback(
    (e: React.PointerEvent, ev: Interaction) => {
      if (!onEventMove) return;
      if (ev.all_day) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pointerOffsetY = e.clientY - rect.top;
      const startMin = timeToMinutes(ev.start_time);
      const endMin = timeToMinutes(ev.end_time ?? ev.start_time ?? undefined) || startMin + 60;

      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      setDrag({
        eventId: ev.id,
        originalDayKey: ev.interaction_date,
        originalStartMin: startMin,
        originalEndMin: endMin,
        durationMin: endMin - startMin,
        pointerOffsetY,
        offsetMinutes: 0,
      });
    },
    [onEventMove],
  );

  const getDropTarget = useCallback(
    (clientX: number, clientY: number, pointerOffsetY: number) => {
      const grid = gridRef.current;
      if (!grid) return null;

      const rect = grid.getBoundingClientRect();
      const colWidth = (rect.width - 60) / 7;

      const xInGrid = clientX - rect.left - 60;
      if (xInGrid < 0) return null;
      const colIdx = Math.min(6, Math.max(0, Math.floor(xInGrid / colWidth)));

      const yInGrid = clientY - rect.top - pointerOffsetY;
      const rawMinutes = (yInGrid / HOUR_HEIGHT) * 60 + 7 * 60;
      const minutes = Math.max(7 * 60, Math.min(21 * 60, snap(rawMinutes)));

      return { colIdx, minutes };
    },
    [],
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const target = getDropTarget(e.clientX, e.clientY, drag.pointerOffsetY);
      if (!target) {
        setDragPreview(null);
        return;
      }
      const day = days[target.colIdx];
      setDragPreview({
        dayKey: toISODate(day),
        top: (target.minutes / 60 - 7) * HOUR_HEIGHT,
        height: (drag.durationMin / 60) * HOUR_HEIGHT - 2,
      });
    };

    const onUp = async (e: PointerEvent) => {
      const target = getDropTarget(e.clientX, e.clientY, drag.pointerOffsetY);
      setDrag(null);
      setDragPreview(null);

      if (!target || !onEventMove) return;

      const day = days[target.colIdx];
      const newDate = toISODate(day);

      if (
        newDate === drag.originalDayKey &&
        target.minutes === drag.originalStartMin
      ) {
        return;
      }

      const newEnd = target.minutes + drag.durationMin;
      const fmt = (m: number) => {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      await onEventMove(drag.eventId, newDate, fmt(target.minutes), fmt(newEnd));
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [drag, days, getDropTarget, onEventMove]);

  return (
    <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft shadow-atmr-s overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-atmr-border-soft bg-atmr-bg-surface2 sticky top-0 z-atmr-s">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className="text-center py-2.5 border-l border-atmr-border-soft"
            >
              <p className="atmr-desc-s-strong text-atmr-fg-muted uppercase">
                {WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}
              </p>
              <p
                className={`atmr-body-s-strong mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-atmr-full ${
                  today ? 'bg-atmr-accent text-atmr-accent-on' : 'text-atmr-fg'
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
        <div ref={gridRef} className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          <div className="border-r border-atmr-border-soft">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                <span className="absolute -top-2 right-2 atmr-desc-s text-atmr-fg-muted">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const key = toISODate(d);
            const dayEvents = eventsByDay[key] ?? [];
            const today = isToday(d);
            const isDragOver = dragPreview?.dayKey === key;

            return (
              <div
                key={key}
                className="border-l border-atmr-border-soft relative"
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_HEIGHT }}
                    className="border-b border-atmr-border-soft hover:bg-atmr-bg-surface2 cursor-pointer transition-colors duration-atmr-fast"
                    onClick={() => onCreateAt(d, h)}
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

                {isDragOver && dragPreview && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded-atmr-m bg-atmr-accent-soft border-2 border-dashed border-atmr-accent pointer-events-none z-atmr-s"
                    style={{ top: dragPreview.top, height: dragPreview.height }}
                  >
                    <span className="atmr-desc-s text-atmr-accent px-1.5 py-0.5">
                      Перенести сюда
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 pointer-events-none">
                  {dayEvents
                    .filter((e) => !e.all_day && e.start_time)
                    .map((ev) => {
                      const start = timeToMinutes(ev.start_time);
                      const end =
                        timeToMinutes(ev.end_time ?? ev.start_time ?? undefined) ||
                        start + 60;
                      const top = (start / 60 - 7) * HOUR_HEIGHT;
                      const height = Math.max(
                        24,
                        ((end - start) / 60) * HOUR_HEIGHT - 2,
                      );
                      if (top < 0) return null;
                      const c = eventColor(ev.color);
                      const isDragging = drag?.eventId === ev.id;

                      return (
                        <button
                          key={ev.id}
                          onPointerDown={(e) => startDrag(e, ev)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!drag) onSelectEvent(ev);
                          }}
                          style={{ top, height, left: 2, right: 2 }}
                          className={`absolute rounded-atmr-m px-1.5 py-1 text-left pointer-events-auto border overflow-hidden ${c.bg} ${c.border} transition-shadow ${
                            isDragging
                              ? 'opacity-40 cursor-grabbing'
                              : 'hover:shadow-atmr-m cursor-grab'
                          }`}
                          title={
                            onEventMove
                              ? 'Перетащите, чтобы изменить время'
                              : undefined
                          }
                        >
                          <p className={`atmr-desc-s-strong ${c.text}`}>
                            {formatTimeRange(ev.start_time, ev.end_time)}
                          </p>
                          <p className={`atmr-body-s-strong truncate ${c.text}`}>
                            {ev.title}
                          </p>
                        </button>
                      );
                    })}
                </div>

                {dayEvents
                  .filter((e) => e.all_day)
                  .map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      className={`absolute top-0 left-0.5 right-0.5 rounded atmr-desc-s px-1 py-0.5 ${
                        eventColor(ev.color).bg
                      } ${eventColor(ev.color).text} truncate z-atmr-s`}
                    >
                      {ev.title}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}