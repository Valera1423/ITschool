// backend/src/services/learners-export.service.ts
import ExcelJS from 'exceljs';
import { prisma } from '../db/prisma.js';
import {
  PiiService,
  LEARNER_CONTACT_FIELDS,
  LEARNER_IDENTITY_FIELDS,
} from './pii.service.js';

const ALL = [...LEARNER_CONTACT_FIELDS, ...LEARNER_IDENTITY_FIELDS] as const;

export class LearnersExportService {
  static async fetchAll(filters: { search?: string } = {}) {
    const where = filters.search
      ? {
          OR: [
            {
              lastName: {
                contains: filters.search,
                mode: 'insensitive' as const,
              },
            },
            {
              firstName: {
                contains: filters.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const items = await prisma.learner.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50_000,
    });

    return items.map((l) =>
      PiiService.decryptFields(
        l as unknown as Record<string, unknown>,
        ALL as never,
      ) as unknown as Record<string, unknown>,
    );
  }

  static async toXlsx(filters: { search?: string } = {}): Promise<Buffer> {
    const rows = await this.fetchAll(filters);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ИТ Школа РТК · CRM';

    const ws = wb.addWorksheet('Слушатели');
    ws.columns = [
      { header: 'Фамилия', key: 'lastName', width: 22 },
      { header: 'Имя', key: 'firstName', width: 18 },
      { header: 'Отчество', key: 'middleName', width: 22 },
      { header: 'Телефон', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'СНИЛС', key: 'snils', width: 18 },
      { header: 'Серия паспорта', key: 'passportSeries', width: 14 },
      { header: 'Номер паспорта', key: 'passportNumber', width: 14 },
      { header: 'Кем выдан', key: 'passportIssuedBy', width: 40 },
      { header: 'Дата выдачи', key: 'passportIssuedAt', width: 14 },
      { header: 'Уровень образования', key: 'educationLevel', width: 30 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' },
    };

    rows.forEach((r) => ws.addRow(r));

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  static async toPdf(filters: { search?: string } = {}): Promise<Buffer> {
    const rows = await this.fetchAll(filters);
    const html = this.renderHtml(rows);
    return this.htmlToPdf(html);
  }

  private static renderHtml(rows: Record<string, unknown>[]): string {
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
    <title>Слушатели</title>
    <style>
      body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #0284c7; color: #fff; padding: 5px 6px; text-align: left; }
      td { padding: 4px 6px; border: 1px solid #e2e8f0; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
    </style></head><body>
    <h1>Слушатели курсов</h1>
    <p>Записей: ${rows.length}</p>
    <table>
      <thead><tr><th>ФИО</th><th>Телефон</th><th>Email</th><th>СНИЛС</th><th>Образование</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>
          <td>${esc(r.lastName)} ${esc(r.firstName)} ${esc(r.middleName ?? '')}</td>
          <td>${esc(r.phone)}</td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.snils)}</td>
          <td>${esc(r.educationLevel)}</td>
        </tr>`).join('')}
      </tbody>
    </table></body></html>`;
  }

  private static async htmlToPdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
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
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  }
}