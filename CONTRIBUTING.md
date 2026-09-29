# Contributing

Спасибо, что хотите помочь проекту **ИТ Школа Ростелеком · CRM**!
Этот документ описывает, как правильно контрибьютить в проект.

## Оглавление

- [Требования к окружению](#требования-к-окружению)
- [Процесс работы](#процесс-работы)
- [Соглашение о коммитах](#соглашение-о-коммитах)
- [Стиль кода](#стиль-кода)
- [Тесты](#тесты)
- [Pull Request](#pull-request)
- [Ревью](#ревью)
- [Безопасность](#безопасность)

## Требования к окружению

| Инструмент | Версия |
|---|---|
| Node.js | ≥ 20.0.0 |
| npm | ≥ 10 |
| Docker | ≥ 24 |
| Docker Compose | ≥ 2.20 |
| PostgreSQL (в контейнере) | 16 |
| Python (для MkDocs) | ≥ 3.10 |

## Процесс работы

1. Форкните репозиторий и создайте ветку от `main`:
   ```bash
   git checkout -b feat/universities-export
Внесите изменения, напишите тесты, прогоните линтеры.

Запустите локально полный стек:

bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run dev --workspace=backend &
npm run dev --workspace=frontend
Убедитесь, что всё работает, и отправьте PR в main.

Именование веток
Префикс	Назначение	Пример
feat/	Новая функциональность	feat/reports-xlsx
fix/	Багфикс	fix/calendar-timezone
docs/	Только документация	docs/update-runbook
refactor/	Рефакторинг без изменения поведения	refactor/auth-middleware
test/	Только тесты	test/analytics-coverage
chore/	Рутина (зависимости, конфиги)	chore/bump-prisma
hotfix/	Срочный фикс в прод	hotfix/pii-leak
Соглашение о коммитах
Проект использует Conventional Commits.
Коммиты проверяются через commitlint.

Формат
text
<type>(<scope>): <subject>

[optional body]

[optional footer]
Разрешённые типы
Тип	Когда использовать
feat	Новая функциональность
fix	Багфикс
docs	Документация
style	Форматирование (без изменения логики)
refactor	Рефакторинг
perf	Улучшение производительности
test	Тесты
chore	Рутина (зависимости, CI/CD)
ci	Изменение CI
build	Сборка
revert	Откат предыдущего коммита
Правила
subject — не с заглавной буквы (см. commitlint.config.js)

Header — не длиннее 100 символов

Описание — на русском или английском (единообразно в рамках PR)

Примеры
text
feat(universities): добавить экспорт в XLSX

- новый эндпоинт GET /reports/universities.xlsx
- поддержка фильтра по статусу
- покрыт тестами ReportsService.universitiesToXlsx

Closes #123
text
fix(auth): не обновлять keycloakSub при занятом id

Раньше при коллизии sub происходил silent update, который ломал
авторизацию у второго пользователя. Теперь проверяем занятость
через findFirst и логируем warn.

Fixes #456
Стиль кода
Backend (Node.js/TypeScript)
ESLint: npm run lint --workspace=backend

TypeScript: strict mode, без any (кроме обоснованных случаев)

Импорты: import type { … } для типов, сортировка через eslint-plugin-import

Логирование: только через logger (pino), никаких console.log

Ошибки: throw new AppError('CODE', status) — не строки

Асинхронность: async/await, без плавающих промисов

Prisma: транзакции — через withTransaction() из utils/transaction.ts

Валидация: Zod-схемы в роутах, не в сервисах

Frontend (React/TypeScript)
ESLint: npm run lint --workspace=frontend

React: функциональные компоненты, hooks

Стили: Tailwind CSS + дизайн-токены Атомаро (atmr-* классы)

Состояние: React Query для серверного, локальный useState для UI

Формы: react-hook-form + zod resolver

Иконки: lucide-react

Никаких any, @ts-ignore только с комментарием

Prettier
Единый стиль через Prettier:

bash
npx prettier --write "frontend/src/**/*.{ts,tsx,css}"
Pre-commit hooks
Husky запускает lint-staged — ESLint + Prettier для изменённых файлов.

Тесты
Backend
bash
# Поднять тестовую БД
npm run test:db:up --workspace=backend

# Накатить миграции
npm run test:setup --workspace=backend

# Запустить
npm test --workspace=backend

# С покрытием
npm run test:coverage --workspace=backend
Frontend
bash
npm test --workspace=frontend
npm run test:coverage --workspace=frontend
Требования к покрытию
Область	Lines	Functions	Branches
Backend (глобально)	30%	30%	20%
Frontend (глобально)	20%	20%	15%
src/lib/** (frontend)	40%	40%	30%
См. vitest.config.ts в каждом воркспейсе.

Обязательно для тестов
Тесты на чистую логику (lib/, utils/)

Тесты на критические сервисы (analytics.service, reports.service)

Интеграционные тесты на API-роуты

Не обязательно: покрывать сервисы внешних интеграций (SMTP, IMAP, Telegram, Puppeteer)

Pull Request
Перед созданием PR
□ Все тесты проходят (npm test)
□ Линтеры чистые (npm run lint)
□ Типы сходятся (npm run typecheck)
□ Обновлён CHANGELOG.md (если фича/фикс)
□ Обновлена документация в docs/ (если меняется API/поведение)
□ Обновлены тесты (если новая логика)
□ Для UI-изменений — приложены скриншоты
Шаблон PR
markdown
## Что сделано

Краткое описание изменений.

## Зачем

Ссылка на issue, ТЗ п. X.

## Как проверить

1. Шаги воспроизведения
2. Что должно получиться

## Скриншоты (если UI)

![до](...)
![после](...)

## Чек-лист

- [ ] Тесты добавлены/обновлены
- [ ] Документация обновлена
- [ ] Breaking changes описаны в CHANGELOG

Closes #123
Ревью
Кто ревьюит
Минимум один approve от мейнтейнера

Для изменений в auth.ts, pii.service.ts, security.routes.ts — два approve

Что проверяет ревьюер
Соответствие ТЗ

Безопасность (особенно: ПД, SQL-инъекции, IDOR)

Производительность (нет N+1 запросов)

Читаемость кода

Наличие тестов

Актуальность документации

Как отвечать на ревью
Не пушить force (если PR уже открыт) — добавляйте коммиты

Отвечать на каждый комментарий (resolve или комментарий)

Если не согласны — аргументированно объяснить

Безопасность
Не публикуйте в PR:

Реальные секреты (пароли, ключи, токены)

Дампы прод-БД

Персональные данные

Internal-IP / домены