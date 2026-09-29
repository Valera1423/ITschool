import { api } from './api';
import { ApiError } from './errors';
import { uploadWithProgress, type UploadOptions } from './uploadWithProgress';

/**
 * Клиент MinIO Storage через backend API.
 *
 * Используется для:
 * - Загрузки файлов в карточку вуза
 * - Загрузки версий договоров
 * - Вложений в workflow-переходах
 *
 * Публичные URL отдаются напрямую из MinIO через Nginx (path /storage/*).
 * Метаданные документов — через backend API.
 *
 * ВАЖНО: раньше здесь была своя fetch-реализация с Bearer-токеном.
 * Теперь всё через api (lib/api.ts) — единая точка для 401, retry,
 * Idempotency-Key и ApiError.
 *
 * Для загрузки файлов используется uploadWithProgress — XHR с
 * отслеживанием прогресса (fetch не умеет progress для upload).
 */

const MINIO_PUBLIC_URL =
  import.meta.env.VITE_MINIO_PUBLIC_URL ??
  `${import.meta.env.VITE_API_URL}/storage`;

interface UploadInput {
  file: File;
  universityId: string;
  category?: string;
  description?: string;
}

/**
 * Ответ бэкенда на загрузку файла.
 * snake_case и camelCase могут сосуществовать, поэтому возвращаем как есть,
 * а маппинг — в documents.ts.
 */
interface UploadResponse {
  document: {
    id: string;
    universityId: string;
    name: string;
    description: string | null;
    category: string;
    storagePath: string;
    mimeType: string | null;
    sizeBytes: number | string;
    version: number;
    uploadedBy: string;
    createdAt: string;
  };
  url: string;
}

export class StorageClient {
  /** Публичный URL файла. */
  publicUrl(key: string): string {
    const base = MINIO_PUBLIC_URL.replace(/\/$/, '');
    const cleanKey = key.replace(/^\//, '');
    return `${base}/${cleanKey}`;
  }

  /**
   * Загрузить файл с отслеживанием прогресса.
   *
   * options:
   *   onProgress — (percent, loaded, total) => void
   *   signal     — AbortSignal для отмены
   *
   * Content-Type выставит XHR сам для FormData — не трогаем.
   */
  async upload(
    input: UploadInput,
    options: UploadOptions = {},
  ): Promise<UploadResponse['document']> {
    const fd = new FormData();
    fd.append('file', input.file);
    fd.append('universityId', input.universityId);
    if (input.category) fd.append('category', input.category);
    if (input.description) fd.append('description', input.description);

    try {
      const res = await uploadWithProgress<{
        document: UploadResponse['document'];
      }>('/storage/upload', fd, options);
      return res.document;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        e instanceof Error ? e.message : 'Ошибка загрузки файла',
        0,
      );
    }
  }

  /** Удалить документ (soft-delete в БД + удаление из MinIO). */
  async deleteDocument(documentId: string): Promise<string | null> {
    try {
      await api.delete(`/storage/${documentId}`);
      return null;
    } catch (e) {
      if (e instanceof ApiError) return e.message;
      return e instanceof Error ? e.message : 'Ошибка удаления';
    }
  }

  /** Получить временную ссылку для скачивания (для приватных файлов). */
  async signedUrl(documentId: string): Promise<string | null> {
    try {
      const res = await api.get<{ url: string }>(
        `/storage/${documentId}/signed-url`,
      );
      return res.url;
    } catch {
      return null;
    }
  }
}