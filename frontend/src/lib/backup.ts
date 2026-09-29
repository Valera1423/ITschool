import { api } from './api';
import { triggerDownload } from './utils';

/**
 * Резервное копирование.
 * Backend собирает полный JSON со всеми таблицами.
 */

export interface BackupFile {
  version: 1;
  created_at: string;
  workspace: string;
  tables: Record<string, unknown[]>;
}

export interface RestoreResult {
  table: string;
  inserted: number;
  error?: string;
}

export async function createBackup(): Promise<BackupFile> {
  return api.post<BackupFile>('/backup/create');
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(
    blob,
    `crm-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Восстановление из файла.
 *
 * ⚠️ TODO: для бэкапов >20 МБ этот POST упрётся в лимит nginx.
 * Переделать на multipart-загрузку с потоковой обработкой на backend.
 */
export async function restoreFromBackup(
  backup: BackupFile,
  options: { truncate?: boolean } = {},
): Promise<RestoreResult[]> {
  try {
    return await api.post<RestoreResult[]>('/backup/restore', {
      backup,
      truncate: options.truncate ?? false,
    });
  } catch (e) {
    return [
      {
        table: 'all',
        inserted: 0,
        error: e instanceof Error ? e.message : 'Ошибка восстановления',
      },
    ];
  }
}

/** Прочитать файл бэкапа. */
export function readBackupFile(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupFile;
        if (parsed.version !== 1 || typeof parsed.tables !== 'object') {
          reject(new Error('Неверный формат файла бэкапа.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error('Не удалось разобрать JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsText(file);
  });
}