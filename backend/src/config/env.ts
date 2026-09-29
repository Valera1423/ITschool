// backend/src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

/**
 * Валидация переменных окружения через Zod.
 * При ошибке приложение не запускается.
 *
 * ВАЖНО (152-ФЗ): в production обязателен PII_KEY длиной ≥32 символа,
 * иначе персональные данные не шифруются — формальное нарушение закона.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  CORS_ORIGINS: z.string().min(1),

  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),

  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),

  // Отдельный лимит для /reports/* и /analytics/* (тяжёлые эндпоинты).
  // Дефолт 30 для прода. На нагрузочных тестах ставим 100000+ через .env.
  REPORT_RATE_LIMIT_MAX: z.coerce.number().default(30),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // 152-ФЗ: ключ шифрования ПД.
  //   - prod: обязателен, ≥32 символов (проверяется ниже в refine);
  //   - dev/test: если отсутствует — приложение стартует,
  //     но пишет громкое предупреждение (шифрование ПД выключено).
  PII_KEY: z.string().optional(),

  // OAuth state secret
  OAUTH_STATE_SECRET: z.string().optional(),

  // ClamAV (антивирус). CLAMAV_ENABLED=false отключает проверку
  // (например, для нагрузочных тестов или маленьких стендов).
  CLAMAV_ENABLED: z.enum(['true', 'false']).default('true'),
  CLAMAV_HOST: z.string().default('clamav'),
  CLAMAV_PORT: z.coerce.number().default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().default(30_000),

  // Сессии: idle-таймаут в минутах и абсолютный максимум в часах.
  // Значения по умолчанию соответствуют рекомендациям ФСТЭК
  // для УЗ-2 (30 мин неактивности, 10 ч максимум).
  SESSION_IDLE_MIN: z.coerce.number().default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().default(10),

  // Полный JSON-отчёт: лимиты по коллекциям
  FULL_REPORT_LIMIT_UNIVERSITIES: z.coerce.number().default(1000),
  FULL_REPORT_LIMIT_INTERACTIONS: z.coerce.number().default(5000),
  FULL_REPORT_LIMIT_TASKS: z.coerce.number().default(5000),
  FULL_REPORT_LIMIT_CONTRACTS: z.coerce.number().default(2000),
  FULL_REPORT_LIMIT_COMMENTS: z.coerce.number().default(5000),
  FULL_REPORT_LIMIT_DOCUMENTS: z.coerce.number().default(2000),
  FULL_REPORT_LIMIT_NOTIFICATIONS: z.coerce.number().default(1000),
  FULL_REPORT_LIMIT_AUDIT: z.coerce.number().default(1000),
  FULL_REPORT_LIMIT_INBOX: z.coerce.number().default(500),
  FULL_REPORT_LIMIT_CALLS: z.coerce.number().default(500),
  FULL_REPORT_LIMIT_TRANSITIONS: z.coerce.number().default(5000),
  FULL_REPORT_LIMIT_SEGMENTS: z.coerce.number().default(500),
  FULL_REPORT_LIMIT_SAVED_VIEWS: z.coerce.number().default(200),

  APP_URL: z.string().url().default('http://localhost:5173'),
})
.refine(
  (data) => {
    if (data.VAPID_PUBLIC_KEY && !data.VAPID_PRIVATE_KEY) return false;
    if (!data.VAPID_PUBLIC_KEY && data.VAPID_PRIVATE_KEY) return false;
    return true;
  },
  { message: 'VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY должны быть заданы вместе' },
)
.refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      if (data.KEYCLOAK_URL.includes('localhost')) return false;
      if (data.APP_URL.includes('localhost')) return false;
      // 152-ФЗ: в проде PII_KEY обязателен
      if (!data.PII_KEY || data.PII_KEY.length < 32) return false;
    }
    return true;
  },
  {
    message:
      'В production обязательны: не-localhost URL и PII_KEY длиной ≥32 символов (152-ФЗ)',
  },
)
.refine(
  (data) => {
    // В dev/test если PII_KEY не задан — это допустимо,
    // но пишем предупреждение (сделаем в конце файла).
    if (data.NODE_ENV === 'production') return true; // уже проверено выше
    if (!data.PII_KEY) return true;
    return data.PII_KEY.length >= 32;
  },
  {
    message:
      'PII_KEY задан, но короче 32 символов. Либо удалите переменную (dev), либо используйте ≥32 символа.',
  },
);

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Ошибка конфигурации:');
  const errors = parsed.error.flatten().fieldErrors;
  for (const [key, value] of Object.entries(errors)) {
    console.error(`   ${key}: ${value?.join(', ')}`);
  }
  // Показываем top-level refine ошибки
  const formErrors = parsed.error.flatten().formErrors;
  if (formErrors.length > 0) {
    console.error('   Общие проверки:');
    formErrors.forEach((e) => console.error(`   - ${e}`));
  }
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Предупреждение о выключенном шифровании ПД в dev/test
if (!env.PII_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n' +
      '⚠️  PII_KEY не задан — персональные данные (email, телефоны)\n' +
      '    сохраняются в БД в ОТКРЫТОМ ВИДЕ.\n' +
      '    Для dev-окружения это допустимо, для production — нет.\n' +
      '    Сгенерируйте ключ: openssl rand -base64 48\n',
  );
}