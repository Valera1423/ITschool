# Руководство администратора

**Для технических специалистов ИТ Школы Ростелеком.**

> Полная версия с картинками — внутри CRM:
> **База знаний → Руководство администратора**.

## Обязанности

### Ежедневно

- Следить за здоровьем системы (Grafana)
- Реагировать на алерты в Telegram
- Проверять журнал безопасности
- Помогать пользователям с доступом

### Еженедельно

- Проверять бэкапы (свежий ≤24 ч)
- Просматривать аудит
- Обновлять систему при необходимости

### Ежемесячно

- Ревью пользователей и ролей
- Ревью интеграций
- Тест восстановления из бэкапа
- Проверка сертификатов SSL

## Ключевые ссылки

| Сервис | URL |
|---|---|
| CRM | https://crm.example.ru |
| Keycloak | https://keycloak.crm.example.ru |
| Grafana | https://crm.example.ru/grafana |
| Swagger | https://crm.example.ru/api/docs |

## Управление пользователями

### Синхронизация с Keycloak

**Пользователи → Синхронизировать**

Забирает всех пользователей из Keycloak, создаёт отсутствующих в CRM,
блокирует удалённых.

Запускается автоматически каждые 15 минут.

### Создать пользователя

**Пользователи → Создать**

Заполнить: email, ФИО, роль, пароль.

### Пригласить

**Пользователи → Пригласить**

Keycloak отправит письмо со ссылкой для активации.

### Сменить роль

**Пользователи → клик → Сменить роль**

Ограничения:

- Только admin
- **Нельзя** менять себе
- **Нельзя** оставить систему без активного admin
- Требуется 2FA

### Заблокировать

**Пользователи → ⋯ → Заблокировать**

Отзываются все сессии.

### Сбросить пароль

**Пользователи → ⋯ → Сбросить пароль** — Keycloak отправит письмо.

### Удалить

**Пользователи → ⋯ → Удалить** — необратимо.

## Роли и права

### Базовые

| Роль | Ключ | Что |
|---|---|---|
| Администратор | `admin` | Всё |
| Руководитель | `manager` | Вся воронка, передача вузов |
| Пользователь (НАМ) | `nam` | Только свои вузы |

### Кастомные роли

**Пользователи → Роли → Создать**

- **Код** — латиница, уникальный
- **Базовая роль** — nam / manager / admin
- **Permissions** — точечный набор

Кастомная роль **не может** дать больше, чем базовая.

### Scope (видимость)

**Пользователи → Scope → Создать**

JSON-фильтр:

```json
{ "city": "Москва" }
{ "manager": "Анна Кузнецова" }
{ "status": "Новый" }
Безопасность
2FA
Обязательна для admin/manager (ФСТЭК №117).

Пользователь настраивает сам: Настройки → Безопасность → 2FA.

IP-whitelist
Безопасность → IP-доступ

Пустой список → все IP

Есть CIDR → только эти

⚠️ Не заблокируйте себя.

Журнал
Журнал — все изменения с before/after.

Хранение 90 дней.

События безопасности
Безопасность → События

login, logout, failed_login

role_changed, permissions_changed

malware_detected

suspicious_bulk_attempt

Журнал доступа к ПД
Безопасность → PII Access Log

Хранение 1 год (ФСТЭК).

Права субъектов ПД
Безопасность → Персональные данные

Экспорт по email → JSON

Удаление (анонимизация)

Журнал согласий

Интеграции
Интеграции — подключение внешних систем.

Типы
custom_api — REST (LMS, Laravel, 1С, SAP)

email — SMTP + IMAP

telegram — bot_token

whatsapp — Meta Cloud API

sms — SMS-шлюз

pbx — АТС

Создать
Интеграции → Создать

Заполнить config (JSON) и сохранить.

Endpoints
Интеграции → [система] → Endpoints → Создать

Например: /students, /courses.

Маппинг
Для каждого endpoint — source → target.

Трансформации: string, number, date, boolean, trim, lower, upper.

Webhook
Интеграции → [система] → Webhook URL

Скопировать в настройки внешней системы.

Проверка подписи — HMAC-SHA256.

Синхронизация
Вручную: кнопка «Синхронизировать»

Авто: autoSync: true + cron

Бэкапы
Автоматические
Ежедневно в 03:00 → ./backups/backup-YYYY-MM-DD.sql.gz

Retention 30 дней.

Проверить
bash
ls -lh ./backups/ | tail -5
Ручной
bash
./scripts/backup-now.sh
Восстановление
См. runbook.

Мониторинг
Метрика «возраст последнего бэкапа». Алерт при >30 ч.

Мониторинг
Grafana
CRM Overview — RPS, latency, error rate

CRM Business — воронка, задачи

CRM Realtime & WS — WS, push

Алерты
Настроены в docker/prometheus/alerts.yml.

Критичные:

Backend down

Postgres down

Redis down

p99 > 5s

5xx > 5%

Приходят в Telegram.

Логи
Loki + Grafana Explore.

Cron-задачи
Задача	Расписание
IMAP poll	*/2 мин
Auto-sync integrations	*/5 мин
Reminders	каждую минуту
Sync users с Keycloak	*/15 мин
Expire sessions	*/5 мин
Smart hints	08:00
Purge trash	03:00
KB reindex	03:30
Cleanup logs	04:00
Cleanup sessions	04:30
Check backups	05:00
Troubleshooting
Backend не стартует
bash
docker compose -f docker-compose.prod.yml logs backend | tail -100
Причины:

Ошибка .env → проверить

БД недоступна → docker ps

Миграции упали → применить вручную

502 от Nginx
bash
docker compose -f docker-compose.prod.yml restart backend frontend
401 Unauthorized
Проверить JWKS Keycloak:

bash
curl https://keycloak.crm.example.ru/realms/it-school/protocol/openid-connect/certs
403 Forbidden
Проверить роль в БД:

sql
SELECT id, email, role, blocked FROM profiles WHERE email = 'user@rt.ru';
Пользователь должен перелогиниться после смены роли.

429 Rate Limit
Увеличить в .env:

bash
RATE_LIMIT_MAX=1000
REPORT_RATE_LIMIT_MAX=200
500 Internal Server Error
Проверить Sentry, логи backend.

Диагностика
bash
# Состояние
docker compose -f docker-compose.prod.yml ps

# Ресурсы
docker stats --no-stream

# Диск
df -h

# Здоровье
curl -s https://crm.example.ru/health/ready | jq

# Бизнес-метрики
curl -s https://crm.example.ru/api/v1/system/health | jq
FAQ
PII_KEY сменился — ПД не читаются.

Восстановите старый ключ из бэкапа.

ClamAV жрёт память.

Норма для прода (~200 МБ). В dev отключите.

БД растёт быстро.

Проверьте audit_log, integration_sync_logs. Cron чистит >90 дней.

Пользователь потерял доступ.

Проверьте scope, роль, blocked.