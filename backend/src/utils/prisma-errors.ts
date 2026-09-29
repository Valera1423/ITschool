/**
 * Единая обработка ошибок Prisma без использования instanceof.
 * Работает с любым вариантом импорта и с кастомным output.
 */

export interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  message?: string;
}

export function isPrismaError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((err as { code: string }).code)
  );
}

/** Классификация для HTTP-статуса. */
export function prismaErrorToHttp(err: PrismaKnownError): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  switch (err.code) {
    case 'P2002':
      return {
        status: 409,
        code: 'CRM-409-003',
        message: 'Запись с такими данными уже существует',
        details: err.meta,
      };
    case 'P2025':
      return { status: 404, code: 'CRM-404-001', message: 'Запись не найдена' };
    case 'P2003':
      return { status: 409, code: 'CRM-409-002', message: 'Связанная запись не найдена' };
    case 'P2014':
      return { status: 409, code: 'CRM-409-002', message: 'Нарушение связи между записями' };
    case 'P2021':
    case 'P2022':
      return {
        status: 500,
        code: 'CRM-500-002',
        message: 'Схема БД не соответствует модели. Примените миграции.',
      };
    case 'P1001':
      return { status: 503, code: 'CRM-500-004', message: 'БД недоступна' };
    case 'P1008':
      return { status: 504, code: 'CRM-500-002', message: 'Таймаут БД' };
    case 'P2024':
      return { status: 503, code: 'CRM-500-002', message: 'Пул соединений переполнен' };
    default:
      return { status: 500, code: 'CRM-500-002', message: 'Ошибка базы данных' };
  }
}