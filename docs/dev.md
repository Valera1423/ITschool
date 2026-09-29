# Разработка

Как работать с проектом после установки.

## Структура проекта
crm/
├── backend/ # Node.js + Express + Prisma
│ ├── prisma/ # Схема БД, миграции, seed
│ ├── src/
│ │ ├── config/ # env, logger, swagger, metrics
│ │ ├── db/ # prisma, redis, extensions
│ │ ├── jobs/ # cron, BullMQ
│ │ ├── middleware/ # auth, rate-limit, idempotency
│ │ ├── routes/ # HTTP-эндпоинты
│ │ ├── services/ # бизнес-логика
│ │ ├── utils/ # хелперы
│ │ └── index.ts, server.ts
│ └── tests/
├── frontend/ # React + Vite + TypeScript
│ ├── src/
│ │ ├── components/ # UI-компоненты
│ │ ├── contexts/ # React contexts
│ │ ├── hooks/ # кастомные хуки
│ │ ├── lib/ # API-клиент, утилиты
│ │ ├── pages/ # страницы
│ │ ├── types/ # TypeScript-типы
│ │ └── main.tsx, App.tsx
│ └── public/
├── docker/ # Конфиги сервисов
├── scripts/ # Вспомогательные скрипты
├── docs/ # Документация
└── docker-compose.*.yml # Compose-файлы

text

## Команды

### Backend

```bash
npm run dev --workspace=backend        # tsx watch
npm run build --workspace=backend      # tsc → dist/
npm run start --workspace=backend      # node dist/server.js
npm run lint --workspace=backend       # ESLint
npm run typecheck --workspace=backend  # tsc --noEmit
npm test --workspace=backend           # vitest
npm run prisma:studio --workspace=backend  # GUI для БД
Frontend
bash
npm run dev --workspace=frontend       # Vite dev server
npm run build --workspace=frontend     # tsc + vite build
npm run preview --workspace=frontend   # превью прода
npm run lint --workspace=frontend
npm run typecheck --workspace=frontend
npm test --workspace=frontend
npm run storybook --workspace=frontend
В корне
bash
npm run lint           # backend + frontend
npm test               # backend + frontend
npm run typecheck      # backend + frontend
npm run third-party    # генерация THIRD_PARTY.md
npm run vapid          # генерация VAPID-ключей
npm run generate:api-types   # типы из OpenAPI
Работа с БД
Prisma Studio
bash
npm run prisma:studio --workspace=backend
# Откроется http://localhost:5555
Прямой доступ к psql
bash
docker exec -it crm-postgres psql -U crm_user -d crm_db
Создание миграции
bash
# Изменить schema.prisma, затем:
npx prisma migrate dev --name add_contract_versions --workspace=backend

# Откатить последнюю (dev):
npx prisma migrate reset --workspace=backend
Seed-данные
bash
npm run prisma:seed --workspace=backend
Seed идемпотентен: повторный запуск не дублирует записи.

Работа с API
Swagger UI
http://localhost:4000/api/docs

Здесь можно:

Посмотреть все эндпоинты

Попробовать запросы (кнопка «Try it out»)

Авторизоваться через Bearer-токен

Генерация типов для frontend
bash
npm run generate:api-types
Вход: backend/docs/openapi.json
Выход: frontend/src/types/api.d.ts

Или с живого сервера:

bash
npm run generate:api-types:remote
Работа с frontend
Дизайн-система Атомаро
Проект использует кастомные токены из frontend/src/styles/ds/:

Цвета: bg-atmr-accent, text-atmr-fg, border-atmr-border

Типографика: atmr-h1, atmr-body-m, atmr-desc-s

Скругления: rounded-atmr-l, rounded-atmr-2xl

Тени: shadow-atmr-m, shadow-atmr-xl

z-index: z-atmr-modal, z-atmr-toast

Полный список — в tailwind.config.js.

Storybook
bash
npm run storybook --workspace=frontend
# http://localhost:6006
React Query
Все запросы к API — через @tanstack/react-query.
См. src/hooks/queries/.

Ключи: ['universities', 'list', filters] — иерархичные, для удобной инвалидации.

i18n
Проект на русском, i18n настроен (i18next) но пока используется минимально.

Тесты
Backend
bash
# Поднять тестовую БД (Postgres в tmpfs)
npm run test:db:up --workspace=backend

# Накатить миграции
npm run test:setup --workspace=backend

# Запустить тесты
npm test --workspace=backend

# С покрытием
npm run test:coverage --workspace=backend

# Watch-режим
npm run test:watch --workspace=backend
Тестовая БД живёт в памяти, изолирована от dev-БД (порт 5433).

Frontend
bash
npm test --workspace=frontend
npm run test:coverage --workspace=frontend
Отладка
Backend
Логи в dev: цветные, через pino-pretty.
Логи в prod: JSON (для Loki).

Изменить уровень: LOG_LEVEL=debug в .env.

Debug-запросов: BODY_LOGGING=true в .env — логирует тела запросов.

VSCode
.vscode/launch.json:

json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: attach",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true
    },
    {
      "name": "Backend: tsx",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--workspace=backend"],
      "console": "integratedTerminal"
    }
  ]
}
Запустить с debug-портом:

bash
node --inspect=9229 -r tsx/cjs src/server.ts
Git workflow
См. CONTRIBUTING.md.

Кратко:

Ветка от main: feat/xxx, fix/xxx

Коммиты по Conventional Commits

Husky проверяет commit-msg и pre-commit

PR → review → merge (squash)

Полезные сниппеты
Сбросить всё и начать заново
bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
npm run prisma:migrate --workspace=backend
npm run prisma:seed --workspace=backend
Посмотреть логи всех сервисов
bash
docker compose -f docker-compose.dev.yml logs -f
Зайти в контейнер backend
bash
docker compose -f docker-compose.dev.yml exec backend sh
Проверить Redis
bash
docker exec -it crm-redis redis-cli
> keys *
> dbsize
Проверить очередь BullMQ
Через BullMQ Board (опционально) или Redis:

bash
docker exec -it crm-redis redis-cli
> keys bull:*