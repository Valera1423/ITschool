// frontend/src/lib/pdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { University, Interaction, Task, Contract } from '@/types';

/**
 * Экспорт в PDF.
 *
 * ВАЖНО: jsPDF по умолчанию использует Helvetica, у которой нет
 * кириллицы → русский текст рендерится как "мусор" (С 7 K ? >...).
 * Мы подгружаем TTF (Noto Sans) один раз и регистрируем в jsPDF
 * под именем 'Noto'. Все вызовы doc.setFont('Noto') / headStyles.font
 * гарантируют корректную кириллицу.
 *
 * Файлы шрифтов лежат в /public/fonts/, доступны как
 *   /fonts/NotoSans-Regular.ttf
 *   /fonts/NotoSans-Bold.ttf
 */

const FONT_NAME = 'Noto';
const FONT_REGULAR = '/fonts/NotoSans-Regular.ttf';
const FONT_BOLD = '/fonts/NotoSans-Bold.ttf';

interface FontData {
  regular: string; // base64
  bold: string;    // base64
}

let fontCache: FontData | null = null;
let fontPromise: Promise<FontData> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт: ${url}`);
  const buf = await res.arrayBuffer();
  // Конвертация ArrayBuffer → base64 (через Uint8Array и btoa)
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

async function loadFonts(): Promise<FontData> {
  if (fontCache) return fontCache;
  if (fontPromise) return fontPromise;

  fontPromise = (async () => {
    const [regular, bold] = await Promise.all([
      fetchAsBase64(FONT_REGULAR),
      fetchAsBase64(FONT_BOLD),
    ]);
    fontCache = { regular, bold };
    return fontCache;
  })();

  return fontPromise;
}

/** Зарегистрировать Noto в документе jsPDF. */
async function registerFonts(doc: jsPDF): Promise<void> {
  try {
    const { regular, bold } = await loadFonts();

    doc.addFileToVFS('NotoSans-Regular.ttf', regular);
    doc.addFont('NotoSans-Regular.ttf', FONT_NAME, 'normal');

    doc.addFileToVFS('NotoSans-Bold.ttf', bold);
    doc.addFont('NotoSans-Bold.ttf', FONT_NAME, 'bold');

    doc.setFont(FONT_NAME, 'normal');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[pdf] Не удалось загрузить Noto Sans — кириллица будет кракозябрами. ' +
        'Положите TTF в /public/fonts/.',
      e,
    );
  }
}

// ============================================================
// ШАПКА И ПОДВАЛ
// ============================================================

interface PdfOptions {
  title: string;
  subtitle?: string;
}

async function buildHeader(doc: jsPDF, options: PdfOptions): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(14).setTextColor(20);
  doc.text('ИТ Школа Ростелеком', 14, 16);

  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(9).setTextColor(120);
  doc.text('CRM · Рабочее пространство', 14, 21);

  doc.setDrawColor(230).line(14, 28, pageWidth - 14, 28);

  doc.setTextColor(20).setFontSize(13).setFont(FONT_NAME, 'bold');
  doc.text(options.title, 14, 38);

  doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(120);
  doc.text(
    options.subtitle ?? `Сгенерировано ${new Date().toLocaleString('ru-RU')}`,
    14,
    43,
  );

  return 50;
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont(FONT_NAME, 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Стр. ${i} из ${pageCount}`, w - 14, h - 8, { align: 'right' });
  }
}

// ============================================================
// ОТЧЁТЫ
// ============================================================

export async function exportUniversitiesPdf(
  universities: University[],
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' });
  await registerFonts(doc);
  const startY = await buildHeader(doc, { title: 'Отчёт по вузам' });

  autoTable(doc, {
    startY,
    head: [
      [
        'Название',
        'Город',
        'Направление',
        'Продукт',
        'Лицензия',
        'Статус',
        'Передача',
        'Менеджер',
      ],
    ],
    body: universities.map((u) => [
      u.name,
      u.city,
      u.direction,
      u.product,
      u.license_signed ? 'Подписана' : 'Нет',
      u.status,
      u.handover_status ?? '—',
      u.manager,
    ]),
    styles: { font: FONT_NAME, fontSize: 8, cellPadding: 2 },
    headStyles: { font: FONT_NAME, fontStyle: 'bold', fillColor: [2, 132, 199], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`universities-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportInteractionsPdf(
  interactions: Interaction[],
  universities: University[],
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' });
  await registerFonts(doc);
  const startY = await buildHeader(doc, { title: 'Отчёт по взаимодействиям' });

  autoTable(doc, {
    startY,
    head: [['Дата', 'Тип', 'Название', 'Вуз', 'Статус', 'Менеджер']],
    body: interactions.map((i) => {
      const uni = universities.find((u) => u.id === i.university_id);
      return [
        i.interaction_date,
        i.type,
        i.title,
        uni?.name ?? '—',
        i.status,
        i.manager,
      ];
    }),
    styles: { font: FONT_NAME, fontSize: 8, cellPadding: 2 },
    headStyles: { font: FONT_NAME, fontStyle: 'bold', fillColor: [2, 132, 199], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`interactions-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportTasksPdf(tasks: Task[]): Promise<void> {
  const doc = new jsPDF();
  await registerFonts(doc);
  const startY = await buildHeader(doc, { title: 'Отчёт по задачам' });

  autoTable(doc, {
    startY,
    head: [['Задача', 'Срок', 'Приоритет', 'Статус', 'Ответственный']],
    body: tasks.map((t) => [t.title, t.due_date, t.priority, t.status, t.assignee]),
    styles: { font: FONT_NAME, fontSize: 8, cellPadding: 2 },
    headStyles: { font: FONT_NAME, fontStyle: 'bold', fillColor: [2, 132, 199], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`tasks-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportCustomReportPdf(
  title: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  filename: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' });
  await registerFonts(doc);
  const startY = await buildHeader(doc, { title });

  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? '—'))),
    styles: { font: FONT_NAME, fontSize: 8, cellPadding: 2 },
    headStyles: { font: FONT_NAME, fontStyle: 'bold', fillColor: [2, 132, 199], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`${filename}.pdf`);
}

export async function exportContractPdf(
  contract: Contract,
  university: University | undefined,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  await registerFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  const startY = await buildHeader(doc, {
    title: `Договор № ${contract.contract_number ?? '—'}`,
    subtitle: contract.title,
  });

  let y = startY;

  doc.setFontSize(11).setFont(FONT_NAME, 'bold').setTextColor(20);
  doc.text('Исполнитель', 14, y);
  doc.setFontSize(10).setFont(FONT_NAME, 'normal').setTextColor(60);
  y += 5;
  doc.text('ИТ Школа Ростелеком, г. Москва', 14, y);
  y += 8;

  doc.setFontSize(11).setFont(FONT_NAME, 'bold').setTextColor(20);
  doc.text('Заказчик', 14, y);
  doc.setFontSize(10).setFont(FONT_NAME, 'normal').setTextColor(60);
  y += 5;
  doc.text(
    university ? `${university.name}, г. ${university.city}` : 'Не указан',
    14,
    y,
  );
  if (university?.contact_name) {
    y += 5;
    doc.text(`Контакт: ${university.contact_name}`, 14, y);
  }
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [['Параметр', 'Значение']],
    body: [
      ['Номер договора', contract.contract_number ?? '—'],
      ['Название', contract.title],
      [
        'Сумма',
        `${new Intl.NumberFormat('ru-RU').format(contract.amount)} ${contract.currency}`,
      ],
      ['Дата создания', new Date(contract.created_at).toLocaleDateString('ru-RU')],
      [
        'Дата подписания',
        contract.signed_at
          ? new Date(contract.signed_at).toLocaleDateString('ru-RU')
          : '—',
      ],
      [
        'Срок действия',
        contract.expires_at
          ? new Date(contract.expires_at).toLocaleDateString('ru-RU')
          : '—',
      ],
      ['Статус', contract.status],
    ],
    styles: { font: FONT_NAME, fontSize: 10, cellPadding: 3 },
    headStyles: { font: FONT_NAME, fontStyle: 'bold', fillColor: [2, 132, 199], textColor: 255 },
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  doc.setFontSize(11).setFont(FONT_NAME, 'bold').setTextColor(20);
  doc.text('Подписи сторон', 14, y);
  y += 15;

  doc.setDrawColor(180);
  doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80);

  const colW = (pageWidth - 28 - 20) / 2;

  doc.line(14, y, 14 + colW, y);
  doc.text('Исполнитель', 14, y + 4);

  doc.line(14 + colW + 20, y, 14 + colW * 2 + 20, y);
  doc.text('Заказчик', 14 + colW + 20, y + 4);

  y += 20;
  doc.setFontSize(8).setTextColor(150);
  doc.text(
    `Сгенерировано ${new Date().toLocaleString('ru-RU')} · ИТ Школа Ростелеком CRM`,
    14,
    doc.internal.pageSize.getHeight() - 10,
  );

  doc.save(
    `contract-${contract.contract_number ?? contract.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}