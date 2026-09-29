import type { SearchResult } from '@/types';
import { api } from './api';

/**
 * Глобальный поиск по всей базе — командная палитра ⌘K.
 */
export async function globalSearch(
  q: string,
  limit = 20,
): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    return await api.get<SearchResult[]>(
      `/search?q=${encodeURIComponent(term)}&limit=${limit}`,
    );
  } catch {
    return [];
  }
}

export const SEARCH_ENTITY_LABELS: Record<SearchResult['entity'], string> = {
  universities: 'Вуз',
  tasks: 'Задача',
  interactions: 'Взаимодействие',
  comments: 'Комментарий',
  workflows: 'Workflow',
  documents: 'Документ', // NEW
};

/** Определить целевой раздел для перехода. */
export function targetViewFor(
  entity: SearchResult['entity'],
): 'universities' | 'tasks' | 'interactions' | 'workflows' {
  if (entity === 'universities' || entity === 'comments') return 'universities';
  if (entity === 'documents') return 'universities'; // откроется карточка вуза
  if (entity === 'tasks') return 'tasks';
  if (entity === 'interactions') return 'interactions';
  return 'workflows';
}