import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '@/lib/errorHandler';
import { ERROR_CODES } from '@/lib/errorCodes';

interface Props {
  children: ReactNode;
  pageName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: `[${this.props.pageName}] ${error.message}`,
      stack: `${error.stack}\n\nComponent stack:\n${info.componentStack}`,
      severity: 'critical',
      context: { page: this.props.pageName },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Ошибка на странице «{this.props.pageName}»
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Остальная часть приложения работает.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
          >
            <RefreshCw size={14} /> Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}