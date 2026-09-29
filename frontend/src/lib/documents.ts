import { StorageClient } from './storageClient';
import { api } from './api';
import { triggerDownload } from './utils';
import type { DocumentItem } from '@/types';

/**
 * Обёртка над StorageClient — работа с документами.
 * Публичное API для компонентов.
 *
 * Здесь происходит маппинг ответа backend'а (camelCase) в доменную
 * модель DocumentItem (snake_case) — на границе слоёв.
 */

const client = new StorageClient();

interface UploadRawDocument {
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
}

/**
 * Маппинг ответа StorageClient → DocumentItem.
 * Явно — чтобы не было `as unknown as`.
 */
function toDocumentItem(raw: UploadRawDocument): DocumentItem {
  return {
    id: raw.id,
    university_id: raw.universityId,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    storage_path: raw.storagePath,
    mime_type: raw.mimeType,
    size_bytes: Number(raw.sizeBytes) || 0,
    version: raw.version,
    parent_document_id: null,
    uploaded_by: raw.uploadedBy,
    created_at: raw.createdAt,
    deleted_at: null,
  };
}

/** Загрузить документ. */
export async function uploadDocument(params: {
  file: File;
  universityId: string;
  uploadedBy: string;
  category?: string;
  description?: string;
  parentDocumentId?: string;
  version?: number;
}): Promise<{ data: DocumentItem | null; error: string | null }> {
  try {
    const raw = await client.upload({
      file: params.file,
      universityId: params.universityId,
      category: params.category ?? 'Документ',
      description: params.description,
    });
    return { data: toDocumentItem(raw), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Ошибка загрузки',
    };
  }
}

/** Список документов вуза. */
export async function listDocuments(
  universityId: string,
): Promise<DocumentItem[]> {
  try {
    return await api.get<DocumentItem[]>(
      `/universities/${universityId}/documents`,
    );
  } catch {
    return [];
  }
}

/**
 * Скачать документ — открывает публичный URL MinIO в новой вкладке.
 * Через triggerDownload, чтобы работало в Safari/Firefox.
 */
export async function downloadDocument(doc: DocumentItem): Promise<void> {
  const url = client.publicUrl(doc.storage_path);
  try {
    // Пробуем fetch → blob → download, чтобы имя файла сохранилось.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    triggerDownload(blob, doc.name);
  } catch {
    // Fallback — просто открыть в новой вкладке
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Удалить документ. */
export async function deleteDocument(
  doc: DocumentItem,
): Promise<string | null> {
  return client.deleteDocument(doc.id);
}

/** Загрузить новую версию документа. */
export async function uploadNewVersion(
  original: DocumentItem,
  file: File,
  uploadedBy: string,
): Promise<{ data: DocumentItem | null; error: string | null }> {
  if (!original.university_id) {
    return { data: null, error: 'У документа нет привязки к вузу' };
  }
  return uploadDocument({
    file,
    universityId: original.university_id,
    uploadedBy,
    category: original.category,
    description: original.description ?? undefined,
    parentDocumentId: original.parent_document_id ?? original.id,
    version: original.version + 1,
  });
}

/** Форматирование размера файла. */
export { formatBytes as formatSize } from './utils';