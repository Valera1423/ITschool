// backend/src/services/chart-render.service.ts
import { logger } from '../config/logger.js';
import { AppError } from '../errors/codes.js';

export type ServerChartType = 'bar' | 'line' | 'pie' | 'horizontal-bar';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSpec {
  type: ServerChartType;
  title: string;
  categoryLabel?: string;
  valueLabel?: string;
  data: ChartDatum[];
}

export interface ChartRenderOptions {
  width?: number;
  height?: number;
  background?: string;
}

const PALETTE = [
  '#0284c7', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#ec4899',
];

/**
 * Рендер диаграммы в PNG.
 *
 * Используется как fallback, когда клиент не смог снять DOM
 * (Safari, огромные таблицы, CORS на картинках и т.п.).
 * Также полезно для формирования «официальной» картинки со
 * стабильными шрифтами (DejaVu Sans → полная поддержка кириллицы).
 *
 * Всё делается в одном browser-инстансе: устанавливаем HTML с ECharts
 * (не CDN — берём npm-пакет, чтобы работало офлайн), ждём события
 * 'chart-ready' и снимаем screenshot конкретного узла.
 */
export class ChartRenderService {
  static async renderPng(
    spec: ChartSpec,
    options: ChartRenderOptions = {},
  ): Promise<Buffer> {
    if (!spec.data || spec.data.length === 0) {
      throw new AppError('VALIDATION_FAILED', 400, {
        reason: 'spec.data пуст',
      });
    }

    const width = options.width ?? 900;
    const height = options.height ?? 500;
    const background = options.background ?? '#ffffff';

    // Ленивая загрузка: puppeteer тяжёлый, не держим на старте
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
      await page.setViewport({ width, height, deviceScaleFactor: 2 });

      const echartsUmd = await this.loadEChartsUmd();
      const html = this.buildHtml(spec, echartsUmd, width, height, background);

      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      // Ждём сигнал от страницы, что ECharts отрисовал график
      await page
        .waitForFunction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => (window as any).__chartReady === true,
          { timeout: 10_000 },
        )
        .catch(() => {
          logger.warn({ title: spec.title }, 'chart-ready не дождались, снимаем как есть');
        });

      const container = await page.$('#chart');
      if (!container) throw new AppError('INTERNAL_ERROR', 500);

      const png = await container.screenshot({
        type: 'png',
        omitBackground: false,
      });

      return Buffer.from(png);
    } finally {
      await browser.close().catch((e) => {
        logger.warn({ err: e }, 'puppeteer close failed');
      });
    }
  }

  // ----------------------------------------------------------
  // ECharts UMD — читаем из node_modules один раз и кешируем
  // ----------------------------------------------------------
  private static echartsCache: string | null = null;

  private static async loadEChartsUmd(): Promise<string> {
    if (this.echartsCache) return this.echartsCache;

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { createRequire } = await import('node:module');

    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve('echarts/dist/echarts.min.js');
    const code = await fs.readFile(path.resolve(pkgPath), 'utf8');
    this.echartsCache = code;
    return code;
  }

  // ----------------------------------------------------------
  // HTML + ECharts option
  // ----------------------------------------------------------
  private static buildHtml(
    spec: ChartSpec,
    echartsUmd: string,
    width: number,
    height: number,
    background: string,
  ): string {
    const option = this.buildOption(spec);
    const esc = (s: string) =>
      s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    width: ${width}px; height: ${height}px;
    background: ${background};
    font-family: 'DejaVu Sans', 'Noto Sans', Arial, sans-serif;
  }
  #chart {
    width: ${width}px; height: ${height}px;
    padding: 12px;
  }
</style>
</head>
<body>
  <div id="chart" data-title="${esc(spec.title)}"></div>
  <script>${echartsUmd}</script>
  <script>
    (function () {
      var option = ${JSON.stringify(option)};
      var el = document.getElementById('chart');
      var chart = echarts.init(el, null, { renderer: 'canvas' });
      chart.setOption(option);
      // Рисуем синхронно, потом выставляем флаг
      chart.on('finished', function () { window.__chartReady = true; });
      // Фолбэк, если событие не пришло — через 500 мс
      setTimeout(function () { window.__chartReady = true; }, 500);
    })();
  </script>
</body>
</html>`;
  }

  private static buildOption(spec: ChartSpec): Record<string, unknown> {
    const colors = spec.data.map(
      (d, i) => d.color ?? PALETTE[i % PALETTE.length],
    );

    const baseTitle = {
      text: spec.title,
      left: 12,
      top: 8,
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#0f172a',
      },
    };

    if (spec.type === 'pie') {
      return {
        title: baseTitle,
        tooltip: { trigger: 'item' },
        legend: { bottom: 8, type: 'scroll' },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#fff',
              borderWidth: 2,
            },
            label: {
              formatter: '{b}: {c} ({d}%)',
              fontSize: 12,
              color: '#334155',
            },
            data: spec.data.map((d) => ({
              name: d.label,
              value: d.value,
            })),
          },
        ],
        color: colors,
      };
    }

    const isHorizontal = spec.type === 'horizontal-bar';
    const categoryAxis = {
      type: 'category',
      data: spec.data.map((d) => d.label),
      name: spec.categoryLabel ?? '',
      axisLabel: { fontSize: 11, color: '#475569', interval: 0 },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    };
    const valueAxis = {
      type: 'value',
      name: spec.valueLabel ?? '',
      axisLabel: { fontSize: 11, color: '#475569' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    };

    const series =
      spec.type === 'line'
        ? {
            type: 'line',
            smooth: true,
            symbolSize: 8,
            lineStyle: { width: 3, color: PALETTE[0] },
            itemStyle: { color: PALETTE[0] },
            areaStyle: { opacity: 0.15, color: PALETTE[0] },
            data: spec.data.map((d) => d.value),
          }
        : {
            type: 'bar',
            barMaxWidth: 48,
            itemStyle: {
              borderRadius: isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0],
              color: (p: { dataIndex: number }) =>
                colors[p.dataIndex] ?? PALETTE[0],
            },
            data: spec.data.map((d) => d.value),
          };

    return {
      title: baseTitle,
      grid: { left: 60, right: 30, top: 60, bottom: 50, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: isHorizontal ? valueAxis : categoryAxis,
      yAxis: isHorizontal ? categoryAxis : valueAxis,
      series: [series],
    };
  }
}