// frontend/src/lib/chartExport.ts
import { toPng } from 'html-to-image';
import { ERROR_CODES } from './errorCodes';
import { logError } from './errorHandler';
import { logger } from './logger';
import { triggerDownload } from './utils';

/**
 * Экспорт диаграмм и элементов в PNG / PDF.
 * Использует html-to-image — работает с SVG, Tailwind, тёмной темой.
 *
 * PDF: заголовки на кириллице требуют TTF. Подгружаем Noto Sans
 * так же, как в lib/pdf.ts, чтобы избежать кракозябр.
 */

const FONT_NAME = 'Noto';
const FONT_REGULAR = '/fonts/NotoSans-Regular.ttf';
const FONT_BOLD = '/fonts/NotoSans-Bold.ttf';

let fontCache: { regular: string; bold: string } | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  return btoa(binary);
}

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetchAsBase64(FONT_REGULAR),
    fetchAsBase64(FONT_BOLD),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

// ============================================================
// PNG
// ============================================================

export async function exportElementToPng(
  element: HTMLElement,
  filename: string,
  options: { scale?: number; background?: string } = {},
): Promise<boolean> {
  const { scale = 2, background = 'white' } = options;

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: scale,
      backgroundColor: background,
      cacheBust: true,
      skipFonts: false,
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    triggerDownload(blob, `${filename}.png`);
    return true;
  } catch (e) {
    void logError({
      code: ERROR_CODES.CHART_RENDER_FAILED,
      message: e instanceof Error ? e.message : 'Ошибка отрисовки',
      context: { filename },
    });
    return false;
  }
}

// ============================================================
// PDF (несколько диаграмм подряд)
// ============================================================

export async function exportElementsToPdf(
  elements: { element: HTMLElement; title: string }[],
  filename: string,
): Promise<boolean> {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Регистрируем шрифт
    try {
      const { regular, bold } = await loadFonts();
      doc.addFileToVFS('NotoSans-Regular.ttf', regular);
      doc.addFont('NotoSans-Regular.ttf', FONT_NAME, 'normal');
      doc.addFileToVFS('NotoSans-Bold.ttf', bold);
      doc.addFont('NotoSans-Bold.ttf', FONT_NAME, 'bold');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[chartExport] Шрифт не загружен, кириллица будет мусором', e);
    }

    for (let i = 0; i < elements.length; i++) {
      const { element, title } = elements[i];

      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: 'white',
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      if (i > 0) doc.addPage();

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;

      doc.setFontSize(14);
      doc.setFont(FONT_NAME, 'bold');
      doc.setTextColor(20);
      doc.text(title, margin, margin);

      doc.setFontSize(9);
      doc.setFont(FONT_NAME, 'normal');
      doc.setTextColor(120);
      doc.text(
        `Сгенерировано ${new Date().toLocaleString('ru-RU')}`,
        margin,
        margin + 5,
      );
      doc.setTextColor(0);

      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2 - 15;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      doc.addImage(dataUrl, 'PNG', margin, margin + 10, w, h);
    }

    const blob = doc.output('blob');
    triggerDownload(blob, `${filename}.pdf`);
    return true;
  } catch (e) {
    void logError({
      code: ERROR_CODES.CHART_RENDER_FAILED,
      message: e instanceof Error ? e.message : 'Ошибка PDF',
      context: { filename },
    });
    return false;
  }
}

// ============================================================
// СЕРВЕРНЫЙ FALLBACK
// ============================================================

/**
 * Тип диаграммы для серверного рендера.
 * Соответствует тому, что умеет backend/src/services/chart-render.service.ts.
 */
export type ServerChartType = 'bar' | 'line' | 'pie' | 'horizontal-bar';

export interface ServerChartSpec {
  type: ServerChartType;
  title: string;
  /** Подпись оси X (для bar/line) или имя серии (для pie). */
  categoryLabel?: string;
  /** Подпись оси Y. */
  valueLabel?: string;
  /** Данные: одна серия. Для stacked — пока не поддерживаем. */
  data: { label: string; value: number; color?: string }[];
}

export interface ServerChartOptions {
  width?: number;
  height?: number;
  background?: string;
}

/**
 * Отрендерить диаграмму на сервере (puppeteer + ECharts) и скачать PNG.
 *
 * Используется как fallback, если html-to-image не справился:
 *   - элемент слишком большой,
 *   - проблема с CORS на встроенных картинках/шрифтах,
 *   - Safari/iOS рендерит пустое полотно,
 *   - требуется единый стиль для печати и презентаций.
 *
 * Возвращает true, если удалось.
 */
export async function renderChartOnServer(
  spec: ServerChartSpec,
  filename: string,
  options: ServerChartOptions = {},
): Promise<boolean> {
  try {
    const { userManager } = await import('./oidc');
    const user = await userManager.getUser();
    if (!user || user.expired) {
      logger.warn('renderChartOnServer: нет активной сессии');
      return false;
    }

    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
    const res = await fetch(`${apiBase}/analytics/render-chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.access_token}`,
      },
      body: JSON.stringify({ spec, options }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn(`renderChartOnServer: HTTP ${res.status}: ${text.slice(0, 200)}`);
      return false;
    }

    const blob = await res.blob();
    triggerDownload(blob, `${filename}.png`);
    return true;
  } catch (e) {
    void logError({
      code: ERROR_CODES.CHART_RENDER_FAILED,
      message: e instanceof Error ? e.message : 'Серверный рендер не удался',
      context: { filename, type: spec.type },
    });
    return false;
  }
}

export { downloadJson } from './utils';