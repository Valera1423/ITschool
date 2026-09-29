import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context';

import App from './App';
import { queryClient } from '@/lib/queryClient';
import { userManager } from '@/lib/oidc';
import { initSentry } from '@/lib/sentry';

// ── Дизайн-система Атомаро ─────────────────────────────
import './styles/ds/primitives.css';
import './styles/ds/palettes-shared.css';
import './styles/ds/fonts.css';
import './styles/ds/themes/default-light.css';
import './styles/ds/themes/default-dark.css';
import './styles/ds/themes/purple-light.css';
import './styles/ds/themes/purple-dark.css';
import './styles/ds/typography.css';

// ── Ваши стили — ПОСЛЕ токенов ─────────────────────────
import './index.css';
import './lib/i18n';

initSentry();

type ColorTheme = 'default' | 'purple';
type Mode = 'light' | 'dark';

function applyInitialTheme(): void {
  try {
    const mode = (localStorage.getItem('crm:theme') as Mode | 'system' | null) ?? 'system';
    const colorTheme = (localStorage.getItem('crm:color-theme') as ColorTheme | null) ?? 'default';

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved: Mode = mode === 'dark' || (mode !== 'light' && prefersDark) ? 'dark' : 'light';

    const html = document.documentElement;

    // Tailwind
    html.classList.toggle('dark', resolved === 'dark');

    // Тема Атомаро — 4 варианта
    const allClasses = [
      'Theme_root_rtk_default_light',
      'Theme_root_rtk_default_dark',
      'Theme_root_rtk_purple_light',
      'Theme_root_rtk_purple_dark',
    ];
    html.classList.remove(...allClasses);

    const cls =
      colorTheme === 'purple'
        ? (resolved === 'dark' ? 'Theme_root_rtk_purple_dark' : 'Theme_root_rtk_purple_light')
        : (resolved === 'dark' ? 'Theme_root_rtk_default_dark' : 'Theme_root_rtk_default_light');

    html.classList.add(cls);
    html.style.colorScheme = resolved;
  } catch {
    /* ignore */
  }
}

applyInitialTheme();

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      setInterval(() => void registration.update(), 30 * 60_000);
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          const ready = newWorker.state === 'installed';
          const hasController = !!navigator.serviceWorker.controller;
          if (ready && hasController) {
            window.dispatchEvent(
              new CustomEvent('crm:sw-update-ready', { detail: { registration } }),
            );
          }
        });
      });
    })
    .catch((e) => console.warn('[sw] регистрация не удалась', e));
}

setupServiceWorker();

const container = document.getElementById('root');
if (!container) throw new Error('Не найден #root в index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <OidcAuthProvider userManager={userManager}>
        <App />
      </OidcAuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);