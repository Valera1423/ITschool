import { ApiError, isApiError } from './errors';

/**
 * Коды ошибок фронтенда.
 * Синхронизированы с backend (backend/src/errors/codes.ts).
 *
 * Формат: CRM-{HTTP}-{NNN} или CRM-C-{NNN} для клиентских ошибок.
 */
export const ERROR_CODES = {
  // 400
  VALIDATION_FAILED: 'CRM-400-001',
  MISSING_REQUIRED_FIELD: 'CRM-400-002',
  INVALID_FORMAT: 'CRM-400-003',
  UNSUPPORTED_FILE_TYPE: 'CRM-400-004',
  FILE_TOO_LARGE: 'CRM-400-005',
  INVALID_DATE_RANGE: 'CRM-400-006',
  INVALID_JSON: 'CRM-400-007',
  INVALID_UUID: 'CRM-400-008',

  // 401
  UNAUTHORIZED: 'CRM-401-001',
  TOKEN_EXPIRED: 'CRM-401-002',
  TOKEN_INVALID: 'CRM-401-003',
  NO_TOKEN: 'CRM-401-004',
  SESSION_TIMEOUT: 'CRM-401-005',

  // 403
  FORBIDDEN: 'CRM-403-001',
  ROLE_NOT_ALLOWED: 'CRM-403-002',
  CANNOT_ASSIGN_MANAGER: 'CRM-403-003',
  BLOCKED_USER: 'CRM-403-004',
  IP_NOT_ALLOWED: 'CRM-403-005',
  CANNOT_EDIT_SELF: 'CRM-403-006',

  // 404
  NOT_FOUND: 'CRM-404-001',
  UNIVERSITY_NOT_FOUND: 'CRM-404-002',
  CONTRACT_NOT_FOUND: 'CRM-404-003',
  DOCUMENT_NOT_FOUND: 'CRM-404-004',
  INTERACTION_NOT_FOUND: 'CRM-404-005',
  TASK_NOT_FOUND: 'CRM-404-006',

  // 409
  DUPLICATE: 'CRM-409-001',
  STATE_CONFLICT: 'CRM-409-002',
  ALREADY_EXISTS: 'CRM-409-003',

  // 429
  RATE_LIMIT: 'CRM-429-001',

  // 500
  INTERNAL_ERROR: 'CRM-500-001',
  DATABASE_ERROR: 'CRM-500-002',
  EXTERNAL_API_ERROR: 'CRM-500-003',
  NETWORK_ERROR: 'CRM-500-004',

  // Client-side
  EXPORT_FAILED: 'CRM-C-001',
  CHART_RENDER_FAILED: 'CRM-C-002',
  CLIPBOARD_FAILED: 'CRM-C-003',
  UNKNOWN: 'CRM-C-999',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Человекочитаемые сообщения.
 * Backend тоже возвращает message — используется как fallback.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  'CRM-400-001': 'Ошибка валидации входных данных',
  'CRM-400-002': 'Заполните обязательное поле',
  'CRM-400-003': 'Неверный формат данных',
  'CRM-400-004': 'Этот тип файла не поддерживается',
  'CRM-400-005': 'Файл слишком большой. Максимум — 20 МБ',
  'CRM-400-006': 'Неверный диапазон дат',
  'CRM-400-007': 'Некорректный JSON',
  'CRM-400-008': 'Некорректный идентификатор',

  'CRM-401-001': 'Требуется авторизация',
  'CRM-401-002': 'Сессия истекла — войдите заново',
  'CRM-401-003': 'Недействительный токен',
  'CRM-401-004': 'Токен не предоставлен',
  'CRM-401-005': 'Сессия прервана из-за неактивности',

  'CRM-403-001': 'Недостаточно прав',
  'CRM-403-002': 'Ваша роль не позволяет выполнить действие',
  'CRM-403-003': 'Только Руководитель или Администратор может назначать ответственного',
  'CRM-403-004': 'Аккаунт заблокирован. Обратитесь к администратору',
  'CRM-403-005': 'Доступ с вашего IP запрещён',
  'CRM-403-006': 'Нельзя редактировать собственный профиль через этот эндпоинт',

  'CRM-404-001': 'Запись не найдена',
  'CRM-404-002': 'Вуз не найден',
  'CRM-404-003': 'Договор не найден',
  'CRM-404-004': 'Документ не найден',
  'CRM-404-005': 'Взаимодействие не найдено',
  'CRM-404-006': 'Задача не найдена',

  'CRM-409-001': 'Такая запись уже существует',
  'CRM-409-002': 'Действие нельзя выполнить в текущем состоянии',
  'CRM-409-003': 'Запись с такими данными уже есть',

  'CRM-429-001': 'Слишком много запросов — подождите минуту',

  'CRM-500-001': 'Внутренняя ошибка. Мы уже знаем о проблеме',
  'CRM-500-002': 'Ошибка базы данных',
  'CRM-500-003': 'Внешний сервис временно недоступен',
  'CRM-500-004': 'Нет соединения с сервером',

  'CRM-C-001': 'Не удалось создать файл',
  'CRM-C-002': 'Не удалось отрисовать диаграмму',
  'CRM-C-003': 'Не удалось скопировать в буфер',
  'CRM-C-999': 'Что-то пошло не так',
};

/** Получить сообщение по коду. Если кода нет — fallback. */
export function errorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? 'Неизвестная ошибка';
}

/**
 * Извлечь код ошибки из любого объекта.
 * Работает с ApiError, plain object и Error.
 */
export function extractErrorCode(e: unknown): string {
  if (isApiError(e)) return e.code;
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return ERROR_CODES.UNKNOWN;
}

/**
 * Извлечь статус из любой ошибки.
 */
export function extractErrorStatus(e: unknown): number | undefined {
  if (isApiError(e)) return e.status;
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

/**
 * Извлечь сообщение из любой ошибки.
 */
export function extractErrorMessage(e: unknown, fallback?: string): string {
  if (isApiError(e)) return errorMessage(e.code, e.message);
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback ?? 'Неизвестная ошибка';
}

/**
 * Приводит любое брошенное значение к ApiError.
 * Используется в catch-блоках, где мы точно знаем что это «наша» ошибка.
 */
export function toApiError(e: unknown, fallbackStatus = 0): ApiError {
  if (isApiError(e)) return e;
  if (e instanceof Error) {
    return new ApiError(e.message, fallbackStatus, ERROR_CODES.UNKNOWN);
  }
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    return new ApiError(
      typeof obj.message === 'string' ? obj.message : 'Неизвестная ошибка',
      typeof obj.status === 'number' ? obj.status : fallbackStatus,
      typeof obj.code === 'string' ? obj.code : ERROR_CODES.UNKNOWN,
      obj.details,
      typeof obj.requestId === 'string' ? obj.requestId : undefined,
    );
  }
  return new ApiError(String(e ?? 'Неизвестная ошибка'), fallbackStatus, ERROR_CODES.UNKNOWN);
}

/**
 * Понятный ли код для показа пользователю.
 * 5xx — не показываем детали, только «что-то пошло не так».
 */
export function isUserFacingError(code: string): boolean {
  return (
    code.startsWith('CRM-400') ||
    code.startsWith('CRM-401') ||
    code.startsWith('CRM-403') ||
    code.startsWith('CRM-404') ||
    code.startsWith('CRM-409') ||
    code.startsWith('CRM-429') ||
    code.startsWith('CRM-C')
  );
}