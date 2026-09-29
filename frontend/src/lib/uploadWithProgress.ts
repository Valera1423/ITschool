import { userManager } from './oidc';

const API_URL = import.meta.env.VITE_API_URL;

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  /** Байт/сек — средняя за всё время загрузки */
  speedBps: number;
  /** Секунды до конца (по текущей средней) */
  etaSeconds: number | null;
}

export interface UploadOptions {
  onProgress?: (p: UploadProgress) => void;
  /** Abort signal — кнопка «Отмена» */
  signal?: AbortSignal;
}

/**
 * Загрузка файла с прогрессом.
 * Использует XMLHttpRequest — единственный браузерный способ
 * получить событие `upload.progress`.
 *
 * Возвращает разобранный JSON-ответ.
 */
export async function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  const token = await (async () => {
    try {
      const user = await userManager.getUser();
      return user && !user.expired ? user.access_token : null;
    } catch { return null; }
  })();

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`, true);

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-Trace-Id', crypto.randomUUID());

    const startedAt = Date.now();

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const speedBps = elapsedSec > 0 ? e.loaded / elapsedSec : 0;
      const remaining = e.total - e.loaded;
      const etaSeconds = speedBps > 0 ? remaining / speedBps : null;

      options.onProgress?.({
        loaded: e.loaded,
        total: e.total,
        percent: Math.round((e.loaded / e.total) * 100),
        speedBps,
        etaSeconds,
      });
    });

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Загрузка отменена'));
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json.data ?? json);
        } catch {
          resolve(xhr.responseText as unknown as T);
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.message ?? msg;
        } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке'));
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки'));

    xhr.send(formData);
  });
}