import { useMemo } from 'react';
import {
  TrendingDown,
  Target,
  Clock,
  DollarSign,
  AlertTriangle,
  Award,
  Users,
} from 'lucide-react';
import type { University, Interaction, Task, Workflow } from '@/types';
import { Avatar, PanelHeading, StatusBadge } from '@/components/ui';
import { ChartWrapper, ExportAllPdfButton } from '@/components/ChartWrapper';
import { useChartElements } from '@/hooks/useChartExport';
import { asArray } from '@/lib/utils';

/**
 * Дашборд руководителя.
 *
 * Ключевые метрики: пайплайн, средний цикл сделки, SLA, churn,
 * план/факт по менеджерам, воронка с конверсией, прогноз, когорты.
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  managers: string[];
}

const FUNNEL_STAGES = [
  'Новый',
  'Переговоры',
  'Внедрение',
  'Обучение',
  'Партнёр',
] as const;

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} тыс ₽`;
  return `${v} ₽`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00`);
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'short',
    year: '2-digit',
  }).format(d);
}

export function ExecutiveDashboardPage({
  universities,
  interactions: _interactions,
  tasks: _tasks,
  workflows: _workflows,
  managers,
}: Props) {
  const { getElements } = useChartElements();

  const safeUniversities = asArray<University>(universities);
  const safeManagers = asArray<string>(managers);

  // ---- KPI ----
  const won = safeUniversities.filter((u) => u.status === 'Партнёр');
  const lost = safeUniversities.filter((u) => u.status === 'Отказ');

  const pipelineValue = safeUniversities
    .filter((u) => !u.closed_at && u.status !== 'Отказ')
    .reduce((s, u) => s + Number(u.contract_value ?? 0), 0);

  const wonValue = won.reduce((s, u) => s + Number(u.contract_value ?? 0), 0);

  const cycleDays =
    won.length > 0
      ? won.reduce((sum, u) => {
          const start = new Date(u.created_at).getTime();
          const end = u.closed_at
            ? new Date(u.closed_at).getTime()
            : Date.now();
          return sum + Math.max(0, (end - start) / 86400000);
        }, 0) / won.length
      : 0;

  const slaSamples = safeUniversities.filter((u) => u.first_response_at);
  const avgSlaHours =
    slaSamples.length > 0
      ? slaSamples.reduce((sum, u) => {
          const diff =
            new Date(u.first_response_at!).getTime() -
            new Date(u.created_at).getTime();
          return sum + diff / 3_600_000;
        }, 0) / slaSamples.length
      : 0;

  const churnRate =
    safeUniversities.length > 0
      ? Math.round((lost.length / safeUniversities.length) * 100)
      : 0;

  // ---- План/факт по менеджерам ----
  const PLAN_PER_MANAGER = 5;
  const byManager = safeManagers.map((m) => {
    const uni = safeUniversities.filter((u) => u.manager === m);
    const done = uni.filter((u) => u.status === 'Партнёр').length;
    const revenue = uni.reduce((s, u) => s + Number(u.contract_value ?? 0), 0);
    return {
      name: m,
      total: uni.length,
      done,
      plan: PLAN_PER_MANAGER,
      revenue,
    };
  });

  // ---- Воронка ----
  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const count = safeUniversities.filter((u) => u.status === stage).length;
    const prevCount =
      i === 0
        ? safeUniversities.length
        : safeUniversities.filter((u) =>
            (FUNNEL_STAGES.slice(0, i) as readonly string[]).includes(u.status),
          ).length;
    const conversion = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    return { stage, count, conversion };
  });

  // ---- Прогноз ----
  const forecast = useMemo(() => {
    const buckets: Record<string, number> = {};
    safeUniversities.forEach((u) => {
      if (!u.expected_close_date) return;
      const k = monthKey(u.expected_close_date);
      buckets[k] = (buckets[k] ?? 0) + Number(u.contract_value ?? 0);
    });
    const keys = Object.keys(buckets).sort().slice(0, 6);
    const max = Math.max(...Object.values(buckets), 1);
    return keys.map((k) => ({
      key: k,
      label: monthLabel(k),
      value: buckets[k],
      height: (buckets[k] / max) * 100,
    }));
  }, [safeUniversities]);

  // ---- Когорты ----
  const cohorts = useMemo(() => {
    const map: Record<string, { total: number; won: number; lost: number }> = {};
    safeUniversities.forEach((u) => {
      const k = monthKey(u.created_at);
      if (!map[k]) map[k] = { total: 0, won: 0, lost: 0 };
      map[k].total += 1;
      if (u.status === 'Партнёр') map[k].won += 1;
      if (u.status === 'Отказ') map[k].lost += 1;
    });
    return Object.keys(map)
      .sort()
      .slice(-6)
      .map((k) => ({
        label: monthLabel(k),
        ...map[k],
        wonPct: map[k].total
          ? Math.round((map[k].won / map[k].total) * 100)
          : 0,
      }));
  }, [safeUniversities]);

  const kpiCards = [
    {
      label: 'Пайплайн',
      value: fmtMoney(pipelineValue),
      icon: DollarSign,
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
      hint: `${safeUniversities.filter((u) => !u.closed_at).length} активных`,
    },
    {
      label: 'Выиграно',
      value: fmtMoney(wonValue),
      icon: Award,
      color:
        'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      hint: `${won.length} партнёров`,
    },
    {
      label: 'Средний цикл',
      value: `${cycleDays.toFixed(0)} дн`,
      icon: Clock,
      color:
        'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
      hint: 'от создания до закрытия',
    },
    {
      label: 'SLA (ср.)',
      value: `${avgSlaHours.toFixed(1)} ч`,
      icon: Target,
      color:
        'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
      hint: 'до первого ответа',
    },
    {
      label: 'Churn',
      value: `${churnRate}%`,
      icon: TrendingDown,
      color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
      hint: `${lost.length} отказов`,
    },
    {
      label: 'Менеджеров',
      value: byManager.length,
      icon: Users,
      color: 'bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300',
      hint: 'активных',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Для руководства</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Дашборд руководителя
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            План/факт, воронка, прогноз, SLA и когортный анализ.
          </p>
        </div>
        <ExportAllPdfButton
          getElements={getElements}
          filename="executive-dashboard"
          onNotice={(msg) => console.log(msg)}
        />
      </section>

      {/* KPI */}
      <ChartWrapper title="Ключевые показатели" filename="exec-kpi">
        <div data-chart-export data-chart-title="Ключевые показатели">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiCards.map((k) => (
              <div
                key={k.label}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${k.color}`}
                >
                  <k.icon size={20} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {k.label}
                </p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {k.value}
                </p>
                <p className="text-xs text-slate-400 mt-1">{k.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </ChartWrapper>

      {/* План/факт по менеджерам */}
      <ChartWrapper title="План / факт по менеджерам" filename="exec-managers">
        <div data-chart-export data-chart-title="План / факт по менеджерам">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <PanelHeading title="План / факт по менеджерам" />
            <div className="space-y-4">
              {byManager.map((m) => {
                const pct = Math.min(100, (m.done / m.plan) * 100);
                const over = m.done >= m.plan;
                return (
                  <div key={m.name}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={m.name} size="sm" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                        <span className="text-slate-400">
                          {m.total} в работе
                        </span>
                        <span
                          className={`font-semibold ${
                            over
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {m.done} / {m.plan}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          over
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-r from-sky-400 to-sky-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ChartWrapper>

      {/* Воронка */}
      <ChartWrapper title="Воронка с конверсией" filename="exec-funnel">
        <div data-chart-export data-chart-title="Воронка с конверсией">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <PanelHeading title="Воронка с конверсией по этапам" />
            <div className="space-y-3">
              {funnel.map((f, i) => {
                const width = 100 - i * 12;
                return (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-600 dark:text-slate-300">
                        {f.stage}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {f.conversion}%
                        </span>
                        <strong className="text-slate-800 dark:text-slate-100 w-8 text-right">
                          {f.count}
                        </strong>
                      </div>
                    </div>
                    <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-[10px] font-medium text-white">
                          {f.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ChartWrapper>

      {/* Прогноз + Когорты */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper title="Прогноз выручки по месяцам" filename="exec-forecast">
          <div data-chart-export data-chart-title="Прогноз выручки по месяцам">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <PanelHeading title="Прогноз выручки по месяцам" />
              <div className="flex items-end justify-between gap-2 h-56 pt-4">
                {forecast.length === 0 && (
                  <p className="text-sm text-slate-400 m-auto">
                    Нет данных для прогноза
                  </p>
                )}
                {forecast.map((f) => (
                  <div
                    key={f.key}
                    className="flex flex-col items-center gap-2 flex-1"
                  >
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {fmtMoney(f.value)}
                    </div>
                    <div
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end"
                      style={{ height: '130px' }}
                    >
                      <div
                        className="w-full bg-gradient-to-t from-violet-500 to-violet-300 rounded-t-lg transition-all duration-500"
                        style={{ height: `${f.height}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartWrapper>

        <ChartWrapper title="Cohort analysis" filename="exec-cohorts">
          <div data-chart-export data-chart-title="Cohort analysis">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <PanelHeading title="Cohort analysis" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left font-medium py-2">Месяц</th>
                      <th className="text-center font-medium py-2">Всего</th>
                      <th className="text-center font-medium py-2">Партнёры</th>
                      <th className="text-center font-medium py-2">Отказы</th>
                      <th className="text-center font-medium py-2">Конверсия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((c) => (
                      <tr
                        key={c.label}
                        className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                      >
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {c.label}
                        </td>
                        <td className="py-2.5 text-center text-slate-700 dark:text-slate-200">
                          {c.total}
                        </td>
                        <td className="py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                          {c.won}
                        </td>
                        <td className="py-2.5 text-center text-rose-500">
                          {c.lost}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              c.wonPct >= 60
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : c.wonPct >= 30
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {c.wonPct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {cohorts.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-sm text-slate-400"
                        >
                          Пока нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ChartWrapper>
      </div>

      {/* Churn */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <PanelHeading title="Отвалившиеся вузы (churn)" />
        {lost.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Отказов нет
          </p>
        ) : (
          <div className="space-y-2">
            {lost.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {u.manager}
                    {u.loss_reason ? ` · ${u.loss_reason}` : ''}
                    {u.closed_at
                      ? ` · ${new Date(u.closed_at).toLocaleDateString('ru-RU')}`
                      : ''}
                  </p>
                </div>
                <StatusBadge status={u.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}