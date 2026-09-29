import { useQuery } from '@tanstack/react-query';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { CrmUser } from '@/types';

/**
 * Текущий пользователь.
 *
 * ВАЖНО: не отправляем запрос /auth/me, пока нет валидного OIDC-токена.
 * Иначе получаем 401 в консоли и лишний шум в логах backend.
 *
 * Используется lib/api (singleton), а НЕ useApi() — иначе циклическая
 * зависимость: AuthContext вызывает этот хук, а useApi читает из AuthContext.
 */
export function useCurrentUser() {
  const oidc = useOidcAuth();
  const hasToken = !!oidc.user && !oidc.user.expired;

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<CrmUser>('/auth/me'),
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      // 401 не ретраим — это либо протухший токен, либо блокировка
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: number }).status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}