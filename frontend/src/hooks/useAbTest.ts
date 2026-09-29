import { useEffect, useState } from 'react';
import { useApi } from './useApi';

/**
 * Хук для A/B теста.
 *
 *   const variant = useAbTest('button_color');
 *   const buttonClass = variant === 'test' ? 'bg-rose-500' : 'bg-sky-500';
 *
 * Загрузка при монтировании. Без глобального кэша — варианты
 * пользователя не должны утекать между сессиями.
 */
export function useAbTest(testKey: string): string | null {
  const api = useApi();
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const all = await api.get<Record<string, string | null>>('/ab/me');
        if (cancelled) return;
        const val = all[testKey] ?? null;
        setVariant(val);
        if (val) {
          void api
            .post(`/ab/${testKey}/track`, {
              variant: val,
              eventType: 'view',
            })
            .catch(() => {
              /* трекинг не критичен */
            });
        }
      } catch {
        if (!cancelled) setVariant(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [testKey, api]);

  return variant;
}

/** Ручной трекинг события (например, конверсии). */
export async function trackAbEvent(
  api: ReturnType<typeof useApi>,
  testKey: string,
  variant: string,
  eventType: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await api.post(`/ab/${testKey}/track`, { variant, eventType, metadata });
  } catch {
    /* ignore */
  }
}