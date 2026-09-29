import type { UserRole } from '@/types';

/**
 * Роли по ТЗ п.4.11:
 * - Администратор — техспециалист ИТ Школы РТК
 * - Руководитель — руководитель менеджеров (может назначать ответственных)
 * - Пользователь (НАМ) — менеджер по вузам (не может менять ответственного)
 *
 * Внутренние значения: admin / manager / nam.
 */

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Руководитель',
  nam: 'Пользователь (НАМ)',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Технический специалист. Управляет пользователями, каталогами, интеграциями, безопасностью.',
  manager: 'Руководитель менеджеров. Может всё, кроме управления пользователями и системных настроек.',
  nam: 'Менеджер по вузам (Key Account Manager). Работает с вузами, задачами, календарём. Не может менять ответственного.',
};

/**
 * Получить русскую метку роли.
 * Работает и со старыми значениями (viewer, Менеджер и т.п.) — для обратной совместимости.
 */
export function roleLabel(role: UserRole | string | undefined | null): string {
  if (!role) return '—';
  if (role in ROLE_LABELS) return ROLE_LABELS[role as UserRole];

  // Legacy mapping
  if (role === 'viewer') return 'Пользователь (НАМ)';
  if (role === 'Администратор') return 'Администратор';
  if (role === 'Менеджер' || role === 'Руководитель') return 'Руководитель';

  return String(role);
}

/** Получить внутреннее значение роли */
export function roleValue(role: string): UserRole {
  if (role === 'admin' || role === 'Администратор') return 'admin';
  if (role === 'manager' || role === 'Менеджер' || role === 'Руководитель') return 'manager';
  return 'nam';
}

// ============================================================
// ПРОВЕРКИ ПРАВ
// ============================================================

/** Может управлять пользователями */
export function canManageUsers(role: UserRole | string | undefined): boolean {
  return role === 'admin';
}

/** Может назначать ответственного менеджера (по ТЗ) */
export function canAssignManager(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

/** Может редактировать любые записи */
export function canEditAnyRecord(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'manager' || role === 'nam';
}

/** Может управлять каталогами (вендоры, направления, продукты) */
export function canManageCatalogs(role: UserRole | string | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

/** Может управлять интеграциями */
export function canManageIntegrations(role: UserRole | string | undefined): boolean {
  return role === 'admin';
}

/** Может смотреть аудит и безопасность */
export function canViewAudit(role: UserRole | string | undefined): boolean {
  return role === 'admin';
}

/** Может восстанавливать из бэкапа */
export function canManageBackups(role: UserRole | string | undefined): boolean {
  return role === 'admin';
}