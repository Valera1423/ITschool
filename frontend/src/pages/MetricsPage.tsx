import {
  CheckCircle2,
  Clock3,
  TrendingUp,
  Zap,
  Target,
  AlertTriangle,
} from 'lucide-react';
import type { University, Interaction, Task, Workflow } from '@/types';
import { Avatar } from '@/components/ui';
import { ChartWrapper } from '@/components/ChartWrapper';
import { asArray, daysUntil } from '@/lib/utils';

/**
 * Показатели — KPI-плитки и загрузка менеджеров.
 * Простой дашборд для быстрой оценки.
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  managers: string[];
}

export function MetricsPage({
  universities,
  interactions,
  tasks,
  workflows,
  managers,
}: Props) {
  // Единственный источник истины — safe* массивы.
  // Используем их ВЕЗДЕ ниже, а не исходные props.
  const safeUniversities = asArray<University>(universities);
  const safeInteractions = asArray<Interaction>(interactions);
  const safeTasks = asArray<Task>(tasks);
  const safeWorkflows = asArray<Workflow>(workflows);
  const safeManagers = asArray<string>(managers);

  const total = safeUniversities.length;
  const signed = safeUniversities.filter((u) => u.license_signed).length;
  const conversionRate = total ? Math.round((signed / total) * 100) : 0;

  const completedInteractions = safeInteractions.filter(
    (i) => i.status === 'Завершено',
  ).length;
  const plannedInteractions = safeInteractions.filter(
    (i) => i.status === 'Запланировано',
  ).length;
  const completionRate = safeInteractions.length
    ? Math.round((completedInteractions / safeInteractions.length) * 100)
    : 0;

  const activeWorkflows = safeWorkflows.filter(
    (w) => w.status === 'Активен',
  ).length;
  const totalRuns = safeWorkflows.reduce((sum, w) => sum + w.runs_count, 0);

  const overdueTasks = safeTasks.filter((t) => {
    const d = daysUntil(t.due_date);
    return d !== null && d < 0 && t.status !== 'Готово' && t.status !== 'Отменено';
  }).length;

  const doneTasks = safeTasks.filter((t) => t.status === 'Готово').length;
  const taskCompletionRate = safeTasks.length
    ? Math.round((doneTasks / safeTasks.length) * 100)
    : 0;

  const byManager = safeManagers.map((m) => ({
    name: m,
    universities: safeUniversities.filter((u) => u.manager === m).length,
    interactions: safeInteractions.filter((i) => i.manager === m).length,
    tasks: safeTasks.filter((t) => t.assignee === m).length,
  }));
  const maxManagerUni = Math.max(...byManager.map((m) => m.universities), 1);

  const kpis = [
    {
      label: 'Конверсия в лицензию',
      value: `${conversionRate}%`,
      icon: Target,
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
      hint: `${signed} из ${total}`,
    },
    {
      label: 'Завершённость взаимодействий',
      value: `${completionRate}%`,
      icon: TrendingUp,
      color:
        'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      hint: `${completedInteractions} из ${safeInteractions.length}`,
    },
    {
      label: 'Завершённость задач',
      value: `${taskCompletionRate}%`,
      icon: CheckCircle2,
      color:
        'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
      hint: `${doneTasks} из ${safeTasks.length}`,
    },
    {
      label: 'Просрочено задач',
      value: overdueTasks,
      icon: AlertTriangle,
      color:
        overdueTasks > 0
          ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      hint: overdueTasks === 0 ? 'Всё в порядке' : 'Требует внимания',
    },
    {
      label: 'Активных workflow',
      value: activeWorkflows,
      icon: Zap,
      color:
        'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
      hint: `${totalRuns} запусков`,
    },
    {
      label: 'Предстоящих встреч',
      value: plannedInteractions,
      icon: Clock3,
      color:
        'bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300',
      hint: 'Запланировано',
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Аналитика и KPI</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Показатели
        </h1>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${kpi.color}`}
            >
              <kpi.icon size={20} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{kpi.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper
          title="Загрузка менеджеров"
          filename="metrics-managers"
          serverFallback={{
            type: 'horizontal-bar',
            title: 'Загрузка менеджеров',
            categoryLabel: 'Менеджер',
            valueLabel: 'Вузов',
            data: byManager.map((m) => ({ label: m.name, value: m.universities })),
          }}
        >
          <div data-chart-export data-chart-title="Загрузка менеджеров">
            <div className="space-y-4">
              {byManager.map((m) => (
                <div key={m.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={m.name} size="sm" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
                        {m.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 text-right">
                      {m.universities} вузов · {m.interactions} касаний ·{' '}
                      {m.tasks} задач
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${(m.universities / maxManagerUni) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartWrapper>

        <ChartWrapper
          title="Структура взаимодействий"
          filename="metrics-interactions"
          serverFallback={{
            type: 'pie',
            title: 'Структура взаимодействий',
            data: ['Звонок', 'Встреча', 'Письмо', 'Документ'].map((type) => ({
              label: type,
              value: safeInteractions.filter((i) => i.type === type).length,
            })),
          }}
        >
          <div data-chart-export data-chart-title="Структура взаимодействий">
            <div className="space-y-3">
              {['Звонок', 'Встреча', 'Письмо', 'Документ'].map((type) => {
                const count = safeInteractions.filter(
                  (i) => i.type === type,
                ).length;
                const pct = safeInteractions.length
                  ? (count / safeInteractions.length) * 100
                  : 0;
                return (
                  <div key={type} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300 w-20">
                      {type}
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <strong className="text-slate-700 dark:text-slate-200 w-8 text-right text-sm">
                      {count}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartWrapper>
      </div>

      <ChartWrapper
        title="Сводка по статусам вузов"
        filename="metrics-statuses"
        serverFallback={{
          type: 'bar',
          title: 'Вузы по статусам',
          categoryLabel: 'Статус',
          valueLabel: 'Количество',
          data: [
            'Новый',
            'Переговоры',
            'Обучение',
            'Внедрение',
            'Партнёр',
            'Отказ',
          ].map((status) => ({
            label: status,
            value: safeUniversities.filter((u) => u.status === status).length,
          })),
        }}
      >
        <div data-chart-export data-chart-title="Сводка по статусам вузов">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              'Новый',
              'Переговоры',
              'Обучение',
              'Внедрение',
              'Партнёр',
              'Отказ',
            ].map((status) => {
              const count = safeUniversities.filter(
                (u) => u.status === status,
              ).length;
              return (
                <div
                  key={status}
                  className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                >
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {count}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{status}</div>
                </div>
              );
            })}
          </div>
        </div>
      </ChartWrapper>
    </div>
  );
}