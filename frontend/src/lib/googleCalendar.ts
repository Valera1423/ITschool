import { api } from './api';
import type { UserOAuthToken } from '@/types';

/**
 * Google Calendar OAuth (через backend).
 *
 * Флоу:
 * 1. Пользователь нажимает «Подключить» → редирект на backend /google/authorize
 * 2. Backend перенаправляет на Google OAuth consent
 * 3. Google возвращает на backend, который сохраняет токены
 * 4. Backend редиректит обратно на фронт с ?google=connected
 */

const API_URL = import.meta.env.VITE_API_URL;

/** URL для начала OAuth */
export function getGoogleAuthUrl(): string {
  return `${API_URL}/google/authorize`;
}

/** Получить текущее подключение */
export async function getGoogleConnection(): Promise<UserOAuthToken | null> {
  try {
    return await api.get<UserOAuthToken | null>('/google/connection');
  } catch {
    return null;
  }
}

/** Отключить Google */
export async function disconnectGoogle(): Promise<void> {
  try {
    await api.delete('/google/connection');
  } catch {
    // ignore
  }
}

/** Запустить синхронизацию вручную */
export async function triggerSync(): Promise<{ synced?: number; error?: string }> {
  try {
    const result = await api.post<{ synced: number }>('/google/sync');
    return { synced: result.synced };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Ошибка' };
  }
}