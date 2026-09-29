# Swagger UI

Интерактивная документация API.

## Открыть

| Окружение | URL |
|---|---|
| Локально | http://localhost:4000/api/docs |
| Production | https://crm.example.ru/api/docs |

Открывается в браузере, показывает все эндпоинты, схемы и позволяет
выполнять запросы прямо из интерфейса.

## Возможности

- **Просмотр всех эндпоинтов** — сгруппированы по тегам
- **Схемы запросов/ответов** — все поля с типами
- **Try it out** — выполнить запрос прямо из UI
- **Persist Authorization** — токен сохраняется между перезагрузками
- **Filter** — быстрый поиск эндпоинта
- **Display request duration** — время ответа

## Авторизация

### Способ 1. Bearer-токен

1. Открыть Swagger UI
2. Нажать **Authorize** справа сверху
3. Вставить access-token в поле `Value`:
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

text
4. Нажать **Authorize**

Теперь все запросы будут с `Authorization: Bearer <token>`.

### Способ 2. Получить токен через Keycloak

```bash
curl -X POST "https://keycloak.crm.example.ru/realms/it-school/protocol/openid-connect/token" \
-d "grant_type=password" \
-d "client_id=crm-frontend" \
-d "username=admin@rt.ru" \
-d "password=Admin123!" \
-d "scope=openid profile email" \
| jq -r '.access_token'
Скопировать вывод, вставить в Swagger.

Генерация спецификации
Swagger UI работает на базе OpenAPI 3.0 спецификации, которая
генерируется из JSDoc-комментариев в коде.

В коде
typescript
/**
 * @openapi
 * /universities:
 *   get:
 *     tags: [Universities]
 *     summary: Список вузов
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Список
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedResponse' }
 */
router.get('/', async (req, res, next) => { ... });
Скачать JSON
text
GET /api/openapi.json
Можно использовать для:

Генерации клиентов (openapi-generator)

Импорта в Postman

Автотестов

Сгенерировать типы для frontend
bash
npm run generate:api-types
Вход: backend/docs/openapi.json
Выход: frontend/src/types/api.d.ts

Или с работающего сервера:

bash
npm run generate:api-types:remote
Структура документа
Теги (группы)
Тег	Что там
Auth	Аутентификация, профиль, сессии
Users	Управление пользователями (admin)
Universities	Вузы, контакты, теги
Interactions	Звонки, встречи, письма
Tasks	Задачи, канбан
Workflows	Workflow, шаги, переходы
Contracts	Договоры, согласования
Segments	Умные сегменты
Catalogs	Справочники
Analytics	ABC/XYZ, RFM, LTV, когорты
Reports	Экспорт
Knowledge	База знаний
Dashboards	Пользовательские дашборды
Audit	Журнал, безопасность
Integrations	Внешние системы
Storage	Загрузка файлов
Схемы
Схема	Назначение
Error	Стандартный формат ошибки
Pagination	Метаданные пагинации
SuccessResponse	Обёртка успешного ответа
PaginatedResponse	Список с пагинацией
Примеры запросов
Авторизация
text
GET /auth/me
Проверить текущий профиль и permissions.

Создать вуз
text
POST /universities

{
  "name": "МГУ",
  "city": "Москва",
  "direction": "Разработка",
  "product": "DataLab",
  "status": "Новый"
}
Получить аналитику
text
GET /analytics/abc-xyz?from=2026-01-01&to=2026-12-31
GET /analytics/rfm
GET /analytics/cohorts?monthsBack=12
GET /analytics/ltv
Экспорт отчёта
text
GET /reports/interactions.xlsx?from=2026-01-01&to=2026-12-31
Полный JSON
text
GET /reports/full.json?from=2026-01-01&to=2026-12-31
Кастомизация
Swagger UI настроен в backend/src/config/swagger.ts:

typescript
swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background-color: #0284c7; }',
  customSiteTitle: 'CRM API Docs',
  swaggerOptions: {
    persistAuthorization: true,   // токен сохраняется
    docExpansion: 'none',          // группы свёрнуты
    filter: true,                  // поиск
    displayRequestDuration: true,  // время ответа
  },
});
Импорт в Postman
Открыть Postman

Import → Link → https://crm.example.ru/api/openapi.json

Все эндпоинты появятся в коллекции

Code generation
Для генерации клиента на разных языках:

bash
docker run --rm -v $PWD:/local \
  openapitools/openapi-generator-cli generate \
  -i /local/backend/docs/openapi.json \
  -g typescript-fetch \
  -o /local/generated/client
Ограничения
Swagger UI доступен только авторизованным? Нет — сам UI публичный, но эндпоинты требуют токен.

В продакшене SWAGGER_ENABLED может быть отключён через env.

Схемы генерируются из JSDoc — если JSDoc устарел, Swagger тоже.