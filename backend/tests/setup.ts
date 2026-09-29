import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { execSync } from 'node:child_process';

process.env.NODE_ENV = 'test';
process.env.TEST_BYPASS_AUTH = 'true';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://crm_user:crm_pass@localhost:5433/crm_db_test';
process.env.KEYCLOAK_URL ??= 'http://localhost:8080';
process.env.KEYCLOAK_REALM ??= 'it-school';
process.env.KEYCLOAK_CLIENT_ID ??= 'crm-backend';
process.env.KEYCLOAK_CLIENT_SECRET ??= 'test-secret';
process.env.JWT_ISSUER ??= 'http://localhost:8080/realms/it-school';
process.env.JWT_AUDIENCE ??= 'account';
process.env.MINIO_ENDPOINT ??= 'localhost';
process.env.MINIO_ACCESS_KEY ??= 'minio';
process.env.MINIO_SECRET_KEY ??= 'minio';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.RATE_LIMIT_MAX = '100000'; // не мешать тестам

// ============================================================
// ВАЖНО: страховка от случайного запуска тестов на dev/prod БД.
// Если DATABASE_URL НЕ содержит "crm_db_test" — немедленно падаем.
// Это защищает от разрушения реальных данных (setup.ts делает
// TRUNCATE TABLE ... CASCADE перед каждым тестом).
// ============================================================
beforeAll(() => {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('crm_db_test') && !url.includes('_test')) {
    throw new Error(
      `❌ Тестовая БД должна содержать "crm_db_test" в имени.\n` +
      `Текущий DATABASE_URL: ${url}\n` +
      `Установи .env.test или переопредели DATABASE_URL_TEST.`,
    );
  }
});

// ============================================================
// Применяем схему к тестовой БД один раз.
//
// ВАЖНО (исправлено):
//  - stdio: 'inherit' — вывод prisma migrate виден в консоли теста.
//    Раньше стоял 'ignore', и любая проблема со схемой (битая миграция,
//    несоответствие search_vector и триггеров и т.п.) тихо проглатывалась,
//    а потом падала в 20 тестах как «column 'new' does not exist».
//  - throw e — если миграции упали, нет смысла запускать тесты: они
//    всё равно упадут на несуществующих колонках. Лучше упасть здесь,
//    с внятным сообщением.
// ============================================================
beforeAll(() => {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (e) {
    console.error('\n❌ prisma migrate deploy упал — тесты не могут стартовать\n');
    throw e;
  }
});

// ============================================================
// Очищаем таблицы перед каждым тестом.
//
// ВАЖНО (исправлено):
//  Раньше был `.catch(() => {})` — он молча глотал ЛЮБУЮ ошибку.
//  Из-за этого:
//    - если TRUNCATE падал (например, из-за активной транзакции в
//      параллельном тесте или незакоммиченного lock'а),
//      таблица НЕ очищалась;
//    - в ней оставались записи со status=0 из предыдущего прогона
//      (idempotency_keys), и следующий тест ловил 409 Conflict
//      вместо 201 Created.
//
//  Теперь пропускаем ТОЛЬКО ожидаемую ошибку «таблицы нет» (не все
//  миграции применялись), а любую другую — пробрасываем, чтобы
//  проблема была видна сразу на setup, а не в бизнес-логике.
// ============================================================
beforeEach(async () => {
  const tables = [
    'audit_log', 'inbox_messages', 'webhook_logs',
    'automation_runs', 'automation_rules',
    'notifications', 'push_subscriptions', 'user_preferences',
    'onboarding_progress', 'onboarding_steps', 'saved_views',
    'custom_field_values', 'custom_fields',
    'university_tags', 'tags', 'comments',
    'contract_versions', 'contract_approvals', 'contracts',
    'documents', 'workflow_transitions', 'workflow_universities',
    'workflow_steps', 'workflows', 'tasks', 'interactions',
    'university_contacts', 'universities', 'it_products', 'it_directions',
    'vendors', 'managers', 'profiles',
    'integration_sync_logs', 'integration_field_mappings',
    'integration_endpoints', 'integrations',
    'ip_whitelist', 'security_events', 'pd_consents', 'user_sessions',
    'idempotency_keys', 'reminder_log', 'calls',
    'google_oauth_tokens', 'kb_feedback', 'kb_articles', 'kb_categories',
    'dashboards', 'segments', 'profile_settings',
  ];

  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const msg = e instanceof Error ? e.message : String(e);

      // Ожидаемая ошибка: таблицы нет (не все миграции применялись).
      // Postgres: 42P01 = undefined_table. Prisma обычно отдаёт P2010
      // с этим SQLSTATE. Также ловим по тексту — на всякий случай.
      const isMissingTable =
        code === 'P2010' ||
        /does not exist/i.test(msg) ||
        /undefined_table/i.test(msg);

      if (isMissingTable) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️  TRUNCATE ${t}: таблицы нет — пропускаем`);
        continue;
      }

      // Всё остальное (deadlock, permission denied, connection lost) —
      // это проблема инфраструктуры, а не бизнес-логики. Пробрасываем,
      // чтобы тест упал здесь, а не маскировался под ошибку API.
      // eslint-disable-next-line no-console
      console.error(`❌ TRUNCATE ${t} failed: ${msg}`);
      throw e;
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});