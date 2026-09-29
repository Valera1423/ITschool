// frontend/src/constants/index.ts
import type { UserRole } from '@/types';

/**
 * Цвета статусов.
 * ⚠️ С Спринта 1 — на семантических токенах Атомаро.
 */
export const STATUS_COLORS: Record<string, string> = {
  // ── Вузы ──
  'Новый':       'bg-atmr-info-soft text-atmr-info-fg',
  'Переговоры':  'bg-atmr-warning-soft text-atmr-warning-fg',
  'Обучение':    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Внедрение':   'bg-atmr-success-soft text-atmr-success-fg',
  'Партнёр':     'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'Отказ':       'bg-atmr-error-soft text-atmr-error-fg',

  // ── Взаимодействия ──
  'Запланировано': 'bg-atmr-info-soft text-atmr-info-fg',
  'В работе':      'bg-atmr-warning-soft text-atmr-warning-fg',
  'Завершено':     'bg-atmr-success-soft text-atmr-success-fg',
  'Отменено':      'bg-atmr-error-soft text-atmr-error-fg',

  // ── Задачи ──
  'К выполнению': 'bg-atmr-bg-surface2 text-atmr-fg-soft',
  'Готово':       'bg-atmr-success-soft text-atmr-success-fg',

  // ── Приоритеты ──
  'Низкий':   'bg-atmr-bg-surface2 text-atmr-fg-soft',
  'Средний':  'bg-atmr-info-soft text-atmr-info-fg',
  'Высокий':  'bg-atmr-warning-soft text-atmr-warning-fg',
  'Срочный':  'bg-atmr-error-soft text-atmr-error-fg',

  // ── Workflow ──
  'Активен':   'bg-atmr-success-soft text-atmr-success-fg',
  'На паузе':  'bg-atmr-warning-soft text-atmr-warning-fg',
  'Завершён':  'bg-atmr-bg-surface2 text-atmr-fg-soft',
  'Ожидает':   'bg-atmr-bg-surface2 text-atmr-fg-soft',

  // ── Интеграции ──
  'Отключена': 'bg-atmr-bg-surface2 text-atmr-fg-soft',
  'Ошибка':    'bg-atmr-error-soft text-atmr-error-fg',

  // ── Роли ──
  'Администратор':      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Руководитель':       'bg-atmr-info-soft text-atmr-info-fg',
  'Пользователь (НАМ)': 'bg-atmr-bg-surface2 text-atmr-fg-soft',

  // ── Аудит ──
  'Создано':        'bg-atmr-success-soft text-atmr-success-fg',
  'Изменено':       'bg-atmr-info-soft text-atmr-info-fg',
  'Удалено':        'bg-atmr-error-soft text-atmr-error-fg',
  'Восстановлено':  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',

  // ── Передача ПО ──
  'Не передан':        'bg-atmr-bg-surface2 text-atmr-fg-soft',
  'Передан частично':  'bg-atmr-warning-soft text-atmr-warning-fg',
  'Передан полностью': 'bg-atmr-success-soft text-atmr-success-fg',
  'Отозван':           'bg-atmr-error-soft text-atmr-error-fg',
};

export const UNIVERSITY_STATUSES = [
  'Новый', 'Переговоры', 'Обучение', 'Внедрение', 'Партнёр', 'Отказ',
] as const;

export const HANDOVER_STATUSES = [
  'Не передан', 'Передан частично', 'Передан полностью', 'Отозван',
] as const;

export const INTERACTION_TYPES = ['Звонок', 'Встреча', 'Письмо', 'Документ'] as const;

export const INTERACTION_STATUSES = [
  'Запланировано', 'В работе', 'Завершено', 'Отменено',
] as const;

export const TASK_STATUSES = [
  'К выполнению', 'В работе', 'Готово', 'Отменено',
] as const;

export const TASK_PRIORITIES = ['Низкий', 'Средний', 'Высокий', 'Срочный'] as const;

export const KANBAN_COLUMNS = ['К выполнению', 'В работе', 'Готово'] as const;

export const WORKFLOW_STATUSES = ['Активен', 'На паузе', 'Завершён'] as const;

export const STEP_STATUSES = ['Ожидает', 'В работе', 'Готово', 'Отменён'] as const;

export const MANAGERS = ['Анна Кузнецова', 'Максим Орлов', 'Ольга Миронова'] as const;

export const USER_ROLES: UserRole[] = ['admin', 'manager', 'nam'];

export const INTEGRATION_TYPES = [
  { value: 'custom_api', label: 'Свой API', hint: 'Любой REST endpoint с ключом' },
  { value: 'pbx', label: 'Виртуальная АТС', hint: 'МТС, Билайн, Мегафон, Sipuni, Mango' },
  { value: 'telegram', label: 'Telegram Bot', hint: 'Отправка уведомлений в чат' },
  { value: 'whatsapp', label: 'WhatsApp Business', hint: 'Шаблонные сообщения' },
  { value: 'max', label: 'MAX мессенджер', hint: 'Национальный мессенджер VK' },
  { value: 'email', label: 'Email (SMTP)', hint: 'Корпоративная почта' },
  { value: 'sms', label: 'SMS-шлюз', hint: 'SMS-уведомления через провайдера' },
] as const;

export const INTEGRATION_STATUSES = ['Активна', 'Отключена', 'Ошибка'] as const;

export const VIEWS = [
  { key: 'dashboard', label: 'Дашборд', icon: 'LayoutDashboard' },
  { key: 'universities', label: 'Вузы', icon: 'GraduationCap' },
  { key: 'interactions', label: 'Взаимодействия', icon: 'MessagesSquare' },
  { key: 'calendar', label: 'Календарь', icon: 'CalendarDays' },
  { key: 'calls', label: 'Звонки', icon: 'Phone' },
  { key: 'kanban', label: 'Канбан', icon: 'Trello' },
  { key: 'tasks', label: 'Задачи', icon: 'CheckSquare' },
  { key: 'workflows', label: 'Workflow', icon: 'Workflow' },
  { key: 'contracts', label: 'Договоры', icon: 'FileText' },
  { key: 'segments', label: 'Сегменты', icon: 'Users' },
  { key: 'inbox', label: 'Инбокс', icon: 'Inbox' },
  { key: 'reports', label: 'Отчёты', icon: 'FileBarChart' },
  { key: 'metrics', label: 'Показатели', icon: 'BarChart3' },
  { key: 'analytics', label: 'Аналитика', icon: 'TrendingUp' },
  { key: 'executive', label: 'Для руководства', icon: 'Award' },
  { key: 'users', label: 'Пользователи', icon: 'Users' },
  { key: 'integrations', label: 'Интеграции', icon: 'Plug' },
  { key: 'catalogs', label: 'Каталоги', icon: 'Layers' },
  { key: 'journal', label: 'Журнал', icon: 'ShieldCheck' },
  { key: 'security', label: 'Безопасность', icon: 'Lock' },
  { key: 'trash', label: 'Корзина', icon: 'Trash2' },
  { key: 'backup', label: 'Бэкапы', icon: 'Database' },
  { key: 'knowledge', label: 'База знаний', icon: 'BookOpen' },
  { key: 'settings', label: 'Настройки', icon: 'Settings' },
];

export const PRIORITY_WEIGHT: Record<string, number> = {
  'Низкий': 0, 'Средний': 1, 'Высокий': 2, 'Срочный': 3,
};

export const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'pdf', 'zip', 'gz', 'gzip', 'rar',
  'doc', 'docx', 'xls', 'xlsx',
] as const;

export const MAX_FILE_SIZE_MB = 20;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;