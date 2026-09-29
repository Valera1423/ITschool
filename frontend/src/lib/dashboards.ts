import { api } from './api';
import type { Dashboard, DashboardWidget, WidgetType } from '@/types';

/**
 * Персональные дашборды. Виджеты описаны в WIDGET_LIBRARY.
 */

export const WIDGET_LIBRARY: {
  type: WidgetType;
  title: string;
  description: string;
  span: 1 | 2 | 3;
}[] = [
  { type: 'kpi_unis', title: 'Всего вузов', description: 'Счётчик', span: 1 },
  { type: 'kpi_tasks', title: 'Открытых задач', description: 'Счётчик активных задач', span: 1 },
  { type: 'kpi_interactions', title: 'Взаимодействий за месяц', description: 'Счётчик', span: 1 },
  { type: 'kpi_revenue', title: 'Выручка', description: 'Сумма договоров', span: 1 },
  { type: 'funnel', title: 'Воронка по статусам', description: 'Горизонтальная воронка', span: 2 },
  { type: 'recent_activity', title: 'Последняя активность', description: 'Лента событий', span: 2 },
  { type: 'upcoming_tasks', title: 'Ближайшие задачи', description: 'Список на 7 дней', span: 2 },
  { type: 'tasks_overdue', title: 'Просроченные задачи', description: 'Срочно', span: 1 },
  { type: 'top_managers', title: 'Топ менеджеров', description: 'По количеству вузов', span: 1 },
  { type: 'chart_unis_by_status', title: 'Вузы по статусам', description: 'Столбчатая диаграмма', span: 2 },
  { type: 'chart_interactions_by_type', title: 'Типы взаимодействий', description: 'Прогресс-бары', span: 1 },
  { type: 'unis_by_city', title: 'Вузы по городам', description: 'Топ-5 городов', span: 1 },
  { type: 'workflow_status', title: 'Workflow', description: 'Статусы', span: 1 },
];

export function widgetTitle(type: WidgetType): string {
  return WIDGET_LIBRARY.find((w) => w.type === type)?.title ?? type;
}

export function widgetSpan(type: WidgetType): 1 | 2 | 3 {
  return WIDGET_LIBRARY.find((w) => w.type === type)?.span ?? 1;
}

export async function listDashboards(userId: string): Promise<Dashboard[]> {
  try {
    return await api.get<Dashboard[]>(`/dashboards?userId=${userId}`);
  } catch {
    return [];
  }
}

export async function createDashboard(input: {
  user_id: string;
  name: string;
  description?: string;
  layout?: DashboardWidget[];
  is_default?: boolean;
  shared?: boolean;
}): Promise<Dashboard | null> {
  try {
    return await api.post<Dashboard>('/dashboards', input);
  } catch {
    return null;
  }
}

export async function updateDashboard(
  id: string,
  patch: Partial<Dashboard>,
): Promise<string | null> {
  try {
    await api.patch(`/dashboards/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteDashboard(id: string): Promise<string | null> {
  try {
    await api.delete(`/dashboards/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function duplicateDashboard(
  id: string,
  userId: string,
): Promise<Dashboard | null> {
  try {
    return await api.post<Dashboard>(`/dashboards/${id}/duplicate`, { userId });
  } catch {
    return null;
  }
}

export function defaultLayout(): DashboardWidget[] {
  return [
    { id: 'kpi1', type: 'kpi_unis', span: 1, order: 1 },
    { id: 'kpi2', type: 'kpi_tasks', span: 1, order: 2 },
    { id: 'kpi3', type: 'kpi_interactions', span: 1, order: 3 },
    { id: 'fun1', type: 'funnel', span: 2, order: 4 },
    { id: 'act1', type: 'recent_activity', span: 2, order: 5 },
    { id: 'upc1', type: 'upcoming_tasks', span: 2, order: 6 },
    { id: 'tm1', type: 'top_managers', span: 1, order: 7 },
  ];
}