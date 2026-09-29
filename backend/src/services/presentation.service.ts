import puppeteer, { type Browser } from 'puppeteer';
import { existsSync } from 'node:fs';
import { logger } from '../config/logger.js';
import { AnalyticsService } from './analytics.service.js';

/**
 * Поиск системного браузера на Windows.
 *
 * Мы НЕ скачиваем Chrome для puppeteer (это 150 МБ) — используем
 * либо указанный в PUPPETEER_EXECUTABLE_PATH, либо Edge/Chrome,
 * который обычно уже установлен в системе.
 */
function findSystemBrowser(): string | undefined {
  // 1. Явный путь из env
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ];
    for (const p of candidates) {
      if (p && existsSync(p)) return p;
    }
  }

  if (process.platform === 'linux') {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  return undefined;
}

export class PresentationService {
  private static browser: Browser | null = null;

  private static async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;

    const executablePath = findSystemBrowser();

    // eslint-disable-next-line no-console
    console.log('[presentation] executablePath =', executablePath ?? '(puppeteer default)');

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.browser.on('disconnected', () => {
      this.browser = null;
    });

    return this.browser;
  }

  static async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  static async generate(period: { from?: string; to?: string } = {}): Promise<Buffer> {
    const [abc, rfm, ltv, comparison, topRevenue] = await Promise.all([
      AnalyticsService.abcXyz(period.from, period.to),
      AnalyticsService.rfm(),
      AnalyticsService.ltv(),
      AnalyticsService.periodComparison({
        from:
          period.from ??
          new Date(new Date().setMonth(new Date().getMonth() - 1))
            .toISOString()
            .slice(0, 10),
        to: period.to ?? new Date().toISOString().slice(0, 10),
        prevFrom:
          new Date(new Date().setMonth(new Date().getMonth() - 2))
            .toISOString()
            .slice(0, 10),
        prevTo:
          new Date(new Date().setMonth(new Date().getMonth() - 1))
            .toISOString()
            .slice(0, 10),
      }),
      AnalyticsService.topByRevenue(10),
    ]);

    const safeAbc = Array.isArray(abc?.abcItems) ? abc.abcItems : [];
    const safeRfm = Array.isArray(rfm) ? rfm : [];
    const safeLtv = Array.isArray(ltv) ? ltv : [];
    const safeCmp = Array.isArray(comparison) ? comparison : [];
    const safeTop = Array.isArray(topRevenue) ? topRevenue : [];

    const totalRevenue = safeLtv.reduce((s, x) => s + x.lifetime_value, 0);
    const avgLtv = safeLtv.length ? totalRevenue / safeLtv.length : 0;

    const html = this.renderHtml({
      period,
      abc: safeAbc.slice(0, 15),
      rfm: this.rfmSummary(safeRfm),
      ltv: safeLtv.slice(0, 10),
      comparison: safeCmp,
      topRevenue: safeTop,
      totals: {
        revenue: totalRevenue,
        avgLtv,
        totalUnis: safeLtv.length,
        won: safeAbc.filter((a) => a.category === 'A').length,
      },
    });

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  }

  private static rfmSummary(rfm: { segment: string }[]) {
    const map: Record<string, number> = {};
    for (const r of rfm) map[r.segment] = (map[r.segment] ?? 0) + 1;
    return Object.entries(map)
      .map(([segment, count]) => ({
        segment,
        count,
        pct: rfm.length ? (count / rfm.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private static fmtMoney(n: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
  }

  private static esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static renderHtml(data: {
    period: { from?: string; to?: string };
    abc: { name: string; value: number; share: number; cumulative: number; category: string }[];
    rfm: { segment: string; count: number; pct: number }[];
    ltv: { name: string; manager: string; lifetime_value: number; win_rate?: number }[];
    comparison: { metric: string; current_value: number; previous_value: number; change_pct: number }[];
    topRevenue: { name: string; manager: string; revenue: number }[];
    totals: { revenue: number; avgLtv: number; totalUnis: number; won: number };
  }): string {
    const rfmLabels: Record<string, string> = {
      champions: 'Чемпионы',
      loyal: 'Лояльные',
      potential_loyalist: 'Перспективные',
      new: 'Новые',
      promising: 'Многообещающие',
      need_attention: 'Требуют внимания',
      about_to_sleep: 'Засыпают',
      at_risk: 'В зоне риска',
      cant_lose: 'Нельзя терять',
      hibernating: 'Спящие',
      lost: 'Потерянные',
    };

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>CRM — презентация для руководства</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; }
  .page { page-break-after: always; padding: 10mm 0; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #0369a1; }
  h2 { font-size: 20px; margin: 20px 0 12px; color: #0c4a6e; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; }
  .subtitle { font-size: 14px; color: #64748b; margin-bottom: 24px; }
  .meta { font-size: 10px; color: #94a3b8; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
  .kpi { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 12px; border-radius: 6px; }
  .kpi-label { font-size: 10px; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-value { font-size: 22px; font-weight: bold; color: #0c4a6e; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #0284c7; color: white; text-align: left; padding: 8px; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .positive { color: #059669; font-weight: 600; }
  .negative { color: #dc2626; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .badge-A { background: #dcfce7; color: #166534; }
  .badge-B { background: #fef3c7; color: #92400e; }
  .badge-C { background: #fee2e2; color: #991b1b; }
  .footer { position: fixed; bottom: 5mm; right: 10mm; font-size: 9px; color: #94a3b8; }
</style>
</head>
<body>

<div class="page">
  <h1>ИТ Школа Ростелеком · CRM</h1>
  <p class="subtitle">Аналитическая презентация для руководства</p>
  <p class="meta">
    Период: ${this.esc(data.period.from ?? 'всё время')} — ${this.esc(data.period.to ?? new Date().toISOString().slice(0, 10))}<br>
    Сгенерировано: ${this.esc(new Date().toLocaleString('ru-RU'))}
  </p>

  <h2>Ключевые показатели</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Суммарный LTV</div><div class="kpi-value">${this.fmtMoney(data.totals.revenue)}</div></div>
    <div class="kpi"><div class="kpi-label">Средний LTV</div><div class="kpi-value">${this.fmtMoney(data.totals.avgLtv)}</div></div>
    <div class="kpi"><div class="kpi-label">Вузов в базе</div><div class="kpi-value">${data.totals.totalUnis}</div></div>
    <div class="kpi"><div class="kpi-label">Категория A (топ)</div><div class="kpi-value">${data.totals.won}</div></div>
  </div>

  <h2>Сравнение периодов</h2>
  <table>
    <thead><tr><th>Метрика</th><th class="num">Текущий</th><th class="num">Предыдущий</th><th class="num">Изменение</th></tr></thead>
    <tbody>
      ${data.comparison.map((c) => `
        <tr>
          <td>${this.esc(c.metric)}</td>
          <td class="num">${c.current_value}</td>
          <td class="num">${c.previous_value}</td>
          <td class="num ${c.change_pct > 0 ? 'positive' : c.change_pct < 0 ? 'negative' : ''}">
            ${c.change_pct > 0 ? '+' : ''}${c.change_pct}%
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="page">
  <h2>ABC-анализ (топ-15 по выручке)</h2>
  <table>
    <thead><tr><th>#</th><th>Вуз</th><th class="num">Выручка</th><th class="num">Доля</th><th class="num">Кумулятивно</th><th>ABC</th></tr></thead>
    <tbody>
      ${data.abc.map((a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${this.esc(a.name)}</td>
          <td class="num">${this.fmtMoney(a.value)}</td>
          <td class="num">${a.share.toFixed(1)}%</td>
          <td class="num">${a.cumulative.toFixed(1)}%</td>
          <td><span class="badge badge-${this.esc(a.category)}">${this.esc(a.category)}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="page">
  <h2>RFM-сегментация</h2>
  <table>
    <thead><tr><th>Сегмент</th><th class="num">Вузов</th><th class="num">Доля</th></tr></thead>
    <tbody>
      ${data.rfm.map((r) => `
        <tr>
          <td>${this.esc(rfmLabels[r.segment] ?? r.segment)}</td>
          <td class="num">${r.count}</td>
          <td class="num">${r.pct.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Топ-10 по LTV</h2>
  <table>
    <thead><tr><th>#</th><th>Вуз</th><th>Менеджер</th><th class="num">LTV</th><th class="num">Win rate</th></tr></thead>
    <tbody>
      ${data.ltv.map((l, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${this.esc(l.name)}</td>
          <td>${this.esc(l.manager)}</td>
          <td class="num">${this.fmtMoney(l.lifetime_value)}</td>
          <td class="num">${l.win_rate ?? '—'}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="footer">ИТ Школа Ростелеком · CRM</div>
</body>
</html>`;
  }
}