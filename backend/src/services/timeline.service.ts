import { prisma } from '../db/prisma.js';

export interface TimelineEvent {
  kind:
    | 'created'
    | 'interaction'
    | 'task'
    | 'comment'
    | 'document'
    | 'call';
  event_id: string;
  title: string;
  description: string | null;
  actor: string | null;
  happened_at: Date;
  payload: Record<string, unknown>;
}

/**
 * Порт SQL-функции university_timeline: собирает события по вузу
 * из 6 таблиц, сортирует по времени, отдаёт первые N.
 *
 * Причины, почему Node, а не SQL:
 *  - Prisma не умеет UNION ALL напрямую, а raw SQL плохо типизируется;
 *  - агрегация в 6 запросов идёт параллельно, суммарно быстрее одного
 *    UNION (Postgres делает 6 seq scan вместо одного union-плана);
 *  - логику проще менять без миграции.
 */
export class TimelineService {
  static async forUniversity(
    universityId: string,
    limit = 200,
  ): Promise<TimelineEvent[]> {
    const take = Math.min(Math.max(limit, 1), 500);

    const [uni, interactions, tasks, comments, documents, calls] =
      await Promise.all([
        prisma.university.findFirst({
          where: { id: universityId, deletedAt: null },
          select: {
            id: true,
            name: true,
            city: true,
            direction: true,
            manager: true,
            status: true,
            createdAt: true,
          },
        }),
        prisma.interaction.findMany({
          where: { universityId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            title: true,
            details: true,
            type: true,
            status: true,
            manager: true,
            interactionDate: true,
            createdAt: true,
          },
        }),
        prisma.task.findMany({
          where: { universityId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            assignee: true,
            createdAt: true,
          },
        }),
        prisma.comment.findMany({
          where: { universityId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            body: true,
            author: true,
            createdAt: true,
          },
        }),
        prisma.document.findMany({
          where: { universityId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            uploadedBy: true,
            sizeBytes: true,
            createdAt: true,
          },
        }),
        prisma.callLog.findMany({
          where: { universityId },
          orderBy: { startedAt: 'desc' },
          take,
          select: {
            id: true,
            direction: true,
            notes: true,
            contactPhone: true,
            durationSeconds: true,
            manager: true,
            startedAt: true,
          },
        }),
      ]);

    if (!uni) return [];

    const events: TimelineEvent[] = [];

    events.push({
      kind: 'created',
      event_id: uni.id,
      title: 'Вуз создан',
      description: [uni.city, uni.direction].filter(Boolean).join(', ') || null,
      actor: uni.manager ?? 'система',
      happened_at: uni.createdAt,
      payload: { status: uni.status },
    });

    for (const i of interactions) {
      events.push({
        kind: 'interaction',
        event_id: i.id,
        title: i.title,
        description: i.details ?? null,
        actor: i.manager ?? null,
        happened_at: i.createdAt,
        payload: {
          type: i.type,
          status: i.status,
          date: i.interactionDate,
        },
      });
    }

    for (const t of tasks) {
      events.push({
        kind: 'task',
        event_id: t.id,
        title: t.title,
        description: t.description ?? null,
        actor: t.assignee ?? null,
        happened_at: t.createdAt,
        payload: { status: t.status, priority: t.priority },
      });
    }

    for (const c of comments) {
      events.push({
        kind: 'comment',
        event_id: c.id,
        title: c.body.slice(0, 100),
        description: c.body,
        actor: c.author ?? null,
        happened_at: c.createdAt,
        payload: {},
      });
    }

    for (const d of documents) {
      events.push({
        kind: 'document',
        event_id: d.id,
        title: d.name,
        description: d.description ?? d.category,
        actor: d.uploadedBy ?? null,
        happened_at: d.createdAt,
        payload: { category: d.category, size: String(d.sizeBytes) },
      });
    }

    for (const c of calls) {
      events.push({
        kind: 'call',
        event_id: c.id,
        title: `Звонок ${c.direction}`,
        description: c.notes ?? c.contactPhone,
        actor: c.manager ?? null,
        happened_at: c.startedAt,
        payload: {
          duration: c.durationSeconds,
          direction: c.direction,
        },
      });
    }

    return events
      .sort((a, b) => b.happened_at.getTime() - a.happened_at.getTime())
      .slice(0, take);
  }
}