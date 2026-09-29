// backend/src/services/reports.service.ts
import ExcelJS from 'exceljs';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

// ============================================================
// ТИПЫ
// ============================================================

export interface InteractionReportFilters {
  from: string;
  to: string;
  directionId?: string;
  productId?: string;
  managerId?: string;
  universityId?: string;
  status?: string;
  type?: string;
}

export interface InteractionReportRow {
  interaction_id: string;
  interaction_date: string;
  interaction_type: string;
  interaction_status: string;
  interaction_title: string;

  university_id: string;
  university_name: string;
  university_status: string;
  direction_name: string | null;
  product_name: string | null;
  manager_name: string;

  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;

  details: string | null;
}

export type InteractionReportColumnKey =
  | 'interaction_date'
  | 'interaction_type'
  | 'interaction_status'
  | 'interaction_title'
  | 'university_name'
  | 'university_status'
  | 'direction_name'
  | 'product_name'
  | 'manager_name'
  | 'contact_name'
  | 'contact_email'
  | 'contact_phone'
  | 'city'
  | 'details';

export interface InteractionReportColumn {
  key: InteractionReportColumnKey;
  label: string;
  width?: number;
}

// ============================================================
// ДЕФОЛТНЫЕ КОЛОНКИ (ТЗ п.4.4)
// ============================================================
export const DEFAULT_INTERACTION_COLUMNS: InteractionReportColumn[] = [
  { key: 'interaction_date',  label: 'Дата',                 width: 12 },
  { key: 'interaction_type',  label: 'Тип',                  width: 14 },
  { key: 'university_name',   label: 'Вуз',                  width: 32 },
  { key: 'direction_name',    label: 'ИТ-направление',       width: 20 },
  { key: 'product_name',      label: 'ИТ-продукт',           width: 22 },
  { key: 'university_status', label: 'Статус работы с вузом', width: 18 },
  { key: 'manager_name',      label: 'Ответственный',        width: 20 },
];

export const ALL_INTERACTION_COLUMNS: InteractionReportColumn[] = [
  ...DEFAULT_INTERACTION_COLUMNS,
  { key: 'interaction_status', label: 'Статус взаимодействия', width: 18 },
  { key: 'interaction_title',  label: 'Название',              width: 30 },
  { key: 'contact_name',       label: 'Контакт',               width: 22 },
  { key: 'contact_email',      label: 'Email',                 width: 26 },
  { key: 'contact_phone',      label: 'Телефон',               width: 18 },
  { key: 'city',               label: 'Город',                 width: 16 },
  { key: 'details',            label: 'Детали',                width: 40 },
];

// ============================================================
// UNIVERSITIES REPORT
// ============================================================

export interface UniversityReportRow {
  name: string;
  city: string;
  status: string;
  handover_status: string;
  direction_name: string;
  product_name: string;
  manager_name: string;
  license_signed: boolean;
  license_expires_at: string;
  contract_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

// ============================================================
// СЕРВИС
// ============================================================

export class ReportsService {
  // ==========================================================
  // FETCH INTERACTIONS
  // ==========================================================
  static async fetchInteractions(
    filters: InteractionReportFilters,
  ): Promise<InteractionReportRow[]> {
    const where: Record<string, unknown> = {
      deletedAt: null,
      interactionDate: {
        gte: new Date(filters.from),
        lte: new Date(filters.to),
      },
    };
    if (filters.type) where.type = filters.type;
    if (filters.universityId) where.universityId = filters.universityId;

    const universityWhere: Record<string, unknown> = { deletedAt: null };
    if (filters.directionId) universityWhere.directionId = filters.directionId;
    if (filters.productId) universityWhere.productId = filters.productId;
    if (filters.managerId) universityWhere.managerId = filters.managerId;
    if (filters.status) universityWhere.status = filters.status;

    if (Object.keys(universityWhere).length > 1) {
      where.university = universityWhere;
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
      take: 50_000,
    });

    return items.map((i) => ({
      interaction_id: i.id,
      interaction_date: i.interactionDate.toISOString().slice(0, 10),
      interaction_type: i.type,
      interaction_status: i.status,
      interaction_title: i.title,

      university_id: i.university.id,
      university_name: i.university.name,
      university_status: i.university.status,
      direction_name:
        i.university.directionRef?.name ?? i.university.direction ?? null,
      product_name:
        i.university.productRef?.name ?? i.university.product ?? null,
      manager_name: i.university.managerRef?.fullName ?? i.manager,

      contact_name: i.university.contactName,
      contact_email: i.university.contactEmail,
      contact_phone: i.university.contactPhone,
      city: i.university.city,
      details: i.details,
    }));
  }

  // ==========================================================
  // INTERACTIONS → XLSX / XLS
  // ==========================================================
  static async interactionsToXlsx(
    filters: InteractionReportFilters,
    columns: InteractionReportColumn[] = DEFAULT_INTERACTION_COLUMNS,
    bookType: 'xlsx' | 'xls' = 'xlsx',
  ): Promise<Buffer> {
    const rows = await this.fetchInteractions(filters);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ИТ Школа РТК · CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet('Взаимодействия', {
      views: [{ state: 'frozen', ySplit: 2 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    ws.mergeCells(1, 1, 1, columns.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `Отчёт по взаимодействиям: ${filters.from} — ${filters.to}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF0C4A6E' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 22;

    ws.getRow(2).values = columns.map((c) => c.label);
    const headerRow = ws.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0284C7' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    ws.columns = columns.map((c) => ({ width: c.width ?? 20 }));

    rows.forEach((row, idx) => {
      const r = ws.addRow(columns.map((c) => row[c.key] ?? ''));
      if (idx % 2 === 1) {
        r.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
      r.eachCell((cell) => {
        cell.alignment = { vertical: 'top', horizontal: 'left' };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    const lastRow = 2 + rows.length;
    if (rows.length > 0) {
      ws.autoFilter = {
        from: { row: 2, column: 1 },
        to:   { row: lastRow, column: columns.length },
      };
    }

    const meta = wb.addWorksheet('Метаданные');
    meta.columns = [
      { header: 'Параметр', key: 'k', width: 30 },
      { header: 'Значение', key: 'v', width: 50 },
    ];
    meta.getRow(1).font = { bold: true };
    meta.addRows([
      { k: 'Отчёт',        v: 'Взаимодействия за период' },
      { k: 'Период с',     v: filters.from },
      { k: 'Период по',    v: filters.to },
      { k: 'Строк',        v: rows.length },
      { k: 'Сформирован',  v: new Date().toLocaleString('ru-RU') },
      { k: 'Пользователь', v: 'CRM ИТ Школы РТК' },
    ]);

    const buf = await wb.xlsx.writeBuffer();
    void bookType;
    return Buffer.from(buf as ArrayBuffer);
  }

  // ==========================================================
  // INTERACTIONS → PDF
  // ==========================================================
  static async interactionsToPdf(
    filters: InteractionReportFilters,
    columns: InteractionReportColumn[] = DEFAULT_INTERACTION_COLUMNS,
  ): Promise<Buffer> {
    const rows = await this.fetchInteractions(filters);
    const html = this.renderInteractionsHtml(rows, columns, filters);
    return this.htmlToPdf(html);
  }

  private static renderInteractionsHtml(
    rows: InteractionReportRow[],
    columns: InteractionReportColumn[],
    filters: InteractionReportFilters,
  ): string {
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const thead = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');

    const tbody = rows
      .map((row) => {
        const tds = columns
          .map((c) => `<td>${esc(row[c.key])}</td>`)
          .join('');
        return `<tr>${tds}</tr>`;
      })
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
    margin: 0;
    padding: 0;
    font-family: 'DejaVu Sans', 'Noto Sans', Arial, sans-serif;
    font-size: 10px;
    color: #0f172a;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  header .brand {
    font-size: 12px;
    font-weight: 600;
    color: #0369a1;
  }
  header .sub {
    font-size: 9px;
    color: #64748b;
  }
  h1 {
    font-size: 14px;
    margin: 6px 0 2px 0;
  }
  .period {
    font-size: 9px;
    color: #64748b;
    margin-bottom: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    background: #0284c7;
    color: #fff;
    font-weight: 600;
    text-align: left;
    padding: 5px 6px;
    font-size: 9px;
    border: 1px solid #0369a1;
  }
  td {
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    font-size: 9px;
  }
  tbody tr:nth-child(even) td {
    background: #f8fafc;
  }
  footer {
    margin-top: 8px;
    font-size: 8px;
    color: #94a3b8;
    text-align: right;
  }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">ИТ Школа Ростелеком · CRM</div>
      <div class="sub">Отчёт по взаимодействиям</div>
    </div>
    <div class="sub">Сформировано: ${esc(generatedAt)}</div>
  </header>

  <h1>Взаимодействия с вузами за период</h1>
  <div class="period">Период: ${esc(filters.from)} — ${esc(filters.to)} · Записей: ${rows.length}</div>

  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody || '<tr><td colspan="' + columns.length + '">Нет данных за период</td></tr>'}</tbody>
  </table>

  <footer>
    Стр. <span class="pageNumber"></span> из <span class="totalPages"></span>
  </footer>
</body>
</html>`;
  }

  // ==========================================================
  // UNIVERSITIES REPORT
  // ==========================================================
  static async fetchUniversities(filters: {
    from: string;
    to: string;
    status?: string;
  }): Promise<UniversityReportRow[]> {
    const where: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: new Date(filters.from), lte: new Date(filters.to) },
    };
    if (filters.status) where.status = filters.status;

    const items = await prisma.university.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
        directionRef: true,
        productRef: true,
        managerRef: true,
      },
      take: 50_000,
    });

    return items.map((u) => ({
      name: u.name,
      city: u.city,
      status: u.status,
      handover_status: u.handoverStatus ?? 'Не передан',
      direction_name: u.directionRef?.name ?? u.direction,
      product_name: u.productRef?.name ?? u.product,
      manager_name: u.managerRef?.fullName ?? u.manager,
      license_signed: u.licenseSigned,
      license_expires_at: u.licenseExpiresAt
        ? u.licenseExpiresAt.toISOString().slice(0, 10)
        : '',
      contract_number: u.contractNumber ?? '',
      contact_name: u.contactName ?? '',
      contact_email: u.contactEmail ?? '',
      contact_phone: u.contactPhone ?? '',
    }));
  }

  static async universitiesToXlsx(
    filters: { from: string; to: string; status?: string },
    bookType: 'xlsx' | 'xls' = 'xlsx',
  ): Promise<Buffer> {
    const rows = await this.fetchUniversities(filters);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ИТ Школа РТК · CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet('Вузы', {
      views: [{ state: 'frozen', ySplit: 2 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    ws.mergeCells(1, 1, 1, 13);
    const title = ws.getCell(1, 1);
    title.value = `Отчёт по вузам: ${filters.from} — ${filters.to}`;
    title.font = { bold: true, size: 13, color: { argb: 'FF0C4A6E' } };
    ws.getRow(1).height = 22;

    ws.getRow(2).values = [
      'Название', 'Город', 'Статус', 'Передача ПО',
      'ИТ-направление', 'ИТ-продукт', 'Ответственный',
      'Лицензия', 'Срок лицензии', 'Договор',
      'Контакт', 'Email', 'Телефон',
    ];
    const hdr = ws.getRow(2);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.eachCell((c) => {
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0284C7' },
      };
    });

    ws.columns = [
      { width: 40 }, { width: 18 }, { width: 16 }, { width: 20 },
      { width: 24 }, { width: 24 }, { width: 22 },
      { width: 12 }, { width: 14 }, { width: 16 },
      { width: 22 }, { width: 26 }, { width: 18 },
    ];

    rows.forEach((r, idx) => {
      const row = ws.addRow([
        r.name, r.city, r.status, r.handover_status,
        r.direction_name, r.product_name, r.manager_name,
        r.license_signed ? 'да' : 'нет',
        r.license_expires_at, r.contract_number,
        r.contact_name, r.contact_email, r.contact_phone,
      ]);
      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    });

    if (rows.length > 0) {
      ws.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: 2 + rows.length, column: 13 },
      };
    }

    const buf = await wb.xlsx.writeBuffer();
    void bookType;
    return Buffer.from(buf as ArrayBuffer);
  }

  static async universitiesToPdf(filters: {
    from: string;
    to: string;
    status?: string;
  }): Promise<Buffer> {
    const rows = await this.fetchUniversities(filters);
    const html = this.renderUniversitiesHtml(rows, filters);
    return this.htmlToPdf(html);
  }

  private static renderUniversitiesHtml(
    rows: UniversityReportRow[],
    filters: { from: string; to: string },
  ): string {
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const generatedAt = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
    });

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Отчёт по вузам</title>
<style>
  html, body {
    margin: 0; padding: 0;
    font-family: 'DejaVu Sans', Arial, sans-serif;
    font-size: 10px; color: #0f172a;
  }
  header {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px;
  }
  .brand { font-size: 12px; font-weight: 600; color: #0369a1; }
  .sub { font-size: 9px; color: #64748b; }
  h1 { font-size: 14px; margin: 6px 0 2px 0; }
  .period { font-size: 9px; color: #64748b; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #0284c7; color: #fff; font-weight: 600;
    text-align: left; padding: 5px 6px; font-size: 9px;
    border: 1px solid #0369a1;
  }
  td {
    padding: 4px 6px; border: 1px solid #e2e8f0;
    vertical-align: top; word-wrap: break-word; font-size: 9px;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">ИТ Школа Ростелеком · CRM</div>
      <div class="sub">Отчёт по вузам</div>
    </div>
    <div class="sub">Сформировано: ${esc(generatedAt)}</div>
  </header>
  <h1>Вузы за период</h1>
  <div class="period">Период: ${esc(filters.from)} — ${esc(filters.to)} · Записей: ${rows.length}</div>
  <table>
    <thead><tr>
      <th>Название</th><th>Город</th><th>Статус</th><th>Передача</th>
      <th>Направление</th><th>Продукт</th><th>Ответственный</th>
    </tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.city)}</td>
        <td>${esc(r.status)}</td>
        <td>${esc(r.handover_status)}</td>
        <td>${esc(r.direction_name)}</td>
        <td>${esc(r.product_name)}</td>
        <td>${esc(r.manager_name)}</td>
      </tr>`).join('') || '<tr><td colspan="7">Нет данных</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }

  // ==========================================================
  // HTML → PDF через puppeteer
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
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

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
      await browser.close().catch((e) => {
        logger.warn({ err: e }, 'puppeteer close failed');
      });
    }
  }
}