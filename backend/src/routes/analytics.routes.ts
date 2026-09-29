// backend/src/routes/analytics.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsService } from '../services/analytics.service.js';
import { ChartRenderService } from '../services/chart-render.service.js';
import { ok } from '../utils/response.js';
import { reportRateLimit } from '../middleware/rateLimit.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

const analyticsGuard = [requirePermission('analytics.view'), reportRateLimit];

const periodQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const comparisonQuery = z.object({
  from: z.string().date(),
  to: z.string().date(),
  prevFrom: z.string().date(),
  prevTo: z.string().date(),
});

router.get('/abc-xyz', ...analyticsGuard, async (req, res, next) => {
  try {
    const q = periodQuery.parse(req.query);
    const result = await AnalyticsService.abcXyz(q.from, q.to);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/rfm', ...analyticsGuard, async (_req, res, next) => {
  try {
    const result = await AnalyticsService.rfm();
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/cohorts', ...analyticsGuard, async (req, res, next) => {
  try {
    const monthsBack = Math.min(36, Math.max(1, Number(req.query.monthsBack) || 12));
    const result = await AnalyticsService.cohorts(monthsBack);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/ltv', ...analyticsGuard, async (_req, res, next) => {
  try {
    const result = await AnalyticsService.ltv();
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/period-comparison', ...analyticsGuard, async (req, res, next) => {
  try {
    const q = comparisonQuery.parse(req.query);
    const result = await AnalyticsService.periodComparison(q);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/top-by-revenue', ...analyticsGuard, async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 10);
    const result = await AnalyticsService.topByRevenue(limit);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/manager-performance', ...analyticsGuard, async (req, res, next) => {
  try {
    const plan = Math.max(1, Number(req.query.plan) || 5);
    const result = await AnalyticsService.managerPerformance(plan);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/metrics', ...analyticsGuard, async (req, res, next) => {
  try {
    const q = periodQuery.parse(req.query);
    const result = await AnalyticsService.metrics(q.from, q.to);
    return ok(res, result);
  } catch (e) { next(e); }
});

// ============================================================
// POST /analytics/render-chart
//
// Серверный рендер диаграммы в PNG (fallback, если клиент не смог).
// Принимает декларативное описание графика, возвращает PNG.
//
// Кэш: браузерный рендер не бесплатный (~500 мс), но нам он нужен
// редко — только при сбое клиента. Кэшировать по хэшу spec — можно,
// но добавим позже; пока считаем, что сбои редки.
// ============================================================

const chartDatum = z.object({
  label: z.string().min(1).max(200),
  value: z.number().finite(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const chartSpecBody = z.object({
  spec: z.object({
    type: z.enum(['bar', 'line', 'pie', 'horizontal-bar']),
    title: z.string().min(1).max(200),
    categoryLabel: z.string().max(100).optional(),
    valueLabel: z.string().max(100).optional(),
    data: z.array(chartDatum).min(1).max(100),
  }),
  options: z
    .object({
      width: z.number().int().min(200).max(2400).optional(),
      height: z.number().int().min(200).max(2400).optional(),
      background: z
        .string()
        .regex(/^(#|rgb|hsl|white|transparent)/i)
        .optional(),
    })
    .optional(),
});

router.post('/render-chart', ...analyticsGuard, async (req, res, next) => {
  try {
    const body = chartSpecBody.parse(req.body);
    const png = await ChartRenderService.renderPng(body.spec, body.options ?? {});

    // Имя файла — из заголовка, безопасно
    const safeName = body.spec.title
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80) || 'chart';

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeName}.png"`,
    );
    res.end(png);
  } catch (e) {
    next(e);
  }
});

export default router;