// frontend/src/contexts/AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  useAuth as useOidcAuth,
  type AuthContextProps,
} from 'react-oidc-context';
import { useQueryClient } from '@tanstack/react-query';
import { userManager, silentRenew } from '@/lib/oidc';
import { useCurrentUser } from '@/hooks/queries/useCurrentUser';
import { clearAllDrafts } from '@/lib/utils';
import type { CrmUser, UserRole } from '@/types';

/**
 * Контекст аутентификации.
 *
 * Оборачивает react-oidc-context и добавляет:
 * - Профиль из БД (роль, имя, блокировка)
 * - Методы signIn / signOut / refresh
 * - Loading-флаг во время загрузки профиля
 *
 * ВАЖНО: роль берём из БД, а не из JWT, чтобы заблокированные
 * пользователи сразу теряли доступ.
 */

interface CrmAuthContextValue {
  oidc: AuthContextProps;
  user: CrmUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CrmAuthContext = createContext<CrmAuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const oidc = useOidcAuth();
  const qc = useQueryClient();

  // Единственный источник истины о пользователе — этот хук.
  const {
    data: user = null,
    isLoading: isUserLoading,
    error: userError,
  } = useCurrentUser();

  const oidcUser = oidc.user;
  const oidcLoading = oidc.isLoading;
  const oidcError = oidc.error;

  // ------------------------------------------------------------
  // Тихий renew при истечении токена, иначе — на форму логина
  // ------------------------------------------------------------
  useEffect(() => {
    if (oidcLoading) return;
    if (!oidcUser) return;
    if (!oidcUser.expired) return;

    let cancelled = false;

    void (async () => {
      const renewed = await silentRenew();
      if (cancelled) return;
      if (renewed) return; // токен обновился, цепочка сама пересчитается
      // silent renew не удался — выкидываем на форму логина
      try {
        await userManager.removeUser();
      } catch {
        /* ignore */
      }
      await userManager.signinRedirect();
    })();

    return () => {
      cancelled = true;
    };
  }, [oidcLoading, oidcUser]);

  // ------------------------------------------------------------
  // Экспорт токена + ротация сессии при silent renew
  // ------------------------------------------------------------
  //
  // Храним предыдущий access_token в ref. Если новый != старого —
  // вызываем POST /auth/sessions/rotate, чтобы backend отозвал
  // старую UserSession и создал новую с тем же IP/UA.
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token =
      oidcUser && !oidcUser.expired ? oidcUser.access_token : null;

    if (token) {
      (window as unknown as { __oidcToken?: string }).__oidcToken = token;

      const prev = prevTokenRef.current;
      if (prev && prev !== token) {
        // Тихая ротация — не блокируем UI
        void (async () => {
          try {
            const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
            await fetch(`${apiBase}/auth/sessions/rotate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ oldToken: prev, newToken: token }),
            });
          } catch {
            /* ignore */
          }
        })();
      }

      prevTokenRef.current = token;
    } else {
      delete (window as unknown as { __oidcToken?: string }).__oidcToken;
      prevTokenRef.current = null;
    }
  }, [oidcUser]);

  // ------------------------------------------------------------
  // Методы
  // ------------------------------------------------------------
  const signIn = useCallback(async () => {
    await oidc.signinRedirect();
  }, [oidc]);

  const signOut = useCallback(async () => {
    // 1. Очищаем клиентские кэши, чтобы данные не утекли следующему пользователю
    qc.clear();
    clearAllDrafts();

    // 2. Чистим OIDC-сессию и делаем редирект на Keycloak
    try {
      await userManager.signoutRedirect();
    } catch {
      // Если Keycloak недоступен — просто чистим локально
      try {
        await userManager.removeUser();
      } catch {
        /* ignore */
      }
      window.location.replace('/');
    }
  }, [qc]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);

  // ------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------
  const hasValidToken = !!oidcUser && !oidcUser.expired;
  const loading = oidcLoading || (hasValidToken && isUserLoading);

  // Приоритет ошибки: OIDC → профиль
  const error: string | null =
    oidcError?.message ??
    (userError instanceof Error ? userError.message : null);

  const value = useMemo<CrmAuthContextValue>(
    () => ({
      oidc,
      user,
      loading,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [oidc, user, loading, error, signIn, signOut, refresh],
  );

  return <CrmAuthContext.Provider value={value}>{children}</CrmAuthContext.Provider>;
}

export function useAuth(): CrmAuthContextValue {
  const ctx = useContext(CrmAuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Хелпер: проверить, что роль пользователя входит в список. */
export function useHasRole(...roles: UserRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Хелпер: проверить permission с учётом роли.
 *
 * Логика совпадает с бэкендовым `requirePermission`:
 *  - admin может всё;
 *  - если permission(ы) не переданы — считаем «нет ограничений»;
 *  - иначе — если у пользователя есть хотя бы один из указанных
 *    permission'ов, возвращаем `true`.
 *
 * Проверка построена по принципу «или»: удобно для случаев, когда
 * кнопка доступна при наличии любого из нескольких прав
 * (`useHasPermission('contracts.approve', 'contracts.sign')`).
 */
export function useHasPermission(...permissions: string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (permissions.length === 0) return true;
  if (!user.permissions || user.permissions.length === 0) return false;
  return permissions.some((p) => user.permissions!.includes(p));
}

/**
 * Хелпер: может ли текущий пользователь назначать ответственных
 * за вузы. По ТЗ п.4.11 — только admin и manager.
 *
 * nam всегда false, даже если у него в permissions случайно
 * окажется 'universities.transfer' — это правило уровня UI
 * дублирует бэкенд (там requireRole('admin','manager')).
 */
export function useCanAssignManager(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.role === 'admin' || user.role === 'manager';
}

/**
 * Хелпер: может ли текущий пользователь удалять вузы.
 * Только admin. Дублирует бэкендовый requireRole('admin').
 */
export function useCanDeleteUniversity(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.role === 'admin';
}