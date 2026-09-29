# API

REST API системы CRM ИТ Школы Ростелеком.

## Базовый URL

| Окружение | URL |
|---|---|
| Локально | `http://localhost:4000/api/v1` |
| Production | `https://crm.example.ru/api/v1` |

## Аутентификация

Все приватные эндпоинты требуют **Bearer JWT** из Keycloak.

### Формат заголовка

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Получение токена
Frontend использует OIDC flow (Authorization Code + PKCE) через
react-oidc-context. Access-token кладётся в Authorization автоматически.

Для тестирования вручную — через Keycloak:

bash
curl -X POST "https://keycloak.crm.example.ru/realms/it-school/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=crm-frontend" \
  -d "username=admin@rt.ru" \
  -d "password=Admin123!" \
  -d "scope=openid profile email"
Ответ:

json
{
  "access_token": "eyJ...",
  "expires_in": 900,
  "refresh_token": "eyJ...",
  "token_type": "Bearer"
}
Обновление токена
Frontend использует silent renew (скрытый iframe).
Пользователь не видит повторного входа, пока сессия Keycloak жива.

Роли и права
Роль	Что может
admin	Всё
manager	Вся воронка, передача вузов, аналитика
nam	Только свои вузы
Подробнее: Безопасность.

Формат ответа
Успех
json
{
  "ok": true,
  "data": { ... }
}
Пагинированные:

json
{
  "ok": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 137,
    "totalPages": 6
  }
}
Ошибка
json
{
  "ok": false,
  "code": "CRM-400-001",
  "message": "Ошибка валидации",
  "details": { "name": ["Required"] },
  "requestId": "8f1c2a4b-..."
}
Коды ошибок — полный список.

Заголовки
Заголовок	Назначение
Authorization	JWT
X-Request-Id	ID запроса (возвращается в ответе)
Idempotency-Key	Для безопасного повтора POST
Content-Type	application/json
Rate limiting
Глобальный: 200 запросов/минуту на пользователя

Strict (поиск, экспорт, POST): 20/мин

Reports (тяжёлые): 30/мин

При превышении — 429 CRM-429-001.

Пагинация
Offset (страницы)
text
GET /universities?page=2&pageSize=50
Cursor (бесконечная прокрутка)
text
GET /universities/cursor?limit=50&cursor=<uuid>
Ответ содержит nextCursor / prevCursor.

Фильтрация и сортировка
text
GET /universities?status=Партнёр&managerId=<uuid>&sortBy=name&sortDir=asc
Поддерживаемые фильтры — в Swagger по каждому эндпоинту.

Основные разделы API
Раздел	Префикс	Назначение
Аутентификация	/auth	Профиль, сессии
Пользователи	/users	CRUD (admin)
Вузы	/universities	Карточки, контакты
Взаимодействия	/interactions	Звонки, встречи, письма
Задачи	/tasks	Задачи, канбан
Workflow	/workflows	Шаги, переходы
Договоры	/contracts	Договоры, согласования
Аналитика	/analytics	ABC/XYZ, RFM, LTV
Отчёты	/reports	Экспорт xls/xlsx/pdf
База знаний	/knowledge	Статьи KB
Интеграции	/integrations	LMS, Laravel, Telegram
Безопасность	/security	Аудит, ПД, IP
Каталоги	/catalogs	Вендоры, направления
Экспорт файлов
text
GET /reports/interactions.xlsx?from=2026-01-01&to=2026-12-31
GET /reports/interactions.xls?...
GET /reports/interactions.pdf?...
GET /reports/interactions.csv?format=csv
GET /reports/full.json
Ответ — бинарный файл с Content-Disposition: attachment.

Webhook-и
Provider	Endpoint
Laravel	POST /webhooks/laravel/:id
LMS	POST /webhooks/lms/:id
Telegram	POST /webhooks/telegram/:id
WhatsApp	POST /webhooks/whatsapp/:id
Все требуют HMAC-подпись.

WebSocket
text
wss://crm.example.ru/ws?token=<jwt>
События:

universities:created, universities:updated, universities:deleted

interactions:created

comments:created

workflows:transition

notifications:new

contracts:created, contracts:signed

Подписка:

json
{ "type": "subscribe", "entities": ["universities", "tasks"] }
Health-check
text
GET /health/live    # процесс жив
GET /health/ready   # все зависимости
GET /health/ws-stats  # состояние WS
/health/ready проверяет:

PostgreSQL

Redis

Keycloak

MinIO

Swagger UI
Интерактивная документация: Swagger.

Примеры
Создать вуз
bash
curl -X POST https://crm.example.ru/api/v1/universities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "МГУ им. Ломоносова",
    "city": "Москва",
    "direction": "Разработка",
    "product": "Ростелеком DataLab",
    "status": "Новый"
  }'
Получить отчёт
bash
curl "https://crm.example.ru/api/v1/reports/interactions.xlsx?from=2026-01-01&to=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o report.xlsx
Перевести workflow
bash
curl -X POST https://crm.example.ru/api/v1/workflows/transitions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stepId": "<uuid>",
    "universityId": "<uuid>",
    "fromStatus": "pending",
    "toStatus": "in_progress",
    "comment": "Связались с вузом, договорились о встрече",
    "actorName": "Анна Кузнецова"
  }'
Соглашения
Все тела запросов/ответов — JSON (кроме файлов)

Даты — ISO 8601 (2026-01-15) или полный timestamp

UUID — 8-4-4-4-12 в нижнем регистре

snake_case в JSON, camelCase в TypeScript на бэке (конвертация в utils/serialize.ts)