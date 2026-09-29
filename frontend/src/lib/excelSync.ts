import { api } from './api';
import { triggerDownload } from './utils';

/**
 * Excel-синхронизация: экспорт, шаблон, импорт.
 *
 * Всё через lib/api — единый 401-handler, retry, ApiError.
 */

export interface ImportResult {
  updated: number;
  created: number;
  failed: number;
  unchanged: number;
  deleted: number;
  errors: { row: number; message: string }[];
  newVersion: string;
}

/**
 * Скачать Excel-файл экспорта.
 *
 * Content-Disposition парсим, чтобы получить имя файла от бэкенда.
 * Fallback — сгенерированное имя.
 */
export async function downloadExport(
  entity: string,
  filters?: Record<string, unknown>,
): Promise<void> {
  const params: Record<string, string> = { entity };
  if (filters) params.filters = JSON.stringify(filters);

  const token = await getToken();

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/excel-sync/export?${new URLSearchParams(params).toString()}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!res.ok) {
    throw new Error(`Не удалось скачать файл (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : `export-${entity}.xlsx`;

  triggerDownload(blob, filename);
}

/** Скачать шаблон импорта. */
export async function downloadTemplate(entity: string): Promise<void> {
  const token = await getToken();

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/excel-sync/template?entity=${encodeURIComponent(entity)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!res.ok) {
    throw new Error(`Не удалось скачать шаблон (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  triggerDownload(blob, `template-${entity}.xlsx`);
}

/** Импорт Excel-файла. */
export async function uploadImport(
  entity: string,
  file: File,
): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);

  // api.upload уже умеет FormData и не ставит Content-Type
  return api.upload<ImportResult>(
    `/excel-sync/import?entity=${encodeURIComponent(entity)}`,
    fd,
  );
}

/**
 * Ленивый импорт токена — чтобы не тянуть oidc в момент загрузки модуля.
 */
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