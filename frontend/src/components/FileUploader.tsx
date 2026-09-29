// frontend/src/components/FileUploader.tsx
import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, Loader2, AlertCircle, X } from 'lucide-react';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB } from '@/constants';
import type { UploadProgress } from '@/lib/uploadWithProgress';

/**
 * Drag-n-drop загрузчик файлов с валидацией и прогрессом.
 *
 * По ТЗ п.3 разрешены только:
 * png, jpeg, pdf, zip, gzip, rar, doc, docx, xls, xlsx
 * Максимальный размер: 20 МБ.
 *
 * Возможности:
 * - Drag-n-drop или выбор через диалог
 * - Валидация расширения и размера до начала загрузки
 * - Прогресс-бар с % / скоростью / ETA
 * - Кнопка «Отмена» через AbortController
 */

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      ok: false,
      error: `Формат .${ext} не поддерживается. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      ok: false,
      error: `Файл больше ${MAX_FILE_SIZE_MB} МБ`,
    };
  }

  return { ok: true };
}

interface Props {
  /**
   * Кастомный uploader (например, через StorageClient).
   * Принимает файл и объект `{ onProgress, signal }` —
   * пробрасывает их в uploadWithProgress / XHR.
   */
  onUpload: (
    file: File,
    opts: {
      onProgress: (p: UploadProgress) => void;
      signal: AbortSignal;
    },
  ) => Promise<void>;
  onError?: (msg: string) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
}

function fmtSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} Б/с`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} КБ/с`;
  return `${(bps / 1024 / 1024).toFixed(1)} МБ/с`;
}

function fmtEta(sec: number | null): string {
  if (sec === null || !isFinite(sec)) return '';
  if (sec < 60) return `${Math.ceil(sec)} сек`;
  return `${Math.ceil(sec / 60)} мин`;
}

export function FileUploader({
  onUpload,
  onError,
  label = 'Перетащите файл или нажмите',
  accept,
  multiple = false,
  maxSizeMB = MAX_FILE_SIZE_MB,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const acceptAttr =
    accept ?? ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setProgress(null);

    for (const f of Array.from(files)) {
      const v = validateFile(f);
      if (!v.ok) {
        setError(v.error ?? 'Файл не подходит');
        onError?.(v.error ?? 'Файл не подходит');
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        const msg = `Файл «${f.name}» больше ${maxSizeMB} МБ`;
        setError(msg);
        onError?.(msg);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for (const f of Array.from(files)) {
        await onUpload(f, {
          onProgress: setProgress,
          signal: controller.signal,
        });
      }
      setProgress(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки';
      setError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          drag
            ? 'border-sky-400 bg-sky-50/50 dark:bg-sky-900/20'
            : error
              ? 'border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-900/10'
              : 'border-slate-200 dark:border-slate-700 hover:border-sky-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
        } ${busy ? 'opacity-80' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-2">
          {busy ? (
            <Loader2 className="animate-spin text-sky-500" size={28} />
          ) : error ? (
            <AlertCircle className="text-rose-500" size={28} />
          ) : (
            <UploadCloud className="text-slate-400" size={28} />
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {busy ? 'Загрузка…' : label}
          </p>
          <p className="text-xs text-slate-400">
            {ALLOWED_EXTENSIONS.slice(0, 6).join(', ')} и др. · до {maxSizeMB} МБ
          </p>
        </div>
      </div>

      {busy && progress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {progress.percent}% · {fmtSpeed(progress.speedBps)}
              {progress.etaSeconds !== null &&
                ` · осталось ${fmtEta(progress.etaSeconds)}`}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                cancel();
              }}
              className="text-rose-500 hover:text-rose-600 flex items-center gap-0.5"
            >
              <X size={12} /> Отмена
            </button>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}