// backend/src/routes/reports.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';
import { reportRateLimit } from '../middleware/rateLimit.js';
import { UserActivityService } from '../services/user-activity.service.js';
import { ReportsWithChartsService } from '../services/reports-with-charts.service.js';
import {
  ReportsService,
  DEFAULT_INTERACTION_COLUMNS,
  ALL_INTERACTION_COLUMNS,
} from '../services/reports.service.js';
import { FullReportService } from '../services/full-report.service.js';

const router = Router();

/**
 * @openapi
 * /reports/interactions:
 *   get:
 *     tags: [Reports]
 *     summary: Отчёт «Взаимодействия за период»
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: to, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: directionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: productId, schema: { type: string, format: uuid } }
 *       - { in: query, name: managerId, schema: { type: string, format: uuid } }
 *       - { in: query, name: universityId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv], default: json } }
 *     responses:
 *       200: { description: Данные отчёта }
 */
router.get('/interactions', reportRateLimit, async (req, res, next) => {
  try {
    const q = z.object({
      from: z.string().date(),
      to: z.string().date(),
      directionId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      managerId: z.string().uuid().optional(),
      universityId: z.string().uuid().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      format: z.enum(['json', 'csv']).default('json'),
    }).parse(req.query);

    const where: Record<string, unknown> = {
      deletedAt: null,
      interactionDate: { gte: new Date(q.from), lte: new Date(q.to) },
      status: q.status,
      type: q.type,
      ...(q.universityId ? { universityId: q.universityId } : {}),
    };

    const universityWhere: Record<string, unknown> = { deletedAt: null };
    if (q.directionId) universityWhere.directionId = q.directionId;
    if (q.productId) universityWhere.productId = q.productId;
    if (q.managerId) universityWhere.managerId = q.managerId;

    if (Object.keys(universityWhere).length > 1) {
      where.university = { ...universityWhere };
    }

    const items = await prisma.interaction.findMany({
      where,
      orderBy: [{ interactionDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        university: {
          include: {
            directionRef: true,
            productRef: true,
            managerRef: true,
          },
        },
      },
      take: 10000,
    });

    const rows = items.map((i) => ({
      interaction_id: i.id,
      interaction_date: i.interactionDate.toISOString().slice(0, 10),
      interaction_type: i.type,
      interaction_status: i.status,
      interaction_title: i.title,
      manager_name: i.university.managerRef?.fullName ?? i.manager,
      university_id: i.university.id,
      university_name: i.university.name,
      direction_name: i.university.directionRef?.name ?? null,
      product_name: i.university.productRef?.name ?? null,
      details: i.details,
      created_at: i.createdAt.toISOString(),
    }));

    if (q.format === 'csv') {
      const headers = [
        'Дата',
        'Тип',
        'Статус',
        'Название',
        'Менеджер',
        'Вуз',
        'Направление',
        'Продукт',
        'Детали',
      ];
      const lines = [headers.join(';')];
      rows.forEach((r) => {
        lines.push([
          r.interaction_date,
          r.interaction_type,
          r.interaction_status,
          `"${String(r.interaction_title ?? '').replace(/"/g, '""')}"`,
          r.manager_name,
          `"${String(r.university_name ?? '').replace(/"/g, '""')}"`,
          r.direction_name ?? '',
          r.product_name ?? '',
          `"${String(r.details ?? '').replace(/"/g, '""')}"`,
        ].join(';'));
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="interactions-${q.from}_${q.to}.csv"`,
      );
      res.send('\uFEFF' + lines.join('\n'));
      return;
    }

    return ok(res, rows);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /reports/universities:
 *   get:
 *     tags: [Reports]
 *     summary: Отчёт по вузам за период
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: to, required: true, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Данные }
 */
router.get('/universities', reportRateLimit, async (req, res, next) => {
  try {
    const q = z.object({
      from: z.string().date(),
      to: z.string().date(),
    }).parse(req.query);

    const items = await prisma.university.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: new Date(q.from), lte: new Date(q.to) },
      },
      include: { directionRef: true, productRef: true, managerRef: true, vendor: true },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, items);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /reports/dashboard-summary:
 *   get:
 *     tags: [Reports]
 *     summary: Сводка для дашборда (per-user кэш 60 сек)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Сводка }
 */
router.get('/dashboard-summary', reportRateLimit, async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) {
      return res.status(401).json({ ok: false, code: 'CRM-401-001', message: 'Unauthorized' });
    }

    // Per-user кэш (ТЗ п.4.13)
    const cached = await UserActivityService.cacheGet<Record<string, unknown>>(
      userId,
      'dashboard',
      'summary',
    );
    if (cached) return ok(res, cached);

    const [unis, tasks, interactions, contracts] = await Promise.all([
      prisma.university.count({ where: { deletedAt: null } }),
      prisma.task.count({
        where: { deletedAt: null, status: { notIn: ['Готово', 'Отменено'] } },
      }),
      prisma.interaction.count({ where: { deletedAt: null } }),
      prisma.contract.aggregate({
        where: { deletedAt: null, status: { in: ['Согласован', 'Подписан'] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const result = {
      universities: unis,
      openTasks: tasks,
      interactions,
      contracts: contracts._count,
      revenue: Number(contracts._sum.amount ?? 0),
    };

    await UserActivityService.cacheSet(userId, 'dashboard', 'summary', result, 60);

    return ok(res, result);
  } catch (e) { next(e); }
});

// ============================================================
// GET /reports/interactions.xlsx
// GET /reports/interactions.xls
// GET /reports/interactions.pdf
//
// Серверная генерация отчётов. Возвращает файл как поток.
// Query: from, to, directionId, productId, managerId, managerName,
//        universityId, status (статус ВУЗА), type (тип взаимодействия).
// ============================================================

const reportExportQuery = z.object({
  from: z.string().date(),
  to: z.string().date(),
  directionId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  managerName: z.string().max(200).optional(),
  universityId: z.string().uuid().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

router.get('/interactions.xlsx', reportRateLimit, async (req, res, next) => {
  try {
    const q = reportExportQuery.parse(req.query);
    const buf = await ReportsService.interactionsToXlsx(
      q,
      DEFAULT_INTERACTION_COLUMNS,
      'xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interactions-${q.from}_${q.to}.xlsx"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

router.get('/interactions.xls', reportRateLimit, async (req, res, next) => {
  try {
    const q = reportExportQuery.parse(req.query);
    // BIFF8 (xls) — ExcelJS отдаёт через bookType в writeBuffer
    const buf = await ReportsService.interactionsToXlsx(
      q,
      DEFAULT_INTERACTION_COLUMNS,
      'xls',
    );
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interactions-${q.from}_${q.to}.xls"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

router.get('/interactions.pdf', reportRateLimit, async (req, res, next) => {
  try {
    const q = reportExportQuery.parse(req.query);
    const buf = await ReportsService.interactionsToPdf(q, DEFAULT_INTERACTION_COLUMNS);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interactions-${q.from}_${q.to}.pdf"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

// Алиас «все колонки» — по кнопке «Экспорт со всеми колонками»
router.get('/interactions-full.xlsx', reportRateLimit, async (req, res, next) => {
  try {
    const q = reportExportQuery.parse(req.query);
    const buf = await ReportsService.interactionsToXlsx(
      q,
      ALL_INTERACTION_COLUMNS,
      'xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interactions-full-${q.from}_${q.to}.xlsx"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

router.get('/interactions-charts.pdf', reportRateLimit, async (req, res, next) => {
  try {
    const q = reportExportQuery.parse(req.query);
    const buf = await ReportsWithChartsService.interactionsWithChartsToPdf(q);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interactions-charts-${q.from}_${q.to}.pdf"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// GET /reports/full.json
//
// Полный JSON-отчёт по ТЗ п.6.4.
//
// ВАЖНО: userId БЕРЁТСЯ ИЗ ТОКЕНА, а не из query.
// Раньше клиент передавал ?userId=..., что открывало IDOR —
// можно было запросить чужой отчёт. Теперь:
//   - для nam — scope по managerRef/manager;
//   - для manager — вся воронка (как и раньше);
//   - для admin — всё + админ-разделы (auditLog, pdConsents, securityEvents).
//
// Период опционален: ?from=YYYY-MM-DD&to=YYYY-MM-DD.
// ============================================================
const fullReportQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

router.get('/full.json', reportRateLimit, async (req, res, next) => {
  try {
    const q = fullReportQuery.parse(req.query);
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({
        ok: false,
        code: 'CRM-401-001',
        message: 'Unauthorized',
      });
    }

    const report = await FullReportService.build(auth, q);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="crm-report-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return res.json(report);
  } catch (e) { next(e); }
});
// ============================================================
// GET /reports/universities.{xlsx,xls,pdf}
// ============================================================
const universitiesReportQuery = z.object({
  from: z.string().date(),
  to: z.string().date(),
  status: z.string().optional(),
});

router.get('/universities.xlsx', reportRateLimit, async (req, res, next) => {
  try {
    const q = universitiesReportQuery.parse(req.query);
    const buf = await ReportsService.universitiesToXlsx(q, 'xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="universities-${q.from}_${q.to}.xlsx"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

router.get('/universities.xls', reportRateLimit, async (req, res, next) => {
  try {
    const q = universitiesReportQuery.parse(req.query);
    const buf = await ReportsService.universitiesToXlsx(q, 'xls');
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="universities-${q.from}_${q.to}.xls"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});

router.get('/universities.pdf', reportRateLimit, async (req, res, next) => {
  try {
    const q = universitiesReportQuery.parse(req.query);
    const buf = await ReportsService.universitiesToPdf(q);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="universities-${q.from}_${q.to}.pdf"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
});
export default router;