/**
 * Справочник permissions.
 * Используется UI и backend middleware.
 */

export interface PermissionDef {
  code: string;
  label: string;
  group: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // Управление вузами
  { code: 'universities.create',  label: 'Создавать вузы',   group: 'Вузы' },
  { code: 'universities.update',  label: 'Редактировать вузы', group: 'Вузы' },
  { code: 'universities.delete',  label: 'Удалять вузы',     group: 'Вузы' },
  { code: 'universities.import',  label: 'Импорт вузов',     group: 'Вузы' },
  { code: 'universities.export',  label: 'Экспорт вузов',    group: 'Вузы' },
  { code: 'universities.assign_manager', label: 'Назначать ответственного', group: 'Вузы' },

  // Договоры
  { code: 'contracts.create',     label: 'Создавать договоры', group: 'Договоры' },
  { code: 'contracts.approve',    label: 'Согласовывать',      group: 'Договоры' },
  { code: 'contracts.sign',       label: 'Подписывать',        group: 'Договоры' },

  // Аналитика
  { code: 'analytics.view',       label: 'Смотреть аналитику', group: 'Аналитика' },
  { code: 'analytics.export',     label: 'Экспорт отчётов',    group: 'Аналитика' },

  // Интеграции и админ
  { code: 'integrations.manage',  label: 'Управлять интеграциями', group: 'Администрирование' },
  { code: 'catalogs.manage',      label: 'Управлять каталогами',   group: 'Администрирование' },
  { code: 'automation.manage',    label: 'Управлять правилами',    group: 'Администрирование' },
  { code: 'users.manage',         label: 'Управлять пользователями', group: 'Администрирование' },
  { code: 'security.view',        label: 'Смотреть безопасность',  group: 'Администрирование' },
  { code: 'security.ip_whitelist',label: 'IP-whitelist',           group: 'Администрирование' },
  { code: 'audit.view',           label: 'Смотреть журнал',        group: 'Администрирование' },
  { code: 'backup.manage',        label: 'Управлять бэкапами',     group: 'Администрирование' },
];

export const PERMISSION_CODES = new Set(PERMISSIONS.map((p) => p.code));