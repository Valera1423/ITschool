// frontend/src/lib/catalogExcel.ts
import * as XLSX from 'xlsx';
import { api } from './api';

export type CatalogEntity = 'vendors' | 'directions' | 'products' | 'managers';

export interface CatalogField {
  key: string;
  label: string;
  required?: boolean;
}

/** Описание полей каждого каталога */
export const CATALOG_FIELDS: Record<CatalogEntity, CatalogField[]> = {
  vendors: [
    { key: 'name', label: 'Название', required: true },
    { key: 'contactName', label: 'ФИО контакта' },
    { key: 'contactPhone', label: 'Телефон' },
    { key: 'contactEmail', label: 'Почта' },
    { key: 'contactMethods', label: 'Способ связи' },
    { key: 'description', label: 'Описание' },
    { key: 'site', label: 'Сайт' },
  ],
  directions: [
    { key: 'name', label: 'Название', required: true },
    { key: 'code', label: 'Код' },
    { key: 'description', label: 'Описание' },
    { key: 'color', label: 'Цвет' },
    { key: 'sortOrder', label: 'Порядок' },
  ],
  products: [
    { key: 'name', label: 'Название', required: true },
    { key: 'vendorName', label: 'Вендор' },
    { key: 'licenseType', label: 'Тип лицензии' },
    { key: 'description', label: 'Описание' },
    { key: 'sortOrder', label: 'Порядок' },
  ],
  managers: [
    { key: 'name', label: 'ФИО', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Телефон' },
    { key: 'position', label: 'Должность' },
    { key: 'department', label: 'Отдел' },
    { key: 'color', label: 'Цвет' },
    { key: 'sortOrder', label: 'Порядок' },
  ],
};

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
}

/**
 * Распарсить XLSX-файл каталога.
 * contactMethods для vendors парсится как массив строк.
 */
export async function parseCatalogExcel(
  file: File,
  entity: CatalogEntity,
): Promise<{ rows: ParsedRow[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [] };

  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  if (json.length < 2) return { rows: [] };

  const [headers, ...body] = json;
  const headerMap: Record<string, number> = {};
  const fields = CATALOG_FIELDS[entity];

  (headers as unknown[]).forEach((h, i) => {
    const label = String(h ?? '').trim().toLowerCase();
    fields.forEach((f) => {
      if (
        label === f.label.toLowerCase() ||
        label === f.key.toLowerCase()
      ) {
        headerMap[f.key] = i;
      }
    });
  });

  const rows: ParsedRow[] = [];
  for (let r = 0; r < body.length; r++) {
    const raw = body[r] as unknown[];
    if (!raw || raw.every((c) => String(c ?? '').trim() === '')) continue;

    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    fields.forEach((f) => {
      const idx = headerMap[f.key];
      const value = idx !== undefined ? String(raw[idx] ?? '').trim() : '';
      if (f.required && !value) errors.push(`Поле «${f.label}» пусто`);

      if (f.key === 'contactMethods') {
        data[f.key] = value
          ? value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : [];
      } else {
        data[f.key] = value;
      }
    });

    rows.push({ rowIndex: r + 2, data, errors });
  }

  return { rows };
}

/**
 * Отправить импорт на бэкенд.
 * Для vendors contactMethods нормализуется в массив.
 */
export async function importCatalog(
  entity: CatalogEntity,
  rows: Record<string, unknown>[],
  mode: 'upsert' | 'insert-only' = 'upsert',
): Promise<ImportResult> {
  try {
    const normalized = rows.map((r) => {
      if (entity !== 'vendors') return r;
      const m = r.contactMethods;
      return {
        ...r,
        contactMethods: Array.isArray(m)
          ? m
          : typeof m === 'string'
            ? m.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
            : [],
      };
    });
    return await api.post<ImportResult>(`/catalogs/${entity}/import`, {
      rows: normalized,
      mode,
    });
  } catch (e) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rows.length,
      errors: [
        { rowIndex: -1, message: e instanceof Error ? e.message : 'Ошибка' },
      ],
    };
  }
}

/**
 * Скачать шаблон.
 */
export async function downloadCatalogTemplate(
  entity: CatalogEntity,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/catalogs/${entity}/template`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    throw new Error(`Не удалось скачать шаблон (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template-${entity}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getToken(): Promise<string | null> {
  try {
    const { userManager } = await import('./oidc');
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
  } catch {
    return null;
  }
}