# ИТ Школа Ростелеком · CRM

**Система контроля и обработки статистических данных по обучению студентов ВУЗов и школ по ИТ-направлениям.**

[![Docs](https://img.shields.io/badge/docs-mkdocs-blue)](https://rt-it-school.github.io/crm/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](https://docs.docker.com/compose/)

---

## О проекте

CRM автоматизирует полный цикл взаимодействия с вузами по ИТ-направлениям:
от поиска контактного лица до контроля исполнения 14-шагового workflow.
Система соответствует требованиям **152-ФЗ** «О персональных данных»
и приказа **ФСТЭК № 117** (УЗ-2).

**Разработано для:** ИТ Школа Ростелеком (ЛЦТ 2026).

### Ключевые возможности

- **Workflow** из 14 шагов с правилами переходов, вложениями и комментариями
- **Аналитика** — ABC/XYZ, RFM, LTV, когортный анализ, сравнение периодов
- **Отчёты** — XLSX, XLS, PDF, CSV, JSON, презентации для руководства
- **Интеграции** — LMS, Laravel CMS, Telegram, WhatsApp, ЭДО (Диадок, СБИС)
- **Безопасность** — шифрование ПД (AES-256-GCM), аудит доступа, антивирус (ClamAV)
- **RBAC** — роли admin/manager/nam + кастомные роли + row-level scopes
- **Реальное время** — WebSocket для обновления данных без перезагрузки
- **Оффлайн-режим** — Service Worker + Background Sync для отложенных POST

---

## Ссылки

| | |
|---|---|
| **Репозиторий** | https://github.com/rt-it-school/crm |
| **Прототип (рабочая CRM)** | _заполнить после деплоя_ |
| **Документация** | https://rt-it-school.github.io/crm/ |
| **Swagger UI** | https://crm.rt.ru/api/docs |
| **Grafana** | https://crm.rt.ru/grafana |
| **Keycloak** | https://keycloak.crm.rt.ru |
| **Презентация** | [docs/presentation/presentation.pdf](docs/presentation/presentation.pdf) |
| **Archi-модель** | [docs/archimate/crm.archimate](docs/archimate/crm.archimate) |
| **Список библиотек** | [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) |

---

## Стек технологий

### Backend

| Компонент | Технология |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 4 |
| ORM | Prisma 6 |
| БД | PostgreSQL 16 + pgvector |
| Кэш / очереди | Redis 7 + BullMQ |
| Аутентификация | Keycloak 26 (OIDC, JWT) |
| Файлы | MinIO (S3-совместимое) |
| Логирование | Pino |
| Валидация | Zod |
| Метрики | prom-client |
| Трейсы | OpenTelemetry → Tempo |
| Ошибки | Sentry |

### Frontend

| Компонент | Технология |
|---|---|
| Framework | React 18 |
| Сборка | Vite 5 |
| Язык | TypeScript 5 |
| Стили | Tailwind CSS 3 + дизайн-токены Атомаро |
| Состояние | React Query (TanStack) |
| Формы | react-hook-form + Zod |
| OIDC | react-oidc-context |
| Иконки | lucide-react |
| Диаграммы | ECharts, React Flow |
| Экспорт | jsPDF, XLSX |

### Инфраструктура

| Компонент | Назначение |
|---|---|
| Docker Compose | Оркестрация |
| Nginx | Reverse proxy + SSL |
| Certbot | Let's Encrypt |
| Prometheus | Метрики |
| Grafana | Дашборды |
| Loki + Promtail | Логи |
| Tempo | Трейсы |
| Alertmanager | Алерты в Telegram |
| ClamAV | Антивирус |

---

## Быстрый старт (dev)

### Требования

- Node.js ≥ 20
- npm ≥ 10
- Docker ≥ 24
- Docker Compose ≥ 2.20
- Свободно ≥ 15 ГБ на диске

### Шаги

```bash
# 1. Клонировать
git clone https://github.com/rt-it-school/crm.git
cd crm

# 2. Настроить окружение
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Откройте backend/.env и проверьте значения (для dev подходят дефолты).

# 3. Поднять инфраструктуру (Postgres, Redis, Keycloak, MinIO, mock-lms)
docker compose -f docker-compose.dev.yml up -d

# 4. Установить зависимости (для frontend и backend сразу)
npm install

# 5. Миграции + seed
npm run prisma:generate --workspace=backend
npm run prisma:migrate --workspace=backend
npm run prisma:seed --workspace=backend

# 6. Запустить backend (в отдельном терминале)
npm run dev --workspace=backend

# 7. Запустить frontend (в отдельном терминале)
npm run dev --workspace=frontend
Проверка
Сервис	URL
Frontend	http://localhost:5173
Backend	http://localhost:4000
Swagger UI	http://localhost:4000/api/docs
Health	http://localhost:4000/health/ready
Keycloak	http://localhost:8080 (admin/admin)
MinIO Console	http://localhost:9001 (crm_minio/minio_pass_dev)
Демо-учётки
Email	Роль
admin@rt.ru	Администратор
manager@rt.ru	Руководитель
nam@rt.ru	Пользователь (НАМ)
Пароли задаются в docker/keycloak/realm-it-school.json или вручную
через Keycloak Admin Console.

Скрипты
В корне
bash
npm run lint           # ESLint для frontend + backend
npm test               # vitest для frontend + backend
npm run typecheck      # tsc --noEmit для обоих
npm run third-party    # генерация docs/THIRD_PARTY.md и .json
npm run vapid          # генерация VAPID-ключей для Web Push
npm run health         # проверка /health на всех сервисах
npm run backup         # ручной бэкап PostgreSQL
npm run deploy         # сборка + запуск prod-стека
npm run generate:api-types  # типы из OpenAPI
Backend
bash
npm run dev --workspace=backend
npm run build --workspace=backend
npm run start --workspace=backend
npm run lint --workspace=backend
npm test --workspace=backend
npm run test:coverage --workspace=backend
npm run prisma:studio --workspace=backend
npm run prisma:migrate --workspace=backend
npm run prisma:seed --workspace=backend
Frontend
bash
npm run dev --workspace=frontend
npm run build --workspace=frontend
npm run preview --workspace=frontend
npm run lint --workspace=frontend
npm test --workspace=frontend
npm run test:coverage --workspace=frontend
npm run storybook --workspace=frontend
Структура проекта
text
crm/
├── backend/                       # Node.js + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma         # Схема БД (50+ таблиц)
│   │   ├── migrations/           # SQL-миграции
│   │   ├── seed.ts               # Демо-данные
│   │   └── kb-content.ts         # Статьи базы знаний
│   ├── src/
│   │   ├── config/               # env, logger, swagger, metrics
│   │   ├── constants/            # Справочники (workflow-templates)
│   │   ├── db/                   # Prisma, Redis, extensions
│   │   ├── errors/               # Коды ошибок (AppError)
│   │   ├── jobs/                 # Cron + BullMQ-воркеры
│   │   ├── middleware/           # auth, rate-limit, idempotency
│   │   ├── routes/               # HTTP-эндпоинты
│   │   ├── services/             # Бизнес-логика
│   │   ├── utils/                # Хелперы (serialize, response)
│   │   ├── index.ts              # Express app
│   │   └── server.ts             # Точка входа
│   └── tests/
├── frontend/                      # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/           # UI-компоненты
│   │   ├── contexts/             # AuthContext
│   │   ├── hooks/                # Кастомные хуки + queries
│   │   ├── lib/                  # API-клиент, утилиты
│   │   ├── pages/                # Страницы
│   │   ├── styles/ds/            # Дизайн-токены Атомаро
│   │   ├── types/                # TypeScript-типы
│   │   ├── App.tsx
│   │   ├── Router.tsx
│   │   └── main.tsx
│   ├── public/                    # sw.js, manifest, offline.html
│   └── tests/
├── docker/
│   ├── nginx/                    # nginx.conf + conf.d/
│   ├── keycloak/                 # realm-it-school.json
│   ├── prometheus/               # prometheus.yml + alerts.yml
│   ├── grafana/                  # provisioning + dashboards
│   ├── loki/                     # Loki config
│   ├── promtail/                 # Promtail config
│   ├── tempo/                    # Tempo config
│   ├── alertmanager/             # alertmanager.yml
│   ├── backup/                   # backup.sh
│   └── mocks/lms/                # Mock LMS + Laravel
├── scripts/                       # Вспомогательные скрипты
│   ├── deploy.sh
│   ├── backup-now.sh
│   ├── restore-backup.sh
│   ├── health-check.sh
│   ├── generate-third-party.mjs
│   ├── generate-vapid.mjs
│   ├── render-diagrams.sh
│   ├── purge-cdn-cache.sh
│   ├── capture-kb-screenshots.mjs
│   ├── watchdog.sh
│   └── loadtest/
│       ├── 50-users.js
│       ├── 10-reports.js
│       ├── mixed-load.js
│       └── prod.env.example
├── docs/                          # Документация (MkDocs)
│   ├── getting-started/          # install, dev, deploy
│   ├── architecture/             # обзор + диаграммы
│   ├── api/                      # описание API + Swagger
│   ├── guides/                   # руководства user/admin
│   ├── runbooks/                 # runbooks для дежурного
│   ├── loadtest/                 # отчёты k6
│   ├── SECURITY.md
│   ├── DATA_PROCESSING.md
│   ├── data-methods.md
│   ├── limitations.md
│   ├── THIRD_PARTY.md
│   └── presentation/             # презентация
├── docker-compose.dev.yml
├── docker-compose.dev-https.yml
├── docker-compose.prod.yml
├── docker-compose.test.yml
├── docker-compose.yaml            # для self-hosted
├── mkdocs.yml
├── cliff.toml
├── commitlint.config.js
├── package.json                  # корневой (workspaces)
├── CONTRIBUTING.md
├── SECURITY.md
├── README.md
└── LICENSE
Безопасность
152-ФЗ — «О персональных данных»
Мера	Реализация
Согласие субъекта	Таблица pd_consents
Шифрование ПД	AES-256-GCM (PiiService)
Ключ	HKDF-SHA256 из PII_KEY (≥32 символа)
Право на доступ	POST /security/pd/export
Право на удаление	POST /security/pd/forget
Журнал обработки	pii_access_log (retention 1 год)
Уведомление об инцидентах	security_events (severity=critical)
Что шифруется: email, телефоны, мессенджеры, СНИЛС, паспортные данные,
дипломы. Что не шифруется: ФИО (для поиска), названия, даты, суммы.

ФСТЭК № 117 (УЗ-2)
Требование	Реализация
2FA	Обязательна для admin/manager (requireMfa)
RBAC + scopes	buildScopeWhere, кастомные роли
Аудит	audit_log с before/after
IP-whitelist	Опционально
Антивирус	ClamAV на всех загрузках
Резервное копирование	Ежедневно + проверка
Мониторинг	Prometheus + Alertmanager
Сессии	Idle 30 мин, absolute 10 ч
См. SECURITY.md и DATA_PROCESSING.md.

Нагрузочные тесты
По ТЗ п. 5 требуется:

№	Требование	Результат
НФТ-1	p95 < 1 сек	230 ms ✅
НФТ-6	50 параллельных пользователей	✅
НФТ-7	10 параллельных отчётов	✅
k6-скрипты: scripts/loadtest/
Отчёт: docs/loadtest/report.md

Запуск:

bash
# Установить k6
brew install k6       # macOS
choco install k6      # Windows
sudo apt install k6   # Ubuntu

# Запустить
k6 run scripts/loadtest/50-users.js
k6 run scripts/loadtest/10-reports.js
k6 run scripts/loadtest/mixed-load.js
Деплой в production
Требования к серверу
Параметр	Минимум
CPU	4 ядра
RAM	8 ГБ
Диск	100 ГБ SSD
ОС	Ubuntu 22.04 / Debian 12
Размещение	хостинг в РФ (152-ФЗ)
Шаги
bash
# 1. Подготовка сервера
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
apt install -y git
ufw allow 22,80,443/tcp && ufw enable

# 2. DNS
# A-записи: crm.example.ru, keycloak.crm.example.ru → IP сервера

# 3. Клонирование
cd /opt
git clone https://github.com/rt-it-school/crm.git
cd crm

# 4. Настройка
cp .env.production.example .env
nano .env
# Заполнить: APP_HOSTNAME, KEYCLOAK_HOSTNAME, пароли,
# PII_KEY (openssl rand -base64 48), SMTP, VAPID, Telegram.

# 5. SSL-сертификаты
docker run --rm -p 80:80 \
  -v $PWD/docker/nginx/certs:/etc/letsencrypt \
  -v $PWD/docker/nginx/www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d crm.example.ru -d keycloak.crm.example.ru \
  --email admin@example.ru --agree-tos --non-interactive

# 6. Деплой
./scripts/deploy.sh
Проверка: curl https://crm.example.ru/health/ready | jq.

Подробнее — docs/getting-started/deploy.md.

Документация
Вся документация в docs/ и доступна через MkDocs:

bash
# Установить MkDocs
pip install mkdocs-material mkdocs-awesome-pages-plugin mkdocs-swagger-ui-tag

# Локальный просмотр
python -m mkdocs serve
# → http://127.0.0.1:8000

# Сборка статики
python -m mkdocs build
# → папка site/
Основные разделы
Раздел	Файл
Установка	docs/getting-started/install.md
Разработка	docs/getting-started/dev.md
Деплой	docs/getting-started/deploy.md
Архитектура	docs/architecture/README.md
API	docs/api/README.md
Swagger	docs/api/swagger.md
Руководство пользователя	docs/guides/user.md
Руководство администратора	docs/guides/admin.md
Runbooks	docs/runbooks/README.md
Методы обработки данных	docs/data-methods.md
Ограничения	docs/limitations.md
Безопасность	docs/SECURITY.md
Обработка ПД	docs/DATA_PROCESSING.md
Сторонние библиотеки	docs/THIRD_PARTY.md
Разработка
Стиль кода
Backend: ESLint + Prettier, TypeScript strict, Zod-валидация

Frontend: ESLint + Prettier, React hooks, Tailwind

Коммиты: Conventional Commits
(feat:, fix:, docs:, chore: и т.д.), проверяются commitlint

Pre-commit hooks: Husky + lint-staged

Ветки
text
main            — стабильная
feat/*          — новые фичи
fix/*           — багфиксы
docs/*          — документация
refactor/*      — рефакторинг
test/*          — тесты
chore/*         — рутина
hotfix/*        — срочный фикс в prod
См. CONTRIBUTING.md.

Тесты
bash
# Backend
npm run test:db:up --workspace=backend
npm run test:setup --workspace=backend
npm test --workspace=backend
npm run test:coverage --workspace=backend

# Frontend
npm test --workspace=frontend
npm run test:coverage --workspace=frontend
Покрытие (пороги из vitest.config.ts):

Область	Lines	Functions	Branches
Backend (глобально)	30%	30%	20%
Frontend (глобально)	20%	20%	15%
src/lib/** (frontend)	40%	40%	30%
Мониторинг
Grafana
https://crm.rt.ru/grafana

Дашборды:

CRM Overview — RPS, latency, error rate, БД, Redis, Node.js

CRM Business — воронка, задачи, автоматизация

CRM Realtime & WS — WebSocket, push

Алерты (Telegram)
Настроены в docker/prometheus/alerts.yml.

Critical:

BackendDown — backend не отвечает 2 мин

PostgresDown — БД недоступна

RedisDown — Redis недоступен

VerySlowRequests — p99 > 5 сек

HighDBErrorRate — ошибки БД > 0.1/сек

Warning:

HighErrorRate — 5xx > 5%

SlowRequests — p95 > 2 сек

HighMemoryUsage — heap > 90%

PostgresTooManyConnections — > 80%

RedisHighMemory — > 90%

Логи
Loki + Promtail → Grafana Explore.

Трейсы
Tempo через OpenTelemetry (sample rate 10% в prod).

Внешний watchdog
scripts/watchdog.sh — запускать на отдельной машине через cron
каждую минуту. При 3 падениях подряд — алерт в Telegram.

Интеграции
Система	Тип	Направление
LMS ИТ Школы	REST API	pull
Laravel CMS	webhook	push
Telegram	Bot API + webhook	双向
WhatsApp (Meta)	Cloud API + webhook	双向
SMS	SMSC / SMSC.ru	push
АТС (Mango, Beeline)	webhook	push
Email	SMTP + IMAP	双向
1С	HTTP / REST	push
SAP	OData	push
Диадок	API + webhook	双向
СБИС	API + webhook	双向
Google Calendar	OAuth 2.0	双向
Управление: раздел «Интеграции» в UI.

Безопасность: все входящие webhook-и проверяют HMAC-подпись.


Copyright © 2026 ИТ Школа Ростелеком. Все права защищены.


Благодарности
Проект создан для ЛЦТ 2026 (Лидеры цифровой трансформации).

Отдельное спасибо:

Команде ИТ Школы Ростелеком — за постановку задачи и обратную связь.

Разработчикам open-source библиотек, перечисленных в docs/THIRD_PARTY.md.