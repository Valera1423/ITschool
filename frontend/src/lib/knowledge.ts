import { api } from './api';
import type { KbCategory, KbArticle } from '@/types';
import { colorClasses } from './colors';

/**
 * База знаний: категории, статьи, отзывы.
 *
 * ⚠️ С Спринта 2 цвета категорий берутся из lib/colors.ts.
 */

export async function listCategories(): Promise<KbCategory[]> {
  try {
    return await api.get<KbCategory[]>('/knowledge/categories');
  } catch {
    return [];
  }
}

export async function listArticles(categoryId?: string | null): Promise<KbArticle[]> {
  try {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    return await api.get<KbArticle[]>(`/knowledge/articles?${params.toString()}`);
  } catch {
    return [];
  }
}

export async function searchArticles(query: string): Promise<KbArticle[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    return await api.get<KbArticle[]>(
      `/knowledge/articles?search=${encodeURIComponent(q)}`,
    );
  } catch {
    return [];
  }
}

export async function getArticle(id: string): Promise<KbArticle | null> {
  try {
    return await api.get<KbArticle>(`/knowledge/articles/${id}`);
  } catch {
    return null;
  }
}

export async function upsertArticle(input: {
  id?: string;
  category_id: string | null;
  title: string;
  excerpt?: string;
  content: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  pinned?: boolean;
}): Promise<{ data: KbArticle | null; error: string | null }> {
  try {
    const data = input.id
      ? await api.patch<KbArticle>(`/knowledge/articles/${input.id}`, input)
      : await api.post<KbArticle>('/knowledge/articles', input);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

export async function deleteArticle(id: string): Promise<string | null> {
  try {
    await api.delete(`/knowledge/articles/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function submitFeedback(
  articleId: string,
  helpful: boolean,
  _userId: string | null,
  comment?: string,
): Promise<string | null> {
  try {
    await api.post(`/knowledge/articles/${articleId}/feedback`, {
      helpful,
      comment: comment ?? null,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

/**
 * @deprecated Спринт 2: используйте colorClasses() из lib/colors.ts
 */
export function categoryColor(color: string | null) {
  return colorClasses(color ?? 'sky');
}

/**
 * Инкремент счётчика просмотров.
 * Fire-and-forget: вызывается при открытии карточки статьи,
 * ошибки игнорируются.
 */
export async function incrementViews(articleId: string): Promise<void> {
  try {
    await api.post(`/knowledge/articles/${articleId}/view`);
  } catch {
    // Просмотры не критичны
  }
}