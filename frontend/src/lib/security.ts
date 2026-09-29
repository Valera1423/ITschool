import { api } from './api';
import type {
  UserSession,
  IpWhitelistEntry,
  SecurityEvent,
  PdConsent,
} from '@/types';

/**
 * Безопасность: сессии, IP-whitelist, журнал событий, согласия 152-ФЗ.
 */

// ============================================================
// СЕССИИ
// ============================================================

/**
 * Список моих активных сессий.
 *
 * userId оставлен для обратной совместимости — backend определяет
 * пользователя из токена. Параметр игнорируется.
 */
export async function listMySessions(_userId?: string): Promise<UserSession[]> {
  try {
    return await api.get<UserSession[]>('/security/sessions');
  } catch {
    return [];
  }
}

export async function revokeSession(id: string): Promise<string | null> {
  try {
    await api.delete(`/security/sessions/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

/** Завершить все сессии кроме текущей. */
export async function revokeAllMySessions(
  _userId?: string,
): Promise<string | null> {
  try {
    await api.post('/security/sessions/revoke-all');
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// IP-WHITELIST
// ============================================================

export async function listIpWhitelist(): Promise<IpWhitelistEntry[]> {
  try {
    return await api.get<IpWhitelistEntry[]>('/security/ip-whitelist');
  } catch {
    return [];
  }
}

export async function addIpEntry(
  cidr: string,
  label?: string,
): Promise<string | null> {
  try {
    await api.post('/security/ip-whitelist', {
      cidr: cidr.trim(),
      label: label || null,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function toggleIpEntry(
  id: string,
  enabled: boolean,
): Promise<string | null> {
  try {
    await api.patch(`/security/ip-whitelist/${id}`, { enabled });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteIpEntry(id: string): Promise<string | null> {
  try {
    await api.delete(`/security/ip-whitelist/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function checkMyIp(): Promise<{ allowed: boolean; ip: string | null }> {
  try {
    return await api.get<{ allowed: boolean; ip: string | null }>(
      '/security/check-ip',
    );
  } catch {
    return { allowed: true, ip: null };
  }
}

// ============================================================
// ЖУРНАЛ СОБЫТИЙ
// ============================================================

export async function listSecurityEvents(limit = 200): Promise<SecurityEvent[]> {
  try {
    return await api.get<SecurityEvent[]>(`/security/events?limit=${limit}`);
  } catch {
    return [];
  }
}

/**
 * Записать событие безопасности.
 *
 * user_id/email принимаются для обратной совместимости с вызовами
 * из UI; backend определяет пользователя из токена.
 */
export async function logSecurityEvent(input: {
  event_type: string;
  severity?: 'info' | 'warning' | 'critical';
  details?: Record<string, unknown>;
  user_id?: string | null;
  email?: string | null;
}): Promise<void> {
  try {
    await api.post('/security/events', {
      eventType: input.event_type,
      severity: input.severity ?? 'info',
      details: input.details ?? {},
      // user_id/email игнорируются backend'ом — он знает из токена
    });
  } catch {
    /* ignore */
  }
}

// ============================================================
// 152-ФЗ: СОГЛАСИЯ И ПРАВА СУБЪЕКТОВ
// ============================================================

export async function listConsents(limit = 200): Promise<PdConsent[]> {
  try {
    return await api.get<PdConsent[]>(`/security/consents?limit=${limit}`);
  } catch {
    return [];
  }
}

export async function grantConsent(input: {
  subject_type: 'contact' | 'user';
  subject_email: string;
  subject_name?: string;
  consent_type?: string;
  notes?: string;
}): Promise<string | null> {
  try {
    await api.post('/security/consents', input);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function revokeConsent(
  id: string,
  reason?: string,
): Promise<string | null> {
  try {
    await api.patch(`/security/consents/${id}`, {
      granted: false,
      notes: reason,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

/** Право на доступ: экспорт всех ПД по email. */
export async function exportPersonalData(
  email: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await api.post<Record<string, unknown>>('/security/pd/export', {
      email,
    });
  } catch {
    return null;
  }
}

/** Право на забвение: анонимизация ПД. */
export async function forgetPersonalData(
  email: string,
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  try {
    const r = await api.post<{ ok: boolean; updated: number }>(
      '/security/pd/forget',
      { email },
    );
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

// downloadJson реэкспорт из utils — не дублируем
export { downloadJson } from './utils';

// ============================================================
// ЛЕЙБЛЫ
// ============================================================

export const SECURITY_EVENT_LABELS: Record<string, string> = {
  login: 'Вход в систему',
  logout: 'Выход',
  failed_login: 'Неудачный вход',
  password_changed: 'Смена пароля',
  password_reset: 'Сброс пароля',
  mfa_enabled: '2FA включена',
  mfa_disabled: '2FA отключена',
  session_revoked: 'Сессия отозвана',
  ip_blocked: 'IP заблокирован',
  rate_limit: 'Превышен лимит запросов',
  pd_export: 'Экспорт ПД',
  pd_forget: 'Удаление ПД',
  blocked_user: 'Заблокированный пользователь',
  role_changed: 'Изменение роли',
};

export const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};