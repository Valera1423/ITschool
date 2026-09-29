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
  serverFallback?: ServerChartSpec;
}

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

    // Читаем актуальный цвет фона из токена
    const bg =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--atmr-bg-page')
        .trim() || (resolved === 'dark' ? '#0f172a' : '#ffffff');

    const ok = await exportElementToPng(ref.current, filename, { background: bg });

    if (ok) {
      setBusy(null);
      onNotice?.('Диаграмма сохранена в PNG.');
      return;
    }

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
      className={`bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft shadow-atmr-s ${className}`}
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-0">
        <h3 className="atmr-body-s-strong text-atmr-fg">
          {title}
        </h3>
        <button
          onClick={() => void handleExport()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-atmr-m atmr-desc-l-strong text-atmr-fg-soft hover:bg-atmr-bg-surface2 hover:text-atmr-accent transition-colors duration-atmr-fast disabled:opacity-50"
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
// Экспорт всех диаграмм в один PDF
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
    setProgress('Клиентский рендер…');

    const { exportElementsToPdf } = await import('@/lib/chartExport');
    const ok = await exportElementsToPdf(elements, filename).catch(() => false);

    if (ok) {
      setBusy(false);
      setProgress('');
      onNotice?.('PDF с диаграммами сохранён.');
      return;
    }

    setBusy(false);
    setProgress('');
    onNotice?.(
      'Не удалось собрать PDF на клиенте. Скачайте диаграммы по одной кнопкой PNG.',
    );
  };

  return (
    <button
      onClick={() => void handleExport()}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-atmr-l atmr-body-s text-atmr-fg-soft bg-atmr-bg-surface2 hover:bg-atmr-surface-hover transition-colors duration-atmr-fast disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {busy ? (progress || 'Готовим…') : 'Экспорт всех диаграмм (PDF)'}
    </button>
  );
}