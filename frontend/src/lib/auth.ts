import { userManager } from './oidc';
import { logger } from './logger';

export async function signIn(): Promise<void> {
  await userManager.signinRedirect();
}

export async function signOut(): Promise<void> {
  await userManager.signoutRedirect();
}

export async function signOutSilent(): Promise<void> {
  try {
    await userManager.removeUser();
  } catch (e) {
    logger.warn('Ошибка при выходе', e);
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await userManager.getUser();
    return !!user && !user.expired;
  } catch {
    return false;
  }
}

/**
 * PATCH /auth/me — обновление собственного профиля.
 * ВАЖНО: поля camelCase, соответствуют updateMeBody на backend.
 */
export interface UpdateProfileSelfPayload {
  fullName?: string;
  email?: string;
  phone?: string | null;
  avatarColor?: 'blue' | 'green' | 'orange' | 'purple';
  workspaceName?: string;
  notificationsEnabled?: boolean;
}

export async function updateProfileSelf(
  patch: UpdateProfileSelfPayload,
): Promise<{ error: string | null }> {
  try {
    const { api } = await import('./api');
    await api.patch('/auth/me', patch);
    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Не удалось сохранить профиль',
    };
  }
}