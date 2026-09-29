// frontend/src/pages/DashboardPage.tsx
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock3,
  Download,
  Plus,
  ShieldCheck,
  Zap,
  Bell,
  Users,
  Mail,
  Phone,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { University, Interaction, Task, Workflow, ViewKey } from '@/types';
import { StatusBadge, PanelHeading, Avatar, EmptyState, Button } from '@/components/ui';
import { SmartHints } from '@/components/SmartHints';
import { formatDate, daysUntil } from '@/lib/utils';

/**
 * Главный дашборд.
 *
 * Показывает:
 * - 4 KPI-плитки
 * - Воронку по статусам
 * - Последнюю активность
 * - Вузы в работе (топ-5)
 * - Напоминания (срочные задачи)
 * - Workflow
 * - Smart hints (требует внимания)
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  onNavigate: (page: ViewKey) => void;
  onAddUniversity: () => void;
  onExport: () => void;
}

export function DashboardPage({
  universities,
  interactions,
  tasks,
  workflows,
  onNavigate,
  onAddUniversity,
  onExport,
}: Props) {
  const active = universities.filter((u) => u.status !== 'Отказ').length;
  const signed = universities.filter((u) => u.license_signed).length;
  const planned = interactions.filter(
    (i) => i.status === 'Запланировано',
  ).length;
  const upcomingTasks = tasks.filter(
    (t) => t.status !== 'Готово' && t.status !== 'Отменено',
  );

  // daysUntil возвращает number | null — null = битая дата, не берём.
  const reminders = upcomingTasks.filter((t) => {
    const d = daysUntil(t.due_date);
    return d !== null && d <= 2;
  });

  const stats = [
    {
      label: 'Всего вузов',
      value: universities.length,
      hint: 'за всё время',
      icon: Building2 as LucideIcon,
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
    },
    {
      label: 'Активные вузы',
      value: active,
      hint: 'в работе',
      icon: Activity as LucideIcon,
      color:
        'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    {
      label: 'Лицензии подписаны',
      value: `${signed}/${universities.length}`,
      hint: 'конверсия',
      icon: ShieldCheck as LucideIcon,
      color:
        'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    },
    {
      label: 'Ближайшие задачи',
      value: planned,
      hint: 'на этой неделе',
      icon: Clock3 as LucideIcon,
      color:
        'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
    },
  ];

  const recent = interactions.slice(0, 5);

  const funnel = [
    {
      label: 'Новые контакты',
      value: universities.filter((u) => u.status === 'Новый').length,
      width: '100%',
      color: 'bg-sky-500',
    },
    {
      label: 'Переговоры',
      value: universities.filter((u) => u.status === 'Переговоры').length,
      width: '76%',
      color: 'bg-sky-400',
    },
    {
      label: 'Внедрение',
      value: universities.filter((u) => u.status === 'Внедрение').length,
      width: '55%',
      color: 'bg-amber-400',
    },
    {
      label: 'Обучение',
      value: universities.filter((u) => u.status === 'Обучение').length,
      width: '38%',
      color: 'bg-emerald-400',
    },
    {
      label: 'Партнёры',
      value: universities.filter((u) => u.status === 'Партнёр').length,
      width: '26%',
      color: 'bg-teal-500',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Рабочий стол</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Добрый день
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Вот что происходит в вашем рабочем пространстве сегодня.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onExport}>
            <Download size={17} />
            Выгрузить отчёт
          </Button>
          {/* data-tour="add-university" — цель шага "Добавьте первый вуз" */}
          <Button onClick={onAddUniversity} data-tour="add-university">
            <Plus size={18} />
            Добавить вуз
          </Button>
        </div>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}
            >
              <stat.icon size={20} />
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {stat.label}
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {stat.value}
            </div>
            <div className="flex items-center gap-1 text-xs mt-2 text-slate-400">
              <ArrowUpRight size={14} />
              {stat.hint}
            </div>
          </div>
        ))}
      </section>

      {/* Smart hints — вынесены в отдельный компонент */}
      <SmartHints />

      {/* Воронка + активность */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <PanelHeading
            title="Воронка взаимодействий"
            action="Открыть аналитику"
            onClick={() => onNavigate('reports')}
          />
          <div className="space-y-3">
            {funnel.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600 dark:text-slate-300">
                    {row.label}
                  </span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {row.value}
                  </strong>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color} transition-all duration-500`}
                    style={{ width: row.width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <PanelHeading
            title="Последняя активность"
            action="Все взаимодействия"
            onClick={() => onNavigate('interactions')}
          />
          {recent.length ? (
            <div className="space-y-3">
              {recent.map((item) => {
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
                    className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {uni?.name ?? 'Вуз'} · {formatDate(item.interaction_date)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Пока нет взаимодействий" />
          )}
        </div>
      </section>

      {/* Вузы + напоминания */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <PanelHeading
            title="Вузы в работе"
            action="Все вузы"
            onClick={() => onNavigate('universities')}
          />
          {universities.length === 0 ? (
            <EmptyState
              text="Ещё нет вузов"
              hint="Добавьте первый вуз, чтобы начать работу"
              actionLabel="Добавить первый вуз"
              onAction={onAddUniversity}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left font-medium pb-2">Название</th>
                    <th className="text-left font-medium pb-2">Статус</th>
                    <th className="text-left font-medium pb-2">Менеджер</th>
                  </tr>
                </thead>
                <tbody>
                  {universities.slice(0, 5).map((uni) => (
                    <tr
                      key={uni.id}
                      className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-300">
                            <Building2 size={14} />
                          </div>
                          <div>
                            <div className="font-medium text-slate-700 dark:text-slate-200">
                              {uni.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {uni.city}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <StatusBadge status={uni.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={uni.manager} size="sm" />
                          <span className="text-slate-600 dark:text-slate-300">
                            {uni.manager}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <PanelHeading
            title="Напоминания"
            action="Все задачи"
            onClick={() => onNavigate('tasks')}
          />
          {reminders.length ? (
            <div className="space-y-3">
              {reminders.slice(0, 5).map((task) => {
                const d = daysUntil(task.due_date);
                const overdue = d !== null && d < 0;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={() => onNavigate('tasks')}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        overdue
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      <Bell size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {task.assignee} · {formatDate(task.due_date)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        overdue
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      {overdue && d !== null
                        ? `−${Math.abs(d)} дн.`
                        : d === 0
                          ? 'сегодня'
                          : `+${d ?? 0} дн.`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Нет срочных напоминаний" />
          )}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <PanelHeading
          title="Workflow"
          action="Настроить"
          onClick={() => onNavigate('workflows')}
        />
        {workflows.length === 0 ? (
          <EmptyState
            text="Workflow ещё нет"
            hint="Создайте первую последовательность действий"
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.slice(0, 3).map((wf) => (
              <div
                key={wf.id}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
                onClick={() => onNavigate('workflows')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-300">
                    <Zap size={18} />
                  </div>
                  <StatusBadge status={wf.status} />
                </div>
                <h3 className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                  {wf.name}
                </h3>
                <p className="text-xs text-slate-400">{wf.runs_count} запусков</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}