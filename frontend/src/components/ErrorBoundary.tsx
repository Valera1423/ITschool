import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { logError } from '@/lib/errorHandler';
import { ERROR_CODES } from '@/lib/errorCodes';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Глобальный ErrorBoundary.
 *
 * Ловит ошибки рендера React, логирует их на backend и показывает
 * пользователю дружелюбный экран.
 *
 * НЕ ловит:
 * - Асинхронные ошибки (Promise rejections) — для них handleError
 * - Ошибки в обработчиках событий — для них handleError
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void logError({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      stack: `${error.stack}\n\nComponent stack:\n${info.componentStack}`,
      severity: 'critical',
      context: { phase: 'react_render' },
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleHardReload = async (): Promise<void> => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.removeItem('crm:theme');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Что-то пошло не так
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Мы записали ошибку и уже разбираемся. Попробуйте перезагрузить страницу.
          </p>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-left text-slate-500 mb-6 font-mono break-all">
            Код:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {ERROR_CODES.INTERNAL_ERROR}
            </strong>
            <br />
            {this.state.error?.message}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
            >
              <RefreshCw size={14} /> Перезагрузить
            </button>
            <button
              onClick={() => void this.handleHardReload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={14} /> Очистить кэш и перезагрузить
            </button>
          </div>
        </div>
      </div>
    );
  }
}