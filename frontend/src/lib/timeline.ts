import type { TimelineEvent } from '@/types';
import { api } from './api';
import { colorClasses } from './colors';

/**
 * Timeline — единая лента событий по вузу.
 */
export async function fetchUniversityTimeline(
  universityId: string,
  limit = 200,
): Promise<TimelineEvent[]> {
  try {
    return await api.get<TimelineEvent[]>(
      `/universities/${universityId}/timeline?limit=${limit}`,
    );
  } catch {
    return [];
  }
}

/**
 * Метаданные для отображения каждого типа события.
 */
export const TIMELINE_KIND_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  created:       { label: 'Создание',    icon: 'Sparkles',       color: 'sky' },
  interaction:   { label: 'Контакт',     icon: 'MessagesSquare', color: 'emerald' },
  task:          { label: 'Задача',      icon: 'CheckSquare',    color: 'amber' },
  comment:       { label: 'Комментарий', icon: 'MessageCircle',  color: 'slate' },
  document:      { label: 'Документ',    icon: 'FileText',       color: 'violet' },
  call:          { label: 'Звонок',      icon: 'Phone',          color: 'teal' },
  custom_field:  { label: 'Поле',        icon: 'Tag',            color: 'rose' },
  tag:           { label: 'Тег',         icon: 'Tag',            color: 'violet' },
};

export function timelineColor(kind: string) {
  const meta = TIMELINE_KIND_META[kind];
  return colorClasses(meta?.color ?? 'slate');
}