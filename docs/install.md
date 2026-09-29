# Установка

Документ описывает установку системы для локальной разработки.
Для прода см. [Деплой](deploy.md).

## Требования

| Компонент | Версия | Проверка |
|---|---|---|
| Node.js | ≥ 20.0.0 | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Docker | ≥ 24 | `docker --version` |
| Docker Compose | ≥ 2.20 | `docker compose version` |
| Git | любая | `git --version` |

**Свободное место:** ≥ 15 ГБ (образы + тома + backups).
**RAM:** ≥ 8 ГБ (Docker + IDE + браузер).

## Шаг 1. Клонирование

```bash
git clone https://github.com/rt-it-school/crm.git
cd crm
Шаг 2. Настройка окружения
Backend
bash
cp backend/.env.example backend/.env
Откройте backend/.env и заполните:

bash
NODE_ENV=development
PORT=4000

# PostgreSQL (совпадает с docker-compose.dev.yml)
DATABASE_URL=postgresql://crm_user:crm_pass@localhost:5432/crm_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Keycloak (dev-инстанс)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=it-school
KEYCLOAK_CLIENT_ID=crm-backend
KEYCLOAK_CLIENT_SECRET=backend-secret-change-in-prod

JWT_ISSUER=http://localhost:8080/realms/it-school
JWT_AUDIENCE=account

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=crm_minio
MINIO_SECRET_KEY=minio_pass_dev
MINIO_BUCKET=documents
MINIO_PUBLIC_URL=http://localhost/storage

# PII-шифрование (152-ФЗ)
# В dev можно оставить как есть, но в проде обязателен ≥32 символов.
PII_KEY=dev-only-key-do-not-use-in-production-0123456789abcdef

# Swagger
SWAGGER_ENABLED=true

# Cron (отключить, если не нужны напоминания)
ENABLE_CRON=true

# ClamAV (можно отключить в dev для скорости)
CLAMAV_ENABLED=false
Frontend
bash
cp frontend/.env.example frontend/.env.local
Откройте frontend/.env.local:

bash
VITE_API_URL=/api/v1

VITE_OIDC_AUTHORITY=http://localhost:8080/realms/it-school
VITE_OIDC_CLIENT_ID=crm-frontend
VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_OIDC_SCOPE=openid profile email roles

VITE_MINIO_PUBLIC_URL=http://localhost/storage

# Заполнить после `npm run vapid`
VITE_VAPID_PUBLIC_KEY=

# Sentry — оставьте пустым, если не используете
VITE_SENTRY_DSN=
Шаг 3. Запуск инфраструктуры
bash
docker compose -f docker-compose.dev.yml up -d
Поднимется:

Сервис	Порт	Назначение
PostgreSQL 16	5432	БД
Redis 7	6379	Кэш, очереди
Keycloak 26	8080	OIDC
MinIO	9000, 9001	Файлы
mock-lms	4100	Заглушка LMS
ClamAV	3310	Антивирус (можно не поднимать)
Проверка:

bash
docker compose -f docker-compose.dev.yml ps
# Все сервисы должны быть "healthy" или "running"
Логи конкретного сервиса:

bash
docker compose -f docker-compose.dev.yml logs -f keycloak
Шаг 4. Установка зависимостей
bash
npm install
Это установит зависимости и для frontend, и для backend
(npm workspaces).

Шаг 5. Миграции и seed
bash
# Генерация Prisma Client
npm run prisma:generate --workspace=backend

# Применить миграции
npm run prisma:migrate --workspace=backend

# Засеять демо-данными
npm run prisma:seed --workspace=backend
Seed создаст:

30 вузов

~220 взаимодействий

~100 задач

10 договоров

Все каталоги (направления, продукты, вендоры, ответственные)

Workflow «Полный цикл» (14 шагов)

База знаний (руководства пользователя и администратора)

3 демо-профиля

Шаг 6. Запуск backend
bash
npm run dev --workspace=backend
Backend будет доступен на http://localhost:4000.

Проверка:

bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
Swagger UI: http://localhost:4000/api/docs

Шаг 7. Запуск frontend
В отдельном терминале:

bash
npm run dev --workspace=frontend
Frontend будет доступен на http://localhost:5173.

Шаг 8. Первый вход
Откройте http://localhost:5173

Нажмите «Войти через SSO»

Используйте тестовые учётки Keycloak (создаются в realm):

admin@rt.ru / admin (роль admin)

manager@rt.ru / manager (роль manager)

nam@rt.ru / nam (роль nam)

Пароль задаётся в docker/keycloak/realm-it-school.json или вручную через
Keycloak Admin Console (http://localhost:8080, логин admin/admin).

Проверка установки
□ docker compose -f docker-compose.dev.yml ps — все healthy
□ curl http://localhost:4000/health/ready — {"ok":true}
□ http://localhost:4000/api/docs — Swagger открывается
□ http://localhost:5173 — фронт открывается
□ Вход через SSO работает
□ В разделе «Вузы» видны 30 вузов из seed
□ В разделе «База знаний» видны статьи
□ В «Workflow» доступны 14 шагов
Частые проблемы
«Port 5432 already in use»
У вас уже запущен локальный PostgreSQL. Варианты:

Остановите локальный: sudo systemctl stop postgresql

Или измените порт в docker-compose.dev.yml:

yaml
ports:
  - '5433:5432'
И в backend/.env: DATABASE_URL=...@localhost:5433/...

Keycloak не поднимается
Проверьте логи:

bash
docker compose -f docker-compose.dev.yml logs keycloak
Обычно проблема — схема keycloak в БД не создалась. Пересоздайте:

bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
Prisma миграции падают
Убедитесь, что PostgreSQL готов:

bash
docker exec crm-postgres pg_isready -U crm_user -d crm_db
Перезапустите миграции:

bash
npm run prisma:migrate --workspace=backend
Frontend не подключается к backend
Проверьте frontend/.env.local:

bash
VITE_API_URL=/api/v1
Прокси настроен в vite.config.ts — запросы уходят на http://localhost:4000.

ClamAV долго стартует
ClamAV при первом запуске качает ~200 МБ сигнатур. Если он вам не нужен в dev:

bash
docker compose -f docker-compose.dev.yml stop clamav
И в backend/.env: CLAMAV_ENABLED=false.