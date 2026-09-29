// frontend/src/lib/excel.ts
import * as XLSX from 'xlsx';
import type { University } from '@/types';
import { api } from '@/lib/api';

// ============================================================
// ОПИСАНИЕ ПОЛЕЙ ДЛЯ МАППИНГА
// ============================================================

export interface FieldDefinition {
  key: keyof University | '__contacts' | 'vendor_name';
  label: string;
  required?: boolean;
}

export const UNIVERSITY_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Название вуза', required: true },
  { key: 'city', label: 'Город' },
  { key: 'direction', label: 'ИТ-направление' },
  { key: 'product', label: 'ИТ-продукт' },
  { key: 'vendor_name', label: 'Вендор' },            // ← NEW
  { key: 'contract_number', label: 'Номер договора' },
  { key: 'license_signed', label: 'Лицензия подписана' },
  { key: 'license_expires_at', label: 'Срок лицензии' },
  { key: 'status', label: 'Статус' },
  { key: 'handover_status', label: 'Статус передачи' },
  { key: 'manager', label: 'ФИО Менеджера' },
  { key: 'contact_name', label: 'Контактное лицо' },
  { key: 'contact_email', label: 'Email' },
  { key: 'contact_phone', label: 'Телефон' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'max_messenger', label: 'MAX' },
  { key: 'notes', label: 'Комментарий' },
  { key: '__contacts', label: 'Ответственные от ВУЗа (через ;)' },
];

export interface ColumnMapping {
  [targetField: string]: number;
}

// ============================================================
// ПАРСИНГ ФАЙЛА
// ============================================================

export async function parseExcel(file: File): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) return { headers: [], rows: [] };

  const json = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (json.length === 0) return { headers: [], rows: [] };

  const [headers, ...rows] = json;
  return {
    headers: (headers as unknown[]).map(String),
    rows: rows.map((r) => (r as unknown[]).map((c) => String(c ?? ''))),
  };
}

// ============================================================
// АВТОМАППИНГ
//
// ВАЖНО: раньше использовалось широкое совпадение
// `hn.includes(target) || target.includes(hn)`, из-за чего
// «Название» матчилось на несколько разных колонок.
// Теперь: сначала точное совпадение, потом аккуратное
// (по префиксу), но БЕЗ обратного `includes`.
// ============================================================
export function autoMap(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^а-яa-z0-9]/g, '');

  const usedIdx = new Set<number>();

  UNIVERSITY_FIELDS.forEach((field) => {
    const target = norm(field.label);

    // 1) Точное совпадение
    let idx = headers.findIndex((h, i) => !usedIdx.has(i) && norm(h) === target);

    // 2) Совпадение по префиксу (target начинается с hn или наоборот, но не любое вхождение)
    if (idx < 0) {
      idx = headers.findIndex(
        (h, i) =>
          !usedIdx.has(i) &&
          (norm(h).startsWith(target) || target.startsWith(norm(h))) &&
          Math.abs(norm(h).length - target.length) <= 4,
      );
    }

    if (idx >= 0) {
      map[field.key] = idx;
      usedIdx.add(idx);
    }
  });

  // Отдельно ищем колонку «Ответственные от ВУЗа»
  const contactsIdx = headers.findIndex((h) => {
    const hn = norm(h);
    return hn.includes('ответствен') && (hn.includes('вуз') || hn.includes('отв'));
  });
  if (contactsIdx >= 0) map['__contacts'] = contactsIdx;

  return map;
}

// ============================================================
// ПАРСИНГ КОНТАКТОВ
// ============================================================

interface ParsedContact {
  full_name: string;
  email?: string;
  phone?: string;
}

function parseContactsString(raw: string): ParsedContact[] {
  if (!raw) return [];

  const parts = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const out: ParsedContact[] = [];

  for (const p of parts) {
    const emailMatch = p.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const phoneMatch = p.match(/\+?[\d\s\-()]{7,}/);
    const email = emailMatch?.[0];
    const phone = phoneMatch?.[0]?.trim();

    let name = p;
    if (email) name = name.replace(email, '');
    if (phone) name = name.replace(phone, '');
    name = name.replace(/[<>(),]/g, '').trim();

    if (name || email || phone) {
      out.push({
        full_name: name || email || phone || 'Неизвестный контакт',
        email: email || undefined,
        phone: phone || undefined,
      });
    }
  }

  return out;
}

/**
 * Приводит произвольный формат «срока лицензии» к ISO-строке YYYY-MM-DD.
 *
 * Поддерживает:
 *   - 4-значный год        → 31 декабря этого года
 *   - YYYY-MM-DD           → как есть
 *   - DD.MM.YYYY           → конвертирует
 *   - DD/MM/YYYY           → конвертирует
 *
 * Возвращает null, если исходное значение пустое или не парсится.
 */
function normalizeLicenseDate(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // 4-значный год
  if (/^\d{4}$/.test(s)) {
    return `${s}-12-31`;
  }

  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // DD.MM.YYYY или DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Попытка через Date как fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

// ============================================================
// ПРЕДПРОСМОТР С ВАЛИДАЦИЕЙ
// ============================================================

export interface RowPreview {
  rowIndex: number;
  data: Partial<University>;
  contacts: ParsedContact[];
  errors: string[];
}

export function validateRows(rows: string[][], mapping: ColumnMapping): RowPreview[] {
  return rows.map((row, idx) => {
    const data: Partial<University> = {};
    const errors: string[] = [];

    const get = (key: string): string => {
      const col = mapping[key];
      if (col === undefined || col < 0) return '';
      return (row[col] ?? '').trim();
    };

    const name = get('name');
    if (!name) errors.push('Не указано название');
    data.name = name;

    data.city = get('city') || 'Москва';
    data.direction = get('direction') || 'Разработка';
    data.product = get('product') || 'Ростелеком DataLab';
    data.contract_number = get('contract_number') || null;

    const lic = get('license_signed').toLowerCase();
    data.license_signed = ['да', 'yes', 'true', '1', 'подписана'].includes(lic);

    // ── «Срок действия лицензии (год)» по ТЗ п.4.1.
    //    Excel может прислать:
    //      * "2026"            → конец года  2026-12-31
    //      * "2026-06-15"      → как есть
    //      * "15.06.2026"      → 2026-06-15
    //      * ""                → null
    data.license_expires_at = normalizeLicenseDate(get('license_expires_at'));

    data.status = get('status') || 'Новый';
    const handover = get('handover_status');
    data.handover_status = (
      ['Не передан', 'Передан частично', 'Передан полностью', 'Отозван'].includes(handover)
        ? handover
        : 'Не передан'
    ) as University['handover_status'];

    data.manager = get('manager') || 'Анна Кузнецова';

    data.contact_name = get('contact_name') || null;
    data.contact_email = get('contact_email') || null;
    data.contact_phone = get('contact_phone') || null;
    data.telegram = get('telegram') || null;
    data.whatsapp = get('whatsapp') || null;
    data.max_messenger = get('max_messenger') || null;
    data.notes = get('notes') || null;

    // vendor_name не является полем University, но нужен для импорта.
    (data as Record<string, unknown>).vendor_name = get('vendor_name') || null;

    const contacts = parseContactsString(get('__contacts'));

    return { rowIndex: idx, data, contacts, errors };
  });
}

// ============================================================
// ИМПОРТ
// ============================================================

export interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  contactsImported: number;
  errors: { rowIndex: number; message: string }[];
}

/**
 * Импорт вузов через backend API (batch).
 *
 * ВАЖНО: тело запроса формируется с явными snake_case-полями,
 * соответствующими `importRowSchema` на бэкенде. `__contacts` —
 * массив объектов `{ full_name, email, phone }`.
 */
export async function importUniversitiesUpsert(previews: RowPreview[]): Promise<ImportResult> {
  const valid = previews.filter((p) => p.errors.length === 0);
  const invalid = previews.filter((p) => p.errors.length > 0);

  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    failed: invalid.length,
    contactsImported: 0,
    errors: invalid.map((p) => ({
      rowIndex: p.rowIndex,
      message: p.errors.join('; '),
    })),
  };

  if (valid.length === 0) return result;

  try {
    const rows = valid.map((v) => {
      const d = v.data;
      return {
        name: d.name,
        city: d.city,
        direction: d.direction,
        product: d.product,
        vendor_name: ((d as Record<string, unknown>).vendor_name as string | null) ?? null,
        contract_number: d.contract_number ?? null,
        license_signed: d.license_signed ?? false,
        license_expires_at: d.license_expires_at ?? null,
        status: d.status,
        handover_status: d.handover_status,
        manager: d.manager,
        contact_name: d.contact_name ?? null,
        contact_email: d.contact_email ?? null,
        contact_phone: d.contact_phone ?? null,
        telegram: d.telegram ?? null,
        whatsapp: d.whatsapp ?? null,
        max_messenger: d.max_messenger ?? null,
        notes: d.notes ?? null,
        source: 'Импорт Excel',
        // Контакты — массив объектов ровно с теми полями, что в
        // importContactSchema на бэкенде.
        __contacts: v.contacts.map((c) => ({
          full_name: c.full_name,
          email: c.email ?? null,
          phone: c.phone ?? null,
        })),
      };
    });

    const response = await api.post<{
      inserted: number;
      updated: number;
      failed: number;
      contactsImported: number;
      errors: { rowIndex: number; message: string }[];
    }>('/universities/import', { rows });

    return {
      inserted: response.inserted,
      updated: response.updated,
      failed: result.failed + response.failed,
      contactsImported: response.contactsImported,
      errors: [...result.errors, ...response.errors],
    };
  } catch (e) {
    return {
      ...result,
      failed: result.failed + valid.length,
      errors: [
        ...result.errors,
        {
          rowIndex: -1,
          message: e instanceof Error ? e.message : 'Ошибка импорта',
        },
      ],
    };
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export interface ReportColumn {
  key: string;
  label: string;
}

export function exportRowsSpreadsheet<T extends Record<string, unknown>>(
  rows: T[],
  columns: ReportColumn[],
  filename: string,
  format: 'xls' | 'xlsx' = 'xlsx',
): void {
  const data = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c) => {
      obj[c.label] = r[c.key] ?? '';
    });
    return obj;
  });

  const sheet = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Отчёт');

  const bookType = format === 'xls' ? 'biff8' : 'xlsx';
  XLSX.writeFile(wb, `${filename}.${format}`, { bookType });
}

export function exportUniversitiesSpreadsheet(
  universities: University[],
  format: 'xls' | 'xlsx' = 'xlsx',
): void {
  const rows = universities.map((u) => ({
    'Название': u.name,
    'Город': u.city,
    'ИТ-направление': u.direction,
    'ИТ-продукт': u.product,
    'Номер договора': u.contract_number ?? '',
    'Лицензия подписана': u.license_signed ? 'да' : 'нет',
    'Срок лицензии': u.license_expires_at ?? '',
    'Статус': u.status,
    'Статус передачи': u.handover_status ?? 'Не передан',
    'Ответственный': u.manager,
    'Контактное лицо': u.contact_name ?? '',
    'Email': u.contact_email ?? '',
    'Телефон': u.contact_phone ?? '',
    'Telegram': u.telegram ?? '',
    'WhatsApp': u.whatsapp ?? '',
    'MAX': u.max_messenger ?? '',
    'Заметки': (u.notes ?? '').replace(/\r?\n/g, ' '),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Вузы');

  const date = new Date().toISOString().slice(0, 10);
  const bookType = format === 'xls' ? 'biff8' : 'xlsx';
  XLSX.writeFile(wb, `universities-${date}.${format}`, { bookType });
}

export function exportUniversitiesExcel(universities: University[]): void {
  exportUniversitiesSpreadsheet(universities, 'xlsx');
}

export function exportUniversitiesXls(universities: University[]): void {
  exportUniversitiesSpreadsheet(universities, 'xls');
}