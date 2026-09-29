// backend/src/services/search.service.ts
import { prisma } from '../db/prisma.js';

export interface SearchHit {
  entity:
    | 'universities'
    | 'tasks'
    | 'interactions'
    | 'comments'
    | 'knowledge'
    | 'documents';
  id: string;
  title: string;
  subtitle: string;
  rank: number;
}

/**
 * Простой ранкер: чем "раньше" вхождение — тем выше.
 *
 *   точное совпадение      → 100
 *   начинается с query     → 80
 *   совпадение по слову    → 60
 *   содержится как подстрока → 40
 *   fallback               → 20
 */
function rankOf(text: string | null | undefined, q: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();

  if (lower === ql) return 100;
  if (lower.startsWith(ql)) return 80;

  // Проверка "слово начинается с q" (для многословных названий)
  for (const word of lower.split(/[\s,.;:!?()\-/]+/)) {
    if (word.startsWith(ql)) return 60;
  }

  if (lower.includes(ql)) return 40;
  return 20;
}

export class SearchService {
  static async search(query: string, limit = 20): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const mode = 'insensitive' as const;
    const take = Math.min(limit, 50);

    // Параллельные запросы — без FTS, только ILIKE.
    // Работает без pg_trgm и без search_vector.
    const [unis, tasks, interactions, comments, kb, documents] = await Promise.all([
      prisma.university.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode } },
            { city: { contains: q, mode } },
            { contactName: { contains: q, mode } },
            { contactEmail: { contains: q, mode } },
            { manager: { contains: q, mode } },
            { direction: { contains: q, mode } },
            { product: { contains: q, mode } },
          ],
        },
        select: {
          id: true, name: true, city: true, manager: true,
          contactName: true, contactEmail: true,
          direction: true, product: true,
        },
        take,
      }),

      prisma.task.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q, mode } },
            { description: { contains: q, mode } },
            { assignee: { contains: q, mode } },
          ],
        },
        select: { id: true, title: true, status: true, assignee: true },
        take,
      }),

      prisma.interaction.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q, mode } },
            { details: { contains: q, mode } },
            { manager: { contains: q, mode } },
          ],
        },
        select: { id: true, title: true, type: true, manager: true },
        take,
      }),

      prisma.comment.findMany({
        where: {
          deletedAt: null,
          OR: [
            { body: { contains: q, mode } },
            { author: { contains: q, mode } },
          ],
        },
        select: { id: true, body: true, author: true },
        take,
      }),

      prisma.kbArticle.findMany({
        where: {
          deletedAt: null,
          status: 'published',
          OR: [
            { title: { contains: q, mode } },
            { content: { contains: q, mode } },
            { excerpt: { contains: q, mode } },
          ],
        },
        select: { id: true, title: true, excerpt: true },
        take,
      }),

      prisma.document.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          name: true,
          category: true,
          universityId: true,
          university: { select: { name: true } },
        },
        take,
      }),
    ]);

    const hits: SearchHit[] = [
      ...unis.map((u) => ({
        entity: 'universities' as const,
        id: u.id,
        title: u.name,
        subtitle: [u.city, u.manager].filter(Boolean).join(' · '),
        rank: Math.max(
          rankOf(u.name, q),
          rankOf(u.city, q),
          rankOf(u.contactName, q),
          rankOf(u.contactEmail, q),
        ),
      })),

      ...tasks.map((t) => ({
        entity: 'tasks' as const,
        id: t.id,
        title: t.title,
        subtitle: `${t.status} · ${t.assignee}`,
        rank: Math.max(rankOf(t.title, q), rankOf(t.assignee, q)),
      })),

      ...interactions.map((i) => ({
        entity: 'interactions' as const,
        id: i.id,
        title: i.title,
        subtitle: `${i.type} · ${i.manager}`,
        rank: rankOf(i.title, q),
      })),

      ...comments.map((c) => ({
        entity: 'comments' as const,
        id: c.id,
        title: c.body.slice(0, 100),
        subtitle: c.author,
        rank: rankOf(c.body, q),
      })),

      ...kb.map((k) => ({
        entity: 'knowledge' as const,
        id: k.id,
        title: k.title,
        subtitle: (k.excerpt ?? '').slice(0, 80),
        rank: rankOf(k.title, q),
      })),

      ...documents.map((d) => ({
        entity: 'documents' as const,
        id: d.id,
        title: d.name,
        subtitle: `${d.category} · ${d.university?.name ?? 'без вуза'}`,
        rank: rankOf(d.name, q),
      })),
    ];

    return hits.sort((a, b) => b.rank - a.rank).slice(0, limit);
  }
}