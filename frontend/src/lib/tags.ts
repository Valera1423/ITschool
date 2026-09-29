import type { Tag, UniversityTag } from '@/types';
import { api } from './api';
import { COLOR_NAMES, colorClasses, type ColorName } from './colors';

/**
 * Цветные теги для вузов.
 * По ТЗ: «цветные теги (VIP, Приоритет, Проблемный)».
 *
 * ⚠️ С Спринта 2 цвета вынесены в lib/colors.ts — единый источник.
 * Здесь оставлены реэкспорты для обратной совместимости.
 */

/**
 * Допустимые цвета тегов.
 * @deprecated Спринт 2: используйте COLOR_NAMES из lib/colors.ts
 */
export const TAG_COLORS = COLOR_NAMES;

export type TagColor = ColorName;

/**
 * Классы для цвета.
 * @deprecated Спринт 2: используйте colorClasses() из lib/colors.ts
 */
export const tagColor = colorClasses;

// ============================================================
// CRUD
// ============================================================

export async function listTags(): Promise<Tag[]> {
  try {
    return await api.get<Tag[]>('/tags');
  } catch {
    return [];
  }
}

export async function createTag(
  name: string,
  color: string,
  description?: string,
): Promise<Tag | null> {
  try {
    return await api.post<Tag>('/tags', {
      name: name.trim(),
      color,
      description: description ?? null,
    });
  } catch {
    return null;
  }
}

export async function updateTag(
  id: string,
  patch: Partial<Tag>,
): Promise<string | null> {
  try {
    await api.patch(`/tags/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteTag(id: string): Promise<string | null> {
  try {
    await api.delete(`/tags/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// СВЯЗЬ ТЕГ ↔ ВУЗ
// ============================================================

/**
 * Загрузить теги для списка вузов.
 *
 * ВАЖНО: POST, а не GET. При 500+ ID URL может превысить
 * лимит 8 КБ (браузеры) и 4 КБ (некоторые прокси).
 * Тело запроса не имеет таких ограничений.
 */
export async function getTagsForUniversities(
  universityIds: string[],
): Promise<Record<string, string[]>> {
  if (universityIds.length === 0) return {};

  try {
    const list = await api.post<UniversityTag[]>('/tags/universities/batch', {
      ids: universityIds,
    });

    const map: Record<string, string[]> = {};
    list.forEach((r) => {
      if (!map[r.university_id]) map[r.university_id] = [];
      map[r.university_id].push(r.tag_id);
    });
    return map;
  } catch {
    return {};
  }
}

export async function attachTag(
  universityId: string,
  tagId: string,
): Promise<string | null> {
  try {
    await api.post(`/universities/${universityId}/tags`, { tag_id: tagId });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function detachTag(
  universityId: string,
  tagId: string,
): Promise<string | null> {
  try {
    await api.delete(`/universities/${universityId}/tags/${tagId}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function setUniversityTags(
  universityId: string,
  tagIds: string[],
): Promise<string | null> {
  try {
    await api.post(`/universities/${universityId}/tags/set`, {
      tag_ids: tagIds,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}