// backend/src/services/reports-with-charts.service.ts
import { AnalyticsService } from './analytics.service.js';
import { ChartRenderService, type ChartSpec } from './chart-render.service.js';
import { ReportsService } from './reports.service.js';
import { logger } from '../config/logger.js';

/**
 * Расширенный отчёт «Взаимодействия + диаграммы» в PDF.
 *
 * Что делает:
 *  1. Забирает данные отчёта (как ReportsService.interactionsToPdf)
 *  2. Дополнительно строит 4 диаграммы через ChartRenderService:
 *      - Взаимодействия по типам (pie)
 *      - Топ-10 вузов по количеству (bar)
 *      - Распределение по статусам (horizontal-bar)
 *      - Динамика по месяцам (line)
 *  3. Встраивает диаграммы в HTML как base64 img
 *  4. Возвращает PDF
 *
 * Отдельный сервис — чтобы не раздувать ReportsService.
 * Тяжёлые вызовы (Puppeteer + Chromium) — один browser-инстанс.
 */
export class ReportsWithChartsService {
  static async interactionsWithChartsToPdf(
    filters: {
      from: string;
      to: string;
      directionId?: string;
      productId?: string;
      managerId?: string;
      universityId?: string;
      status?: string;
      type?: string;
    },
  ): Promise<Buffer> {
    const started = Date.now();

    // 1. Данные
    const rows = await ReportsService.fetchInteractions(filters);
    logger.info({ rows: rows.length }, '[report+charts] fetched');

    // 2. Собираем диаграммы
    const specs = this.buildChartSpecs(rows);

    // 3. Рендерим все PNG одним browser-инстансом
    const charts = await ChartRenderService.renderManyAsBase64(specs, {
      width: 800,
      height: 400,
    });

    logger.info(
      { count: charts.size, ms: Date.now() - started },
      '[report+charts] charts rendered',
    );

    // 4. Встраиваем в HTML
    const html = this.renderHtmlWithCharts(rows, filters, charts);

    // 5. PDF
    return this.htmlToPdf(html);
  }

  // ==========================================================
  // Диаграммы
  // ==========================================================
  private static buildChartSpecs(
    rows: Awaited<ReturnType<typeof ReportsService.fetchInteractions>>,
  ): ChartSpec[] {
    const specs: ChartSpec[] = [];

    // --- 1. По типам (pie)
    const byType = new Map<string, number>();
    for (const r of rows) {
      byType.set(r.interaction_type, (byType.get(r.interaction_type) ?? 0) + 1);
    }
    if (byType.size > 0) {
      specs.push({
        type: 'pie',
        title: 'Взаимодействия по типам',
        data: [...byType.entries()].map(([label, value]) => ({ label, value })),
      });
    }

    // --- 2. Топ-10 вузов (bar)
    const byUni = new Map<string, number>();
    for (const r of rows) {
      byUni.set(r.university_name, (byUni.get(r.university_name) ?? 0) + 1);
    }
    const topUnis = [...byUni.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (topUnis.length > 0) {
      specs.push({
        type: 'bar',
        title: 'Топ-10 вузов по количеству взаимодействий',
        categoryLabel: 'Вуз',
        valueLabel: 'Кол-во',
        data: topUnis.map(([label, value]) => ({ label, value })),
      });
    }

    // --- 3. По статусам вузов (horizontal-bar)
    const byStatus = new Map<string, number>();
    for (const r of rows) {
      byStatus.set(r.university_status, (byStatus.get(r.university_status) ?? 0) + 1);
    }
    if (byStatus.size > 0) {
      specs.push({
        type: 'horizontal-bar',
        title: 'Взаимодействия по статусам вузов',
        categoryLabel: 'Статус',
        valueLabel: 'Кол-во',
        data: [...byStatus.entries()].map(([label, value]) => ({ label, value })),
      });
    }

    // --- 4. Динамика по месяцам (line)
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const month = r.interaction_date.slice(0, 7); // YYYY-MM
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    if (byMonth.size > 1) {
      specs.push({
        type: 'line',
        title: 'Динамика взаимодействий по месяцам',
        categoryLabel: 'Месяц',
        valueLabel: 'Кол-во',
        data: [...byMonth.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, value]) => ({ label, value })),
      });
    }

    return specs;
  }

  // ==========================================================
  // HTML
  // ==========================================================
  private static renderHtmlWithCharts(
    rows: Awaited<ReturnType<typeof ReportsService.fetchInteractions>>,
    filters: { from: string; to: string },
    charts: Map<string, string>,
  ): string {
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const thead = `
      <th>Дата</th>
      <th>Тип</th>
      <th>Вуз</th>
      <th>Направление</th>
      <th>Продукт</th>
      <th>Статус</th>
      <th>Ответственный</th>`;

    const tbody = rows
      .map(
        (r) => `
      <tr>
        <td>${esc(r.interaction_date)}</td>
        <td>${esc(r.interaction_type)}</td>
        <td>${esc(r.university_name)}</td>
        <td>${esc(r.direction_name ?? '—')}</td>
        <td>${esc(r.product_name ?? '—')}</td>
        <td>${esc(r.university_status)}</td>
        <td>${esc(r.manager_name)}</td>
      </tr>`,
      )
      .join('');

    // Диаграммы — по 2 в ряд
    const chartsHtml = [...charts.entries()]
      .map(
        ([title, b64]) => `
        <div class="chart">
          <img src="${b64}" alt="${esc(title)}" />
        </div>`,
      )
      .join('');

    const generatedAt = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
    });

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Отчёт по взаимодействиям</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'DejaVu Sans', 'Noto Sans', Arial, sans-serif;
    font-size: 10px; color: #0f172a;
  }
  header {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 8px; margin-bottom: 10px;
  }
  header .brand { font-size: 12px; font-weight: 600; color: #0369a1; }
  header .sub { font-size: 9px; color: #64748b; }
  h1 { font-size: 14px; margin: 6px 0 2px 0; }
  h2 { font-size: 12px; color: #0c4a6e; margin: 16px 0 8px 0; page-break-after: avoid; }
  .period { font-size: 9px; color: #64748b; margin-bottom: 10px; }
  .charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .chart {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    background: #f8fafc;
  }
  .chart img { width: 100%; height: auto; display: block; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #0284c7; color: #fff; font-weight: 600;
    text-align: left; padding: 5px 6px; font-size: 9px;
    border: 1px solid #0369a1;
  }
  td {
    padding: 4px 6px; border: 1px solid #e2e8f0;
    vertical-align: top; word-wrap: break-word;
    overflow-wrap: anywhere; font-size: 9px;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  footer { margin-top: 8px; font-size: 8px; color: #94a3b8; text-align: right; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">ИТ Школа Ростелеком · CRM</div>
      <div class="sub">Отчёт по взаимодействиям с диаграммами</div>
    </div>
    <div class="sub">Сформировано: ${esc(generatedAt)}</div>
  </header>

  <h1>Взаимодействия с вузами за период</h1>
  <div class="period">
    Период: ${esc(filters.from)} — ${esc(filters.to)} · Записей: ${rows.length}
  </div>

  ${charts.size > 0 ? `<h2>Диаграммы</h2><div class="charts">${chartsHtml}</div>` : ''}

  <h2>Данные</h2>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody || `<tr><td colspan="7">Нет данных за период</td></tr>`}</tbody>
  </table>

  <footer>Стр. <span class="pageNumber"></span> из <span class="totalPages"></span></footer>
</body>
</html>`;
  }

  // ==========================================================
  // PDF (то же, что в ReportsService, но экспортируем отдельно)
  // ==========================================================
  private static async htmlToPdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:8px;color:#94a3b8;text-align:right;">
            Стр. <span class="pageNumber"></span> из <span class="totalPages"></span>
          </div>`,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  }
}