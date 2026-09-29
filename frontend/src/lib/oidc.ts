// frontend/src/lib/oidc.ts
import {
  UserManager,
  WebStorageStateStore,
  type User,
  type UserManagerSettings,
} from 'oidc-client-ts';

/**
 * Keycloak OIDC-клиент.
 *
 * ─── Про silent renew ────────────────────────────────────────────
 * automaticSilentRenew: false — сознательное решение для dev.
 *
 * Причины:
 *   1. iframe-silent-renew не работает, если браузер блокирует
 *      сторонние cookie (Chrome 3rd-party cookies, Safari ITP).
 *      Keycloak на localhost:8080 и фронт на localhost:5173 —
 *      это разные origins, поэтому браузер считает cookie
 *      сторонними и режет их.
 *   2. Keycloak вернёт 400 "Invalid parameter: redirect_uri",
 *      если silent_redirect_uri не зарегистрирован в клиенте.
 *
 * Что делаем вместо iframe:
 *   Используем refresh_token grant. Keycloak 26 по умолчанию
 *   выдаёт refresh_token с access token. Обновление через
 *   refresh_token работает без iframe и без сторонних cookie.
 *   См. `refreshAccessToken()` ниже.
 *
 * accessTokenLifespan в Keycloak (realm-it-school.json) = 900 сек.
 * ssoSessionIdleTimeout = 1800 сек.
 *
 * ─── Когда включать iframe-silent-renew ─────────────────────────
 * Только после того, как:
 *   - в realm добавлен http://localhost:5173/silent-renew.html
 *     в Valid Redirect URIs клиента crm-frontend;
 *   - в /public/silent-renew.html подключён oidc-client-ts;
 *   - VITE_OIDC_SILENT_REDIRECT_URI задан в .env.local.
 * Тогда `automaticSilentRenew` можно выставить в true —
 * но refresh-флоу уже делает то же самое надёжнее.
 */

const authority = import.meta.env.VITE_OIDC_AUTHORITY;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI;
const silentRedirectUri = import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI;
const postLogoutRedirectUri = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI;
const scope = import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile email roles';

if (!authority || !clientId || !redirectUri) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Не заданы OIDC-переменные в .env. ' +
      'Скопируйте frontend/.env.example → frontend/.env.local и заполните VITE_OIDC_*.',
  );
}

// ───────────────────────────────────────────────────────────────
// Конфиг UserManager
// ───────────────────────────────────────────────────────────────

const settings: UserManagerSettings = {
  authority,
  client_id: clientId,
  redirect_uri: redirectUri,
  post_logout_redirect_uri: postLogoutRedirectUri,
  scope,

  response_type: 'code',
  loadUserInfo: true,

  // Silent renew через iframe отключён (см. комментарий выше).
  // Если включать — раскомментировать silent_redirect_uri и
  // поставить automaticSilentRenew: true ниже по коду один раз.
  automaticSilentRenew: false,

  // Мониторинг сессии через iframe тоже не работает в dev.
  monitorSession: false,

  // Не сбрасывать hash из URL — оставляем чистые URL.
  filterProtocolClaims: true,

  // Таймаут на случай, если silent-запрос всё же включён.
  silentRequestTimeoutInSeconds: 10,

  // userStore — localStorage: сессия живёт между вкладками.
  userStore: new WebStorageStateStore({ store: window.localStorage }),

  // stateStore — sessionStorage: state нужен только в рамках одного окна.
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
};

// Подавляем предупреждение о неиспользуемой переменной: silent_redirect_uri
// нужен только при включении iframe-silent-renew (см. комментарий выше).
void silentRedirectUri;

export const userManager = new UserManager(settings);

// ───────────────────────────────────────────────────────────────
// Токен для не-React модулей (lib/api.ts, lib/sse.ts и т.п.)
// ───────────────────────────────────────────────────────────────

/**
 * Синхронно читает access_token из storage.
 *
 * ВАЖНО: не парсим JSON руками — формат ключа в oidc-client-ts
 * менялся между v2 (`oidc.user:...`) и v3, и может меняться дальше.
 * Вместо этого используем официальный `User.fromStorageString()`.
 */
export function getStoredToken(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('oidc.user:')) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const user = User.fromStorageString(raw);
      if (!user.access_token) continue;

      if (user.expires_at && user.expires_at * 1000 <= Date.now()) {
        return null;
      }

      return user.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * То же, что getStoredToken(), но асинхронно и через официальный API.
 */
export async function getStoredTokenAsync(): Promise<string | null> {
  try {
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────
// Refresh через refresh_token (без iframe)
// ───────────────────────────────────────────────────────────────

/**
 * Дедуплицированный refresh.
 */
let refreshPromise: Promise<User | null> | null = null;

export async function refreshAccessToken(): Promise<User | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<User | null> => {
    try {
      const current = await userManager.getUser();
      if (!current) return null;

      if (!current.refresh_token) {
        // eslint-disable-next-line no-console
        console.warn('[oidc] refresh_token отсутствует — нужна повторная аутентификация');
        return null;
      }

      const renewed = await userManager.signinSilent();
      return renewed ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[oidc] refresh failed:', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Совместимый алиас. Раньше вызывался как `silentRenew()` —
 * теперь это `refreshAccessToken()`.
 */
export const silentRenew = refreshAccessToken;

// ───────────────────────────────────────────────────────────────
// Логаут
// ───────────────────────────────────────────────────────────────

export async function clearOidcSession(): Promise<void> {
  try {
    await userManager.removeUser();
  } catch {
    /* ignore */
  }
}

export async function signOutRedirect(): Promise<void> {
  try {
    await userManager.signoutRedirect();
  } catch {
    await clearOidcSession();
    window.location.replace('/');
  }
}

export async function signInRedirect(returnTo?: string): Promise<void> {
  const state = returnTo
    ? { returnTo }
    : { returnTo: window.location.pathname + window.location.search };
  await userManager.signinRedirect({ state });
}

export function getReturnToFromState(state: unknown): string {
  if (state && typeof state === 'object' && 'returnTo' in state) {
    const v = (state as { returnTo?: unknown }).returnTo;
    if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) {
      return v;
    }
  }
  return '/';
}

export type { User };