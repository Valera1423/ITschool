// frontend/src/components/dashboards/WidgetRenderer.tsx
import {
  Building2,
  CheckSquare,
  MessagesSquare,
  DollarSign,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import type {
  DashboardWidget,
  University,
  Interaction,
  Task,
  Workflow,
} from '@/types';
import { StatusBadge, Avatar, EmptyState } from '@/components/ui';
import { formatDate, daysUntil } from '@/lib/utils';

/**
 * Рендерер виджетов кастомного дашборда.
 * 13 типов виджетов: 4 KPI, воронка, активность, задачи, топ менеджеров,
 * графики по статусам/типам, города, workflow.
 *
 * ВАЖНО: daysUntil() возвращает `number | null` (null = битая дата).
 * Все сравнения делаются через явную проверку `d !== null`, чтобы
 * задачи/события с невалидной датой не выпадали молча из выборок.
 */
interface Props {
  widget: DashboardWidget;
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  managers: string[];
  onNavigate?: (view: string) => void;
}

export function WidgetRenderer({
  widget,
  universities,
  interactions,
  tasks,
  workflows,
  managers,
}: Props) {
  switch (widget.type) {
    case 'kpi_unis':
      return <KpiCard label="Всего вузов" value={universities.length} icon={Building2} color="sky" />;

    case 'kpi_tasks': {
      const open = tasks.filter(
        (t) => t.status !== 'Готово' && t.status !== 'Отменено',
      ).length;
      return <KpiCard label="Открытых задач" value={open} icon={CheckSquare} color="amber" />;
    }

    case 'kpi_interactions': {
      const monthAgo = new Date(Date.now() - 30 * 86400000);
      const count = interactions.filter(
        (i) => new Date(i.interaction_date) >= monthAgo,
      ).length;
      return <KpiCard label="Касаний за месяц" value={count} icon={MessagesSquare} color="emerald" />;
    }

    case 'kpi_revenue': {
      const total = universities.reduce(
        (s, u) => s + Number(u.contract_value ?? 0),
        0,
      );
      return (
        <KpiCard
          label="Выручка"
          value={`${(total / 1_000_000).toFixed(1)} млн ₽`}
          icon={DollarSign}
          color="violet"
        />
      );
    }

    case 'funnel':
      return <FunnelWidget universities={universities} />;

    case 'recent_activity':
      return <RecentActivity interactions={interactions} universities={universities} />;

    case 'upcoming_tasks':
      return <UpcomingTasks tasks={tasks} />;

    case 'tasks_overdue': {
      // Явно отсеиваем null — иначе `null < 0 === false`, задача с битой
      // датой молча пропадёт.
      const overdue = tasks.filter((t) => {
        if (t.status === 'Готово' || t.status === 'Отменено') return false;
        const d = daysUntil(t.due_date);
        if (d === null) return false;
        return d < 0;
      });
      return (
        <KpiCard
          label="Просрочено"
          value={overdue.length}
          icon={AlertTriangle}
          color={overdue.length > 0 ? 'rose' : 'emerald'}
        />
      );
    }

    case 'top_managers':
      return <TopManagers managers={managers} universities={universities} />;

    case 'chart_unis_by_status':
      return <UnisByStatus universities={universities} />;

    case 'chart_interactions_by_type':
      return <InteractionsByType interactions={interactions} />;

    case 'unis_by_city':
      return <UnisByCity universities={universities} />;

    case 'workflow_status':
      return <WorkflowStatus workflows={workflows} />;

    default:
      return <EmptyState text="Неизвестный виджет" />;
  }
}

// ============================================================
// Компоненты
// ============================================================

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Building2;
  color: string;
}) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color] ?? colors.sky}`}
      >
        <Icon size={20} />
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
        {value}
      </div>
    </div>
  );
}

function FunnelWidget({ universities }: { universities: University[] }) {
  const stages = ['Новый', 'Переговоры', 'Внедрение', 'Обучение', 'Партнёр'];
  const colors = [
    'bg-sky-500',
    'bg-sky-400',
    'bg-amber-400',
    'bg-emerald-400',
    'bg-teal-500',
  ];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Воронка</h3>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const count = universities.filter((u) => u.status === s).length;
          const width = 100 - i * 15;
          return (
            <div key={s}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-300">{s}</span>
                <strong className="text-slate-800 dark:text-slate-100">{count}</strong>
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors[i]} rounded-full transition-all`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity({
  interactions,
  universities,
}: {
  interactions: Interaction[];
  universities: University[];
}) {
  const recent = interactions.slice(0, 5);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Активность</h3>
      {recent.length === 0 ? (
        <EmptyState text="Нет данных" />
      ) : (
        <div className="space-y-2">
          {recent.map((i) => {
            const uni = universities.find((u) => u.id === i.university_id);
            return (
              <div
                key={i.id}
                className="flex items-center gap-2 text-sm py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                  <MessagesSquare size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 dark:text-slate-200 truncate text-xs">
                    {i.title}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {uni?.name ?? '—'} · {formatDate(i.interaction_date)}
                  </p>
                </div>
                <StatusBadge status={i.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpcomingTasks({ tasks }: { tasks: Task[] }) {
  const week = tasks
    .filter((t) => t.status !== 'Готово' && t.status !== 'Отменено')
    .filter((t) => {
      // Явно отсеиваем null (битая дата) — иначе `null >= 0 && null <= 7`
      // дало бы false и задача молча пропала бы.
      const d = daysUntil(t.due_date);
      return d !== null && d >= 0 && d <= 7;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Ближайшие задачи
      </h3>
      {week.length === 0 ? (
        <EmptyState text="Нет задач на неделю" />
      ) : (
        <div className="space-y-2">
          {week.map((t) => {
            // d гарантированно number после фильтра
            const d = daysUntil(t.due_date) ?? 0;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 text-sm py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    d <= 1
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <CheckSquare size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 dark:text-slate-200 truncate text-xs">
                    {t.title}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {d === 0 ? 'сегодня' : `через ${d} дн.`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopManagers({
  managers,
  universities,
}: {
  managers: string[];
  universities: University[];
}) {
  const stats = managers.map((m) => ({
    name: m,
    count: universities.filter((u) => u.manager === m).length,
  }));
  const max = Math.max(...stats.map((s) => s.count), 1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Топ менеджеров
      </h3>
      <div className="space-y-3">
        {stats
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={s.name} size="sm" />
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                    {s.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {s.count}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full"
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function UnisByStatus({ universities }: { universities: University[] }) {
  const statuses = ['Новый', 'Переговоры', 'Обучение', 'Внедрение', 'Партнёр', 'Отказ'];
  const counts = statuses.map((s) => universities.filter((u) => u.status === s).length);
  const max = Math.max(...counts, 1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
        По статусам
      </h3>
      <div className="flex items-end justify-around gap-2 h-32">
        {statuses.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {counts[i]}
            </span>
            <div
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-t flex items-end"
              style={{ height: '80px' }}
            >
              <div
                className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t"
                style={{ height: `${(counts[i] / max) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 text-center">
              {s.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractionsByType({ interactions }: { interactions: Interaction[] }) {
  const types = ['Звонок', 'Встреча', 'Письмо', 'Документ'];
  const counts = types.map((t) => interactions.filter((i) => i.type === t).length);
  const total = counts.reduce((s, x) => s + x, 0) || 1;
  const colors = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Типы касаний
      </h3>
      <div className="space-y-2">
        {types.map((t, i) => (
          <div key={t} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-slate-600 dark:text-slate-300">{t}</span>
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[i]} rounded-full`}
                style={{ width: `${(counts[i] / total) * 100}%` }}
              />
            </div>
            <strong className="text-slate-700 dark:text-slate-200 w-6 text-right">
              {counts[i]}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnisByCity({ universities }: { universities: University[] }) {
  const map: Record<string, number> = {};
  universities.forEach((u) => {
    map[u.city] = (map[u.city] ?? 0) + 1;
  });
  const top = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Города</h3>
      <div className="space-y-2">
        {top.map(([city, count]) => (
          <div key={city} className="flex items-center gap-2 text-xs">
            <MapPin size={12} className="text-slate-400" />
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
              {city}
            </span>
            <strong className="text-slate-700 dark:text-slate-200">{count}</strong>
          </div>
        ))}
        {top.length === 0 && <EmptyState text="Нет данных" />}
      </div>
    </div>
  );
}

function WorkflowStatus({ workflows }: { workflows: Workflow[] }) {
  const active = workflows.filter((w) => w.status === 'Активен').length;
  const paused = workflows.filter((w) => w.status === 'На паузе').length;
  const done = workflows.filter((w) => w.status === 'Завершён').length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Workflow
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {active}
          </div>
          <div className="text-[10px] text-slate-400">активных</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {paused}
          </div>
          <div className="text-[10px] text-slate-400">на паузе</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-500">{done}</div>
          <div className="text-[10px] text-slate-400">завершено</div>
        </div>
      </div>
    </div>
  );
}