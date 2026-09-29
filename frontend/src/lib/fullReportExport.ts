// frontend/src/lib/fullReportExport.ts
import { downloadFromServer } from './exportServer';

/**
 * Полный JSON-отчёт по ТЗ п.6.4.
 *
 * Раньше: клиент собирал отчёт, делая 10 параллельных запросов
 * (universities, interactions, tasks, contracts, workflows, catalogs),
 * и скачивал результат. Проблемы:
 *   - userId передавался из UI → IDOR;
 *   - отчёт был неполный (не включал audit, comments, documents и т.д.);
 *   - клиент мог «съесть» всю память на 10 000+ записях.
 *
 * Теперь: один GET-запрос к серверу — сервер собирает отчёт целиком,
 * применяет scope пользователя (nam видит только свои вузы) и
 * отдаёт поток. Клиент просто сохраняет файл.
 *
 * Эндпоинт: GET /reports/full.json
 *   ?from=YYYY-MM-DD (опц.)
 *   ?to=YYYY-MM-DD   (опц.)
 *
 * Права: любой авторизованный. Админ-разделы (auditLog,
 * pdConsents, securityEvents) включаются только для role === 'admin'.
 */
export interface DownloadFullReportOptions {
  from?: string;
  to?: string;
}

export async function downloadFullReport(
  _userIdIgnored?: string | null, // параметр оставлен для совместимости вызовов
  period?: DownloadFullReportOptions,
): Promise<void> {
  const params = new URLSearchParams();
  if (period?.from) params.set('from', period.from);
  if (period?.to) params.set('to', period.to);
  const qs = params.toString();

  const date = new Date().toISOString().slice(0, 10);
  await downloadFromServer(
    `/reports/full.json${qs ? `?${qs}` : ''}`,
    `crm-report-${date}.json`,
  );
}

/**
 * Совместимость: некоторые вызовы используют buildFullReport().
 * Здесь она больше не нужна — возвращаем заглушку, чтобы
 * старый код не падал (или можно заменить вызовы на downloadFullReport).
 *
 * @deprecated Используйте downloadFullReport().
 */
export async function buildFullReport(): Promise<never> {
  throw new Error(
    'buildFullReport() устарел. Используйте downloadFullReport() — ' +
      'отчёт собирается на сервере.',
  );
}