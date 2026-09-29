import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { userManager } from '@/lib/oidc';

/**
 * Страница-обработчик возврата от Keycloak.
 *
 * ВАЖНО: React.StrictMode монтирует компоненты дважды,
 * что приводит к двойному вызову signinRedirectCallback().
 * Второй вызов падает с 400 (code already used).
 *
 * Защита: module-level промис, который НЕ сбрасывается —
 * одноразовый. Даже если пользователь вернётся через минуту,
 * код в URL уже невалиден.
 */

let callbackInFlight: Promise<void> | null = null;

export function AuthCallbackPage() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Останавливаем silent renew, если где-то включён
    userManager.stopSilentRenew?.();

    void (async () => {
      try {
        if (!callbackInFlight) {
          callbackInFlight = userManager
            .signinRedirectCallback()
            .then(() => undefined);
        }
        await callbackInFlight;

        // Успех — на главную
        window.location.replace('/');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('OIDC callback error', e);
        try {
          await userManager.removeUser();
        } catch {
          /* ignore */
        }
        window.location.replace('/?auth=error');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto text-sky-500 mb-4" size={32} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Завершаем вход…
        </p>
      </div>
    </div>
  );
}