import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Trash2, Upload, Camera, Download, Loader2 } from 'lucide-react';
import type { DocumentItem } from '@/types';
import { FileUploader } from '@/components/FileUploader';
import { EmptyState, Button } from '@/components/ui';
import { listDocuments, deleteDocument, downloadDocument, formatSize } from '@/lib/documents';
import { StorageClient } from '@/lib/storageClient';
import { formatDateTime } from '@/lib/utils';

interface Props {
  universityId: string;
  uploadedBy: string;
  canEdit: boolean;
  onNotice: (msg: string) => void;
}

/**
 * Список документов вуза с загрузкой файлов.
 * Файлы хранятся в MinIO, метаданные — в БД.
 *
 * Загрузка идёт через StorageClient → uploadWithProgress,
 * поэтому FileUploader получает onProgress и signal для
 * прогресс-бара и отмены.
 *
 * Дополнительно: кнопка «Фото» — `capture="environment"` включает
 * заднюю камеру на мобильных и открывает диалог выбора файла
 * на десктопе (fallback, если камера недоступна).
 */
export function DocumentsList({ universityId, uploadedBy, canEdit, onNotice }: Props) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listDocuments(universityId);
      setDocs(items);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Универсальная отправка одного файла (используется и для камеры, и для загрузчика). */
  const uploadFile = async (file: File, onProgress?: (p: { percent: number; speedBps: number; etaSeconds: number | null }) => void, signal?: AbortSignal) => {
    const client = new StorageClient();
    const doc = await client.upload(
      { file, universityId, category: 'Документ' },
      { onProgress, signal },
    );
    onNotice(`Файл «${doc.name}» загружен.`);
    await load();
  };

  /** Обработка фото, выбранного через `capture`. */
  const handleCameraFile = async (file: File) => {
    setBusy('camera');
    try {
      await uploadFile(file);
      setUploadOpen(false);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(null);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Удалить «${doc.name}»?`)) return;
    setBusy(doc.id);
    try {
      const err = await deleteDocument(doc);
      if (err) {
        onNotice(`Ошибка: ${err}`);
        return;
      }
      onNotice('Файл удалён.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      await downloadDocument(doc);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400">Загрузка документов…</p>;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div>
          {!uploadOpen ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setUploadOpen(true)}
              >
                <Upload size={14} /> Загрузить файл
              </Button>

              {/* Кнопка «Фото» — открывает нативную камеру на мобильных */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={busy === 'camera'}
                title="Сфотографировать документ"
              >
                {busy === 'camera' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
                Фото
              </Button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                // capture="environment" — задняя камера на iOS/Android.
                // На десктопе браузер проигнорирует и откроет файловый диалог.
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleCameraFile(f);
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <FileUploader
                onUpload={async (file, { onProgress, signal }) => {
                  await uploadFile(file, onProgress, signal);
                  setUploadOpen(false);
                }}
                onError={(msg) => onNotice(msg)}
                label="Перетащите файл или нажмите"
              />
              <button
                onClick={() => setUploadOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState
          text="Документов нет"
          hint={canEdit ? 'Загрузите первый файл или сделайте фото' : undefined}
          icon={FileText}
        />
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
            >
              <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-slate-400">
                  {doc.category} · {formatSize(doc.size_bytes)} · {doc.uploaded_by} ·{' '}
                  {formatDateTime(doc.created_at)}
                </p>
                {doc.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {doc.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => void handleDownload(doc)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors"
                  title="Скачать"
                  aria-label="Скачать"
                >
                  <Download size={14} />
                </button>
                {canEdit && (
                  <button
                    onClick={() => void handleDelete(doc)}
                    disabled={busy === doc.id}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors disabled:opacity-50"
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    {busy === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}