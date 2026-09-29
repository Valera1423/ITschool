import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { PublicReportPage } from '@/pages/PublicReportPage';
import { Shell } from '@/components/Shell';
import { LoadingState } from '@/components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ViewKey } from '@/types';

const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
);

const VALID_VIEWS: ViewKey[] = [
  'dashboard', 'my-dashboards', 'universities', 'interactions',
  'interactions-report', 'calendar', 'calls', 'kanban', 'tasks',
  'workflows', 'automation', 'contracts', 'segments', 'inbox',
  'reports', 'metrics', 'analytics', 'executive',
  'users', 'custom-roles', 'integrations', 'catalogs',
  'journal', 'system-health', 'security',
  'trash', 'backup', 'knowledge', 'about', 'settings',
];

export function Router() {
  const { user, loading, error } = useAuth();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [initialView, setInitialView] = useState<ViewKey | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    return v && VALID_VIEWS.includes(v as ViewKey) ? (v as ViewKey) : null;
  });

  // Слушаем навигацию браузера (back/forward)
  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // После первого использования initialView — очищаем URL
  useEffect(() => {
    if (initialView) {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.toString());
    }
  }, [initialView]);

  if (pathname === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  if (pathname.startsWith('/public/')) {
    return <PublicReportPage />;
  }

  // Публичный /about — доступен без авторизации, скрывает Shell
  if (pathname === '/about') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
        <Suspense fallback={<LoadingState />}>
          <AboutPage />
        </Suspense>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Ошибка авторизации
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
            >
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        </div>
      );
    }
    return <LoginPage />;
  }

  return <Shell initialView={initialView ?? undefined} />;
}