// frontend/src/components/ChartWrapper.tsx
import { useRef, useState, type ReactNode } from 'react';
import { Download, FileImage, Loader2, Server } from 'lucide-react';
import { exportElementToPng, renderChartOnServer, type ServerChartSpec } from '@/lib/chartExport';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  title: string;
  filename: string;
  children: ReactNode;
  className?: string;
  onNotice?: (msg: string) => void;
  /**
   * Опциональный «спецификатор» для серверного fallback.
   * Если задан и клиентский PNG не удался — рендерим на сервере.
   * Пример: { type: 'bar', title, data: [{label, value}, …] }
   */
  serverFallback?: ServerChartSpec;
}

/**
 * Обёртка диаграммы с кнопкой «Скачать PNG».
 *
 * Сначала пробуем клиентский html-to-image (быстро, без сети).
 * Если не удалось — дергаем сервер: POST /analytics/render-chart.
 */
export function ChartWrapper({
  title,
  filename,
  children,
  className = '',
  onNotice,
  serverFallback,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'client' | 'server' | null>(null);
  const { resolved } = useTheme();

  const handleExport = async () => {
    if (!ref.current) return;

    setBusy('client');
    const bg = resolved === 'dark' ? '#0f172a' : 'white';
    const ok = await exportElementToPng(ref.current, filename, { background: bg });

    if (ok) {
      setBusy(null);
      onNotice?.('Диаграмма сохранена в PNG.');
      return;
    }

    // Клиент не справился — пробуем сервер
    if (serverFallback) {
      setBusy('server');
      const okServer = await renderChartOnServer(serverFallback, filename, {
        background: bg,
      });
      setBusy(null);
      if (okServer) {
        onNotice?.('Диаграмма отрисована на сервере.');
        return;
      }
    }

    setBusy(null);
    onNotice?.('Не удалось сохранить диаграмму.');
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
          {title}
        </h3>
        <button
          onClick={() => void handleExport()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors disabled:opacity-50"
          title="Скачать PNG"
        >
          {busy === 'client' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : busy === 'server' ? (
            <Server size={12} className="animate-pulse" />
          ) : (
            <FileImage size={12} />
          )}
          PNG
        </button>
      </div>
      <div ref={ref} className="p-4">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// Экспорт всех диаграмм в один PDF (клиент + серверный fallback)
// ============================================================

export function ExportAllPdfButton({
  getElements,
  filename,
  onNotice,
}: {
  getElements: () => { element: HTMLElement; title: string }[];
  filename: string;
  onNotice?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const handleExport = async () => {
    const elements = getElements();
    if (elements.length === 0) {
      onNotice?.('Нет диаграмм для экспорта.');
      return;
    }

    setBusy(true);

    // ── Шаг 1: пробуем клиентский рендер всех элементов
    setProgress('Клиентский рендер…');
    const { exportElementsToPdf } = await import('@/lib/chartExport');
    const ok = await exportElementsToPdf(elements, filename).catch(() => false);

    if (ok) {
      setBusy(false);
      setProgress('');
      onNotice?.('PDF с диаграммами сохранён.');
      return;
    }

    // ── Шаг 2: клиент не справился. Сообщаем пользователю, что
    //    серверного «сборщика всех диаграмм» нет — рендер каждой
    //    диаграммы на сервере возможен, но требует декларативного
    //    spec (тип + данные), которого на уровне «все элементы» нет.
    setBusy(false);
    setProgress('');
    onNotice?.(
      'Не удалось собрать PDF на клиенте. Скачайте диаграммы по одной ' +
        'кнопкой PNG (при сбое они рендерятся на сервере).',
    );
  };

  return (
    <button
      onClick={() => void handleExport()}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {busy ? (progress || 'Готовим…') : 'Экспорт всех диаграмм (PDF)'}
    </button>
  );
}