import * as XLSX from 'xlsx';
import { api } from './api';

export interface ContactImportRow {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  university_name: string;
  notes?: string | null;
}

export interface ContactImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  universitiesCreated: number;
  errors: { rowIndex: number; message: string }[];
}

export const CONTACT_FIELDS = [
  { key: 'full_name', label: 'ФИО', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Телефон' },
  { key: 'role', label: 'Должность' },
  { key: 'university_name', label: 'Название вуза', required: true },
  { key: 'notes', label: 'Заметки' },
] as const;

export interface ParsedContactRow {
  rowIndex: number;
  data: ContactImportRow;
  errors: string[];
}

/** Парсинг XLSX-файла контактов */
export async function parseContactsExcel(file: File): Promise<ParsedContactRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: false, defval: '',
  });
  if (json.length < 2) return [];

  const [headers, ...body] = json;
  const headerMap: Record<string, number> = {};
  (headers as unknown[]).forEach((h, i) => {
    const label = String(h ?? '').trim().toLowerCase();
    CONTACT_FIELDS.forEach((f) => {
      if (label === f.label.toLowerCase() || label === f.key.toLowerCase()) {
        headerMap[f.key] = i;
      }
    });
  });

  const rows: ParsedContactRow[] = [];
  for (let r = 0; r < body.length; r++) {
    const raw = body[r] as unknown[];
    if (!raw || raw.every((c) => String(c ?? '').trim() === '')) continue;

    const data: ContactImportRow = {
      full_name: '',
      university_name: '',
    };
    const errors: string[] = [];

    CONTACT_FIELDS.forEach((f) => {
      const idx = headerMap[f.key];
      const value = idx !== undefined ? String(raw[idx] ?? '').trim() : '';
      if (f.required && !value) errors.push(`Поле «${f.label}» пусто`);
      (data as unknown as Record<string, unknown>)[f.key] = value || null;
    });

    rows.push({ rowIndex: r + 2, data, errors });
  }

  return rows;
}

/** Отправка контактов на backend */
export async function importContacts(
  rows: ContactImportRow[],
  createMissingUniversities = false,
): Promise<ContactImportResult> {
  try {
    return await api.post<ContactImportResult>('/universities/contacts/import', {
      rows,
      createMissingUniversities,
    });
  } catch (e) {
    return {
      inserted: 0, updated: 0, skipped: 0, failed: rows.length, universitiesCreated: 0,
      errors: [{ rowIndex: -1, message: e instanceof Error ? e.message : 'Ошибка' }],
    };
  }
}

/** Скачать шаблон */
export function downloadContactsTemplate(): void {
  const rows = [
    CONTACT_FIELDS.map((f) => f.label),
    ['Иванов Иван', 'i.ivanov@mipt.ru', '+7 495 000-00-00', 'Проректор', 'МФТИ', 'Основной контакт'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Контакты');
  XLSX.writeFile(wb, 'contacts-template.xlsx');
}