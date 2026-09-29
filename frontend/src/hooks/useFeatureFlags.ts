import { useCallback, useEffect, useState } from 'react';
import {
  loadFlags,
  subscribeToFlags,
  type FlagValue,
} from '@/lib/featureFlags';

/**
 * Загрузка всех флагов + утилиты.
 * Используется на страницах, где нужно знать несколько флагов сразу.
 *
 * Возвращает мемоизированные isEnabled/getConfig — безопасно
 * класть в deps useEffect.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, FlagValue>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      // Читаем из кэша через loadFlags
      void loadFlags().then((f) => {
        if (cancelled) return;
        setFlags({ ...f });
        setLoading(false);
      });
    };

    const unsubscribe = subscribeToFlags(sync);
    sync();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const isEnabled = useCallback(
    (key: string) => flags[key]?.enabled ?? false,
    [flags],
  );

  const getConfig = useCallback(
    <T = unknown,>(key: string): T | undefined =>
      flags[key]?.config as T | undefined,
    [flags],
  );

  return { flags, loading, isEnabled, getConfig };
}

/**
 * Проверка одного флага.
 *
 * Это настоящий хук: он подписывается на изменения кэша и
 * перерисовывает компонент при обновлении флага.
 */
export function useFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      void loadFlags().then((f) => {
        if (cancelled) return;
        setEnabled(f[key]?.enabled ?? false);
      });
    };

    const unsubscribe = subscribeToFlags(sync);
    sync();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key]);

  return enabled;
}