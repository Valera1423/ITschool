import { useMemo, useRef, useState } from 'react';
import {
  addDays, differenceInDays, format, startOfDay,
  startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { GanttTask, GanttDependency } from '@/lib/gantt';
import { StatusBadge, PriorityBadge, Avatar } from '@/components/ui';

interface Props {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  onTaskMove?: (taskId: string, newStart: Date, newEnd: Date) => void;
  onTaskClick?: (task: GanttTask) => void;
}

const DAY_WIDTH = 40;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;

const STATUS_COLORS: Record<string, string> = {
  'К выполнению': 'bg-slate-400',
  'В работе': 'bg-sky-500',
  'Готово': 'bg-emerald-500',
  'Отменено': 'bg-rose-400',
};

export function GanttChart({ tasks, dependencies, onTaskMove, onTaskClick }: Props) {
  const [dragging, setDragging] = useState<{
    taskId: string;
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);
  const [hoverTask, setHoverTask] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Определяем диапазон дат
  const { dates, minDate, maxDate } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const start = startOfWeek(addDays(now, -7), { weekStartsOn: 1 });
      const end = endOfWeek(addDays(now, 30), { weekStartsOn: 1 });
      return {
        dates: eachDayOfInterval({ start, end }),
        minDate: start,
        maxDate: end,
      };
    }

    const allDates = tasks.flatMap((t) => [new Date(t.startDate), new Date(t.endDate)]);
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));

    const start = startOfWeek(addDays(min, -3), { weekStartsOn: 1 });
    const end = endOfWeek(addDays(max, 7), { weekStartsOn: 1 });

    return {
      dates: eachDayOfInterval({ start, end }),
      minDate: start,
      maxDate: end,
    };
  }, [tasks]);

  // Позиция задачи
  const getBarPosition = (task: GanttTask) => {
    const start = startOfDay(new Date(task.startDate));
    const end = startOfDay(new Date(task.endDate));
    const left = differenceInDays(start, minDate) * DAY_WIDTH;
    const width = Math.max(DAY_WIDTH, (differenceInDays(end, start) + 1) * DAY_WIDTH);
    return { left, width };
  };

  // Drag
  const onMouseDown = (e: React.MouseEvent, task: GanttTask) => {
    if (!onTaskMove) return;
    e.preventDefault();
    setDragging({
      taskId: task.id,
      startX: e.clientX,
      originalStart: new Date(task.startDate),
      originalEnd: new Date(task.endDate),
    });

    const onMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - e.clientX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);
      // Визуальный сдвиг (можно показать live-preview)
      // eslint-disable-next-line no-console
      void deltaDays;
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const deltaX = ev.clientX - e.clientX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);

      if (deltaDays !== 0) {
        const newStart = addDays(new Date(task.startDate), deltaDays);
        const newEnd = addDays(new Date(task.endDate), deltaDays);
        onTaskMove(task.id, newStart, newEnd);
      }
      setDragging(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400">
        Нет задач в выбранном диапазоне
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex">
        {/* Колонка с задачами */}
        <div className="w-72 flex-shrink-0 border-r border-slate-100 dark:border-slate-800">
          <div
            className="sticky top-0 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 px-4 py-3"
            style={{ height: HEADER_HEIGHT }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Задача
            </p>
          </div>
          <div>
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`px-4 flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                  hoverTask === t.id ? 'bg-sky-50 dark:bg-sky-900/20' : ''
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {t.title}
                  </p>
                  {t.universityName && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {t.universityName}
                    </p>
                  )}
                </div>
                <PriorityBadge priority={t.priority} />
              </div>
            ))}
          </div>
        </div>

        {/* Временная шкала */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ width: dates.length * DAY_WIDTH, minWidth: '100%' }}>
            {/* Заголовок с датами */}
            <div
              className="sticky top-0 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex"
              style={{ height: HEADER_HEIGHT }}
            >
              {dates.map((d) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isFirstOfMonth = d.getDate() === 1;
                return (
                  <div
                    key={d.toISOString()}
                    className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 ${
                      isWeekend ? 'bg-slate-100/50 dark:bg-slate-800/40' : ''
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    {isFirstOfMonth || d.getDate() === 1 ? (
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                        {format(d, 'MMM', { locale: ru })}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">
                      {format(d, 'd')}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {format(d, 'EE', { locale: ru })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Сетка и бары */}
            <div className="relative">
              {/* Фон — вертикальные линии дней */}
              <div className="flex absolute inset-0 pointer-events-none">
                {dates.map((d) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={d.toISOString()}
                      className={`flex-shrink-0 border-r border-slate-50 dark:border-slate-800/60 ${
                        isWeekend ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''
                      }`}
                      style={{ width: DAY_WIDTH }}
                    />
                  );
                })}
              </div>

              {/* Бары задач */}
              {tasks.map((t) => {
                const { left, width } = getBarPosition(t);
                const color = STATUS_COLORS[t.status] ?? 'bg-slate-400';
                const isHover = hoverTask === t.id;

                return (
                  <div
                    key={t.id}
                    className="flex items-center border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoverTask(t.id)}
                    onMouseLeave={() => setHoverTask(null)}
                  >
                    <div
                      onMouseDown={(e) => onMouseDown(e, t)}
                      onClick={() => onTaskClick?.(t)}
                      className={`absolute rounded-lg shadow-sm ${color} text-white text-xs font-medium px-2 flex items-center gap-1 cursor-pointer transition-shadow ${
                        dragging?.taskId === t.id ? 'opacity-70 cursor-grabbing' : ''
                      } ${isHover ? 'shadow-md z-10' : ''}`}
                      style={{
                        left: left + 4,
                        width: width - 8,
                        height: 28,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      title={`${t.title} · ${format(new Date(t.startDate), 'd MMM', { locale: ru })} → ${format(new Date(t.endDate), 'd MMM', { locale: ru })}`}
                    >
                      <span className="truncate flex-1">{t.title}</span>
                      {t.progress > 0 && (
                        <span className="text-[10px] opacity-90">{t.progress}%</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* SVG-слой для стрелок зависимостей */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: dates.length * DAY_WIDTH, height: tasks.length * ROW_HEIGHT }}
              >
                {dependencies.map((dep) => {
                  const fromTask = tasks.find((t) => t.id === dep.dependsOnTaskId);
                  const toTask = tasks.find((t) => t.id === dep.taskId);
                  if (!fromTask || !toTask) return null;

                  const fromIdx = tasks.indexOf(fromTask);
                  const toIdx = tasks.indexOf(toTask);
                  const fromPos = getBarPosition(fromTask);
                  const toPos = getBarPosition(toTask);

                  const x1 = fromPos.left + fromPos.width;
                  const y1 = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const x2 = toPos.left;
                  const y2 = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  const midX = (x1 + x2) / 2;

                  return (
                    <g key={dep.id}>
                      <path
                        d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        fill="none"
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  );
                })}

                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}