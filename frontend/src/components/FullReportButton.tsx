// frontend/src/components/FullReportButton.tsx
import { useState } from 'react';
import { FileJson, Loader2 } from 'lucide-react';
import { downloadFullReport } from '@/lib/fullReportExport';

interface Props {
  period?: { from?: string; to?: string };
  onNotice: (msg: string) => void;
  label?: string;
  className?: string;
}

/**
 * Кнопка «Скачать полный JSON-отчёт» по ТЗ п.6.4.
 * Собирает все таблицы через backend и скачивает файлом.
 *
 * ВАЖНО: userId больше НЕ передаётся с клиента.
 *   - Раньше: `downloadFullReport(user?.profileId ?? null, period)` —
 *     открывало IDOR: подмена UUID в DevTools → чужой отчёт.
 *   - Теперь: сервер сам берёт `req.auth.profileId` из JWT.
 *     Функция `downloadFullReport` игнорирует первый параметр
 *     (оставлен для сигнатурной совместимости со старыми вызовами).
 */
export function FullReportButton({
  period,
  onNotice,
  label = 'JSON-отчёт',
  className = '',
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      // Передаём undefined явно — userId определяется на сервере из токена.
      await downloadFullReport(undefined, period);
      onNotice('JSON-отчёт сохранён.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => void handleClick()}
      disabled={busy}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} />}
      {busy ? 'Готовим…' : label}
    </button>
  );
}