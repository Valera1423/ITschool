import type { SavedView } from '@/types';
import { api } from './api';

/**
 * Сохранённые виды (фильтры).
 * По ТЗ: «Пользователь настроил "мои вузы в Москве со статусом Переговоры" —
 * сохранил — видит в один клик».
 */

export async function listSavedViews(
  _userId: string,
  entity = 'universities',
): Promise<SavedView[]> {
  try {
    return await api.get<SavedView[]>(`/saved-views?entity=${entity}`);
  } catch {
    return [];
  }
}

export async function createSavedView(input: {
  name: string;
  entity: string;
  filters: Record<string, unknown>;
  sort?: Record<string, unknown>;
  color?: string;
  icon?: string;
  shared?: boolean;
  pinned?: boolean;
}): Promise<SavedView | null> {
  try {
    return await api.post<SavedView>('/saved-views', input);
  } catch {
    return null;
  }
}

export async function updateSavedView(
  id: string,
  patch: Partial<SavedView>,
): Promise<string | null> {
  try {
    await api.patch(`/saved-views/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteSavedView(id: string): Promise<string | null> {
  try {
    await api.delete(`/saved-views/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function togglePinned(id: string, pinned: boolean): Promise<string | null> {
  return updateSavedView(id, { pinned });
}