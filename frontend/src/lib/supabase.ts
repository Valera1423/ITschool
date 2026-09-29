/**
 * @deprecated
 *
 * Supabase больше не используется. Проект работает на:
 * - Аутентификация: Keycloak OIDC (lib/oidc.ts)
 * - Файлы: MinIO (lib/storageClient.ts)
 * - Данные: REST API (lib/api.ts)
 *
 * Файл оставлен только для обратной совместимости со старыми
 * ссылками на файлы. При первой возможности — удалить.
 *
 * Если VITE_SUPABASE_* не заданы (что и должно быть в проде),
 * supabase === null, и все функции возвращают null.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ленивая инициализация — не грузим пакет, если переменные пусты
export const supabase: null = null as null;

// Старый экспорт оставлен для совместимости с кодом, который делал
// `if (supabase) ...`. Всегда null.
export function legacySupabasePublicUrl(_path: string): string | null {
  return null;
}

// Подавляем unused warnings
void supabaseUrl;
void supabaseAnonKey;