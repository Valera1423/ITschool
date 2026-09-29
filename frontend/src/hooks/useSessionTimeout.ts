import { useEffect, useRef } from 'react';
import { userManager } from '@/lib/oidc';
import { logError } from '@/lib/errorHandler';
import { ERROR_CODES } from '@/lib/errorCodes';

interface Options {
  enabled: boolean;
  timeoutMinutes?: number;
  warnBeforeMinutes?: number;
  userId?: string;
  email?: string;
  onWarn?: () => void;
  onTimeout?: () => void | Promise<void>;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/**
 * Автоматический выход при неактивности.
 *
 * ВАЖНО:
 * 1. Хук НЕ делает редирект — только вызывает onTimeout.
 *    Редирект делает родитель (Shell), у которого есть контекст.
 * 2. onWarn/onTimeout сохраняются в ref — эффект не пересоздаётся
 *    при каждом рендере родителя. Если положить их в deps напрямую,
 *    интервал будет сбрасываться, и таймаут никогда не сработает.
 */
export function useSessionTimeout({
  enabled,
  timeoutMinutes = 30,
  warnBeforeMinutes = 2,
  userId,
  email,
  onWarn,
  onTimeout,
}: Options) {
  const lastActivity = useRef(Date.now());
  const warnedRef = useRef(false);
  const firedRef = useRef(false);

  // Стабильные ссылки на колбэки
  const onWarnRef = useRef(onWarn);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onWarnRef.current = onWarn;
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      lastActivity.current = Date.now();
      warnedRef.current = false;
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, reset, { passive: true }),
    );

    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const timeoutMs = timeoutMinutes * 60_000;
      const warnMs = (timeoutMinutes - warnBeforeMinutes) * 60_000;

      // Выход по неактивности
      if (idleMs >= timeoutMs && !firedRef.current) {
        firedRef.current = true;

        void logError({
          code: ERROR_CODES.SESSION_TIMEOUT,
          message: 'Сессия завершена по неактивности',
          context: { idle_minutes: Math.round(idleMs / 60_000), userId, email },
          severity: 'info',
        });

        // Чистим OIDC-хранилище
        void userManager.removeUser().catch(() => {
          /* ignore */
        });

        // Делегируем решение родителю
        void Promise.resolve(onTimeoutRef.current?.()).catch(() => {
          /* ignore */
        });
        return;
      }

      // Предупреждение
      if (idleMs >= warnMs && !warnedRef.current && !firedRef.current) {
        warnedRef.current = true;
        onWarnRef.current?.();
      }
    }, 15_000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
      window.clearInterval(interval);
      firedRef.current = false;
      warnedRef.current = false;
    };
  }, [enabled, timeoutMinutes, warnBeforeMinutes, userId, email]);
}