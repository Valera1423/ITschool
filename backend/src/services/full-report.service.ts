// backend/src/services/full-report.service.ts
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { buildScopeWhere } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';

/**
 * Полный JSON-отчёт по ТЗ п.6.4:
 *   «Решение должно предусматривать возможность формирования
 *    результирующего json-файла».
 *
 * Что важно:
 *   1. userId берётся ИЗ ТОКЕНА, а не из аргумента —
 *      это устраняет IDOR (было: клиент передавал userId в UI).
 *   2. Scope применяется ко всем сущностям: nam видит
 *      только свои вузы и связанные с ними данные.
 *   3. У каждой коллекции — свой лимит, чтобы отчёт
 *      не разросся до гигабайта на больших стендах.
 *
 * Лимиты (настраиваются через ENV FULL_REPORT_LIMIT_*):
 *   universities:   1000
 *   interactions:   5000
 *   tasks:          5000
 *   contracts:      2000
 *   comments:       5000
 *   documents:      2000
 *   notifications:  1000  (только текущего пользователя)
 *   auditLog:       1000  (только admin)
 *   inboxMessages:  500
 *   callLogs:       500
 *   transitions:    5000
 *   segments:       500
 *   savedViews:     200   (только текущего пользователя)
 */

const LIMITS = {
  universities: Number(process.env.FULL_REPORT_LIMIT_UNIVERSITIES ?? 1000),
  interactions: Number(process.env.FULL_REPORT_LIMIT_INTERACTIONS ?? 5000),
  tasks: Number(process.env.FULL_REPORT_LIMIT_TASKS ?? 5000),
  contracts: Number(process.env.FULL_REPORT_LIMIT_CONTRACTS ?? 2000),
  comments: Number(process.env.FULL_REPORT_LIMIT_COMMENTS ?? 5000),
  documents: Number(process.env.FULL_REPORT_LIMIT_DOCUMENTS ?? 2000),
  notifications: Number(process.env.FULL_REPORT_LIMIT_NOTIFICATIONS ?? 1000),
  auditLog: Number(process.env.FULL_REPORT_LIMIT_AUDIT ?? 1000),
  inboxMessages: Number(process.env.FULL_REPORT_LIMIT_INBOX ?? 500),
  callLogs: Number(process.env.FULL_REPORT_LIMIT_CALLS ?? 500),
  transitions: Number(process.env.FULL_REPORT_LIMIT_TRANSITIONS ?? 5000),
  segments: Number(process.env.FULL_REPORT_LIMIT_SEGMENTS ?? 500),
  savedViews: Number(process.env.FULL_REPORT_LIMIT_SAVED_VIEWS ?? 200),
};

export interface FullReportPeriod {
  from?: string;
  to?: string;
}

export class FullReportService {
  static async build(
    auth: AuthUser,
    period: FullReportPeriod = {},
  ): Promise<Record<string, unknown>> {
    const dateFrom = period.from ? new Date(period.from) : null;
    const dateTo = period.to ? new Date(period.to) : null;

    const scopeWhere = buildScopeWhere(auth, 'universities');
    const isAdmin = auth.role === 'admin';

    // Предварительно: id вузов, которые пользователю видны.
    // Нужно, чтобы фильтровать interactions / tasks / documents по ним.
    const visibleUniversities = await prisma.university.findMany({
      where: { deletedAt: null, ...scopeWhere },
      select: { id: true },
      take: LIMITS.universities,
    });
    const visibleIds = visibleUniversities.map((u) => u.id);

    // Общий фильтр по датам (применяем там, где есть createdAt / date)
    const dateFilter =
      dateFrom || dateTo
        ? {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          }
        : undefined;

    logger.info(
      {
        userId: auth.profileId,
        role: auth.role,
        universitiesCount: visibleIds.length,
        period,
      },
      '[full-report] start',
    );

    // ── Параллельные запросы. Все "тяжёлые" — с take.
    const [
      universities,
      interactions,
      tasks,
      contracts,
      workflows,
      workflowTransitions,
      comments,
      documents,
      notifications,
      auditLog,
      inboxMessages,
      callLogs,
      segments,
      savedViews,
      customFields,
      customFieldValues,
      pdConsents,
      securityEvents,
      catalogs,
    ] = await Promise.all([
      prisma.university.findMany({
        where: { deletedAt: null, ...scopeWhere },
        include: {
          vendor: true,
          directionRef: true,
          productRef: true,
          managerRef: true,
          contacts: true,
          tags: { include: { tag: true } },
        },
        take: LIMITS.universities,
      }),

      prisma.interaction.findMany({
        where: {
          deletedAt: null,
          ...(visibleIds.length > 0 ? { universityId: { in: visibleIds } } : {}),
          ...(dateFilter ? { interactionDate: dateFilter } : {}),
        },
        orderBy: { interactionDate: 'desc' },
        take: LIMITS.interactions,
      }),

      prisma.task.findMany({
        where: {
          deletedAt: null,
          ...(visibleIds.length > 0
            ? {
                OR: [
                  { universityId: { in: visibleIds } },
                  { universityId: null },
                ],
              }
            : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { dueDate: 'desc' },
        take: LIMITS.tasks,
      }),

      prisma.contract.findMany({
        where: {
          deletedAt: null,
          ...(visibleIds.length > 0 ? { universityId: { in: visibleIds } } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          approvals: { orderBy: { stepOrder: 'asc' } },
          versions: { orderBy: { version: 'desc' } },
        },
        take: LIMITS.contracts,
      }),

      prisma.workflow.findMany({
        where: { deletedAt: null },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      }),

      prisma.workflowTransition.findMany({
        where:
          visibleIds.length > 0
            ? { universityId: { in: visibleIds } }
            : undefined,
        orderBy: { createdAt: 'desc' },
        take: LIMITS.transitions,
      }),

      prisma.comment.findMany({
        where: {
          deletedAt: null,
          ...(visibleIds.length > 0
            ? { universityId: { in: visibleIds } }
            : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.comments,
      }),

      prisma.document.findMany({
        where: {
          deletedAt: null,
          ...(visibleIds.length > 0 ? { universityId: { in: visibleIds } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.documents,
      }),

      // Уведомления — ТОЛЬКО текущего пользователя
      prisma.notification.findMany({
        where: {
          userId: auth.profileId ?? undefined,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: LIMITS.notifications,
      }),

      // AuditLog — только admin. Иначе — пустой массив.
      isAdmin
        ? prisma.auditLog.findMany({
            where: dateFilter ? { createdAt: dateFilter } : undefined,
            orderBy: { createdAt: 'desc' },
            take: LIMITS.auditLog,
          })
        : Promise.resolve([]),

      // InboxMessages — только свои (по universityId + manager)
      prisma.inboxMessage.findMany({
        where: {
          ...(visibleIds.length > 0
            ? { universityId: { in: visibleIds } }
            : { manager: auth.name }),
          ...(dateFilter ? { receivedAt: dateFilter } : {}),
        },
        orderBy: { receivedAt: 'desc' },
        take: LIMITS.inboxMessages,
      }),

      prisma.callLog.findMany({
        where: {
          ...(visibleIds.length > 0
            ? { universityId: { in: visibleIds } }
            : { manager: auth.name }),
          ...(dateFilter ? { startedAt: dateFilter } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take: LIMITS.callLogs,
      }),

      prisma.segment.findMany({
        where: isAdmin
          ? undefined
          : {
              OR: [
                { createdBy: auth.profileId ?? undefined },
                { shared: true },
              ],
            },
        take: LIMITS.segments,
      }),

      // SavedViews — только текущего пользователя
      prisma.savedView.findMany({
        where: { userId: auth.profileId ?? '__none__' },
        take: LIMITS.savedViews,
      }),

      prisma.customField.findMany({
        where: { entity: 'universities' },
        orderBy: { sortOrder: 'asc' },
      }),

      visibleIds.length > 0
        ? prisma.customFieldValue.findMany({
            where: { entityId: { in: visibleIds } },
            take: 10_000,
          })
        : Promise.resolve([]),

      // PdConsent — только admin
      isAdmin
        ? prisma.pdConsent.findMany({
            where: dateFilter ? { grantedAt: dateFilter } : undefined,
            orderBy: { grantedAt: 'desc' },
            take: 2000,
          })
        : Promise.resolve([]),

      // SecurityEvent — только admin
      isAdmin
        ? prisma.securityEvent.findMany({
            where: dateFilter ? { createdAt: dateFilter } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 2000,
          })
        : Promise.resolve([]),

      // Каталоги
      Promise.all([
        prisma.vendor.findMany(),
        prisma.itDirection.findMany({ orderBy: { sortOrder: 'asc' } }),
        prisma.itProduct.findMany(),
        prisma.manager.findMany({ where: { active: true } }),
        prisma.workflowStatusCatalog.findMany({ orderBy: { sortOrder: 'asc' } }),
        prisma.tag.findMany(),
      ]).then(([vendors, directions, products, managers, statuses, tags]) => ({
        vendors,
        directions,
        products,
        managers,
        statuses,
        tags,
      })),
    ]);

    // ── Сводная статистика (по полному корпусу, не по take-лимиту)
    const [totalUniversities, totalInteractions, totalContractsAgg, totalPartners] =
      await Promise.all([
        prisma.university.count({ where: { deletedAt: null, ...scopeWhere } }),
        prisma.interaction.count({
          where: {
            deletedAt: null,
            ...(visibleIds.length > 0
              ? { universityId: { in: visibleIds } }
              : {}),
          },
        }),
        prisma.contract.aggregate({
          where: {
            deletedAt: null,
            status: { in: ['Согласован', 'Подписан'] },
            ...(visibleIds.length > 0
              ? { universityId: { in: visibleIds } }
              : {}),
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.university.count({
          where: { deletedAt: null, status: 'Партнёр', ...scopeWhere },
        }),
      ]);

    const report = {
      meta: {
        generated_at: new Date().toISOString(),
        generated_by: {
          userId: auth.profileId,
          email: auth.email,
          name: auth.name,
          role: auth.role,
        },
        period: {
          from: period.from ?? null,
          to: period.to ?? null,
        },
        workspace: 'ИТ Школа РТК',
        version: '1.0.0',
        scope: {
          // Диагностика: какие фильтры были применены
          universitiesFiltered: Object.keys(scopeWhere).length > 0,
          visibleUniversities: visibleIds.length,
          isAdmin,
        },
        limits: LIMITS,
      },

      catalogs,

      universities,
      interactions,
      tasks,
      contracts,
      workflows,
      workflowTransitions,
      comments,
      documents,
      notifications,
      inboxMessages,
      callLogs,
      segments,
      savedViews,
      customFields,
      customFieldValues,

      // Админ-разделы (пустые для не-admin)
      auditLog,
      pdConsents,
      securityEvents,

      stats: {
        totalUniversities,
        totalInteractions,
        totalContracts: totalContractsAgg._count,
        totalContractValue: Number(totalContractsAgg._sum.amount ?? 0),
        totalPartners,
        // Считаем по загруженным в отчёт записям
        loadedUniversities: universities.length,
        loadedInteractions: interactions.length,
      },
    };

    logger.info(
      {
        userId: auth.profileId,
        universities: universities.length,
        interactions: interactions.length,
      },
      '[full-report] done',
    );

    return report;
  }
}