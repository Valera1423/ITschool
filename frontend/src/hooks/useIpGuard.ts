import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { logError } from '@/lib/errorHandler';
import { ERROR_CODES } from '@/lib/errorCodes';

interface IpGuardState {
  loading: boolean;
  allowed: boolean;
  ip: string | null;
}

/**
 * Проверка IP пользователя против whitelist.
 * Backend endpoint: GET /security/check-ip → { allowed, ip }
 *
 * Безопасное поведение: при ошибке сети/сервера разрешаем доступ
 * (allowed: true), чтобы не блокировать пользователей из-за бага
 * на бэкенде. Реальная защита — на сервере.
 */
export function useIpGuard(enabled: boolean, userId?: string, email?: string) {
  const api = useApi();
  const [state, setState] = useState<IpGuardState>({
    loading: true,
    allowed: true,
    ip: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, allowed: true, ip: null });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await api.get<{ allowed: boolean; ip: string | null }>(
          '/security/check-ip',
        );
        if (cancelled) return;

        if (!result.allowed) {
          void logError({
            code: ERROR_CODES.IP_NOT_ALLOWED,
            message: `IP ${result.ip} не в белом списке`,
            context: { userId, email },
            severity: 'critical',
          });
        }

        setState({
          loading: false,
          allowed: result.allowed,
          ip: result.ip,
        });
      } catch {
        if (!cancelled) {
          // Не блокируем при ошибке — защита на сервере
          setState({ loading: false, allowed: true, ip: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, email, api]);

  return state;
}