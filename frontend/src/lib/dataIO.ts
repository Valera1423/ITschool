import type { University } from '@/types';
import { downloadCSV } from './utils';

/**
 * Импорт/экспорт вузов в CSV.
 * Используется для быстрого обмена с Excel и для шаблонов.
 */

export const UNIVERSITIES_CSV_HEADERS = [
  'Название',
  'Город',
  'Направление',
  'Продукт',
  'Номер договора',
  'Лицензия подписана',
  'Срок лицензии',
  'Статус',
  'Статус передачи',
  'Менеджер',
  'Контактное лицо',
  'Email',
  'Телефон',
  'Telegram',
  'WhatsApp',
  'MAX',
  'Ответственные от ВУЗа',
  'Заметки',
] as const;

/** Преобразовать вузы в строки для CSV. */
export function universitiesToRows(universities: University[]): string[][] {
  return universities.map((u) => [
    u.name,
    u.city,
    u.direction,
    u.product,
    u.contract_number ?? '',
    u.license_signed ? 'да' : 'нет',
    u.license_expires_at ?? '',
    u.status,
    u.handover_status ?? 'Не передан',
    u.manager,
    u.contact_name ?? '',
    u.contact_email ?? '',
    u.contact_phone ?? '',
    u.telegram ?? '',
    u.whatsapp ?? '',
    u.max_messenger ?? '',
    // Множественные контакты в одну строку
    (u.contacts ?? [])
      .map((c) => {
        const parts = [c.full_name];
        if (c.email) parts.push(`<${c.email}>`);
        if (c.phone) parts.push(c.phone);
        return parts.join(' ');
      })
      .join('; '),
    (u.notes ?? '').replace(/\r?\n/g, ' '),
  ]);
}

/** Скачать CSV-шаблон для импорта. */
export function downloadUniversitiesTemplate(): void {
  downloadCSV('universities-template.csv', [
    [...UNIVERSITIES_CSV_HEADERS],
    [
      'МФТИ',
      'Долгопрудный',
      'Аналитика данных',
      'Ростелеком DataLab',
      'Д-26/001',
      'да',
      '2027-06-30',
      'Внедрение',
      'Передан полностью',
      'Анна Кузнецова',
      'Ирина Волкова',
      'i.volkova@mipt.ru',
      '+7 495 000-00-00',
      '@mipt',
      '+7 495 000-00-00',
      '+7 495 000-00-00',
      'Ирина Волкова <i@mipt.ru> +7 495 000-00-00; Пётр Сидоров <p@mipt.ru>',
      'Пилотная группа 42 студента',
    ],
  ]);
}

// ============================================================
// ПАРСИНГ CSV
// ============================================================

/**
 * Определить разделитель по первой строке.
 * Считает вхождения ТОЛЬКО вне кавычек — иначе файл
 * с `;` внутри закавыченной ячейки определится неверно.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];

    if (ch === '"') {
      // Экранированная кавычка внутри значения: "" → не переключаем состояние
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;

    if (ch === ';') semicolons++;
    else if (ch === ',') commas++;
  }

  return semicolons > commas ? ';' : ',';
}

/**
 * Простой CSV-парсер.
 * Поддерживает кавычки, автодетект разделителя (; или ,).
 */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
  }

  // Последняя строка без \n
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Отсеиваем пустые строки
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export interface ParseResult {
  rows: Partial<University>[];
  errors: string[];
}

/**
 * Парсит CSV в массив вузов (по заголовкам).
 * Используется только для старого формата CSV-импорта.
 */
export function parseUniversitiesCSV(text: string): ParseResult {
  const rows = parseCSV(text);
  const errors: string[] = [];

  if (rows.length < 2) {
    return { rows: [], errors: ['Файл пустой или не содержит данных.'] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.findIndex((h) => h.includes('назван') || h.includes('name')),
    city: header.findIndex((h) => h.includes('город') || h.includes('city')),
    direction: header.findIndex(
      (h) => h.includes('направлен') || h.includes('direction'),
    ),
    product: header.findIndex(
      (h) => h.includes('продукт') || h.includes('product'),
    ),
    status: header.findIndex((h) => h.includes('статус') || h === 'status'),
    manager: header.findIndex(
      (h) => h.includes('менеджер') || h === 'manager',
    ),
    email: header.findIndex((h) => h.includes('email') || h.includes('почта')),
    phone: header.findIndex((h) => h.includes('телефон') || h === 'phone'),
    notes: header.findIndex((h) => h.includes('заметк') || h.includes('notes')),
  };

  if (idx.name === -1) {
    return {
      rows: [],
      errors: ['Не найден столбец "Название". Скачайте шаблон.'],
    };
  }

  const parsed: Partial<University>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : '');
    const name = get(idx.name);
    if (!name) continue;

    parsed.push({
      name,
      city: get(idx.city) || 'Москва',
      direction: get(idx.direction) || 'Разработка',
      product: get(idx.product) || 'Ростелеком DataLab',
      status: get(idx.status) || 'Новый',
      manager: get(idx.manager) || 'Анна Кузнецова',
      contact_email: get(idx.email) || null,
      contact_phone: get(idx.phone) || null,
      source: 'Импорт CSV',
      notes: get(idx.notes) || null,
    });
  }

  return { rows: parsed, errors };
}