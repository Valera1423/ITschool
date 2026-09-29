// frontend/src/hooks/useApi.ts
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api as apiClient } from '@/lib/api';
import { isApiError } from '@/lib/errors';

let signOutInFlight = false;

export function useApi() {
  const { signOut } = useAuth();

  const call = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        if (isApiError(e) && e.status === 401 && !signOutInFlight) {
          signOutInFlight = true;
          void signOut().finally(() => {
            setTimeout(() => {
              signOutInFlight = false;
            }, 3000);
          });
        }
        throw e;
      }
    },
    [signOut],
  );

  return useMemo(
    () => ({
      get: <T,>(path: string, options?: { params?: Record<string, unknown> }) =>
        call(() => apiClient.get<T>(path, options)),

      post: <T,>(path: string, body?: unknown) =>
        call(() => apiClient.post<T>(path, body)),

      patch: <T,>(path: string, body?: unknown) =>
        call(() => apiClient.patch<T>(path, body)),

      put: <T,>(path: string, body?: unknown) =>
        call(() => apiClient.put<T>(path, body)),

      delete: <T = void,>(path: string) => call(() => apiClient.delete<T>(path)),

      getPaginated: <T,>(path: string, params?: Record<string, unknown>) =>
        call(() => apiClient.getPaginated<T>(path, params)),

      upload: <T,>(path: string, formData: FormData) =>
        call(() => apiClient.upload<T>(path, formData)),
    }),
    [call],
  );
}

export type ApiHook = ReturnType<typeof useApi>;