# Безопасность ИТ Школа Ростелеком · CRM

> Документ описывает модель защищённости системы, соответствие
> **152-ФЗ** «О персональных данных» и приказу **ФСТЭК № 117**
> «Требования о защите информации в ГИС».

## 1. Классификация системы

**Категория обрабатываемых ПД:** иные категории (не специальные,
не биометрические, не общедоступные).

**Тип субъектов:** совершеннолетние сотрудники и представители вузов.

**Количество субъектов ПД:** до 100 000.

**Уровень защищённости:** **УЗ-2** в соответствии с п.9 Постановления
Правительства РФ от 01.11.2012 № 1119.

Основание: информационная система обрабатывает ПД сотрудников
и представителей вузов, не относится к ГИС, доступ — из
корпоративной сети и из интернета (через защищённые каналы).

## 2. Меры защиты по УЗ-2 (п.13–16 ПП №1119)

| Требование УЗ-2 | Реализация |
|---|---|
| Идентификация и аутентификация пользователей | Keycloak 26 (OIDC), роли admin/manager/nam |
| Управление доступом | RBAC + кастомные роли + user scopes (фильтры) |
| Ограничение программной среды | Docker-образы, фиксированные версии |
| Защита машинных носителей | Шифрование MinIO-тома (внешний слой) |
| Регистрация событий безопасности | `audit_log`, `security_events`, `pii_access_log` |
| Антивирусная защита | ClamAV (sidecar), проверка до загрузки |
| Обнаружение вторжений | Prometheus + Alertmanager (детект аномалий) |
| Целостность | HMAC-подпись webhook'ов, контрольные суммы файлов |
| Доступ к содержимому ПД в электронном виде | `pii_access_log` — журнал доступа к ПД |

## 3. Аутентификация

### 3.1 Keycloak (OIDC)

- `sslRequired: external` — HTTPS обязателен.
- `passwordPolicy`: `length(12) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1) and notUsername and notEmail and notCommonPassword and passwordHistory(5)`.
- `bruteForceProtected: true`, `failureFactor: 3` — блокировка после 3 неудач.
- Сессия: `accessTokenLifespan: 900` (15 мин), `ssoSessionIdleTimeout: 1800` (30 мин).
- **2FA (TOTP)** обязательна для роли admin и manager — проверяется на бэкенде через claim `amr`.

### 3.2 Ротация сессий

- При каждом запросе — `last_active_at` с троттлингом 60 сек.
- Idle timeout: 30 мин бездействия → `revoked('idle_timeout')`.
- Absolute timeout: 10 часов с момента логина → `revoked('absolute_timeout')`.
- Silent renew: старая запись `revoked('rotated')`, новая — с тем же IP/UA.

### 3.3 2FA

Настраивается пользователем в Keycloak Account Console → «Signing in» →
«Set up Authenticator Application». Поддерживается любое TOTP-приложение
(Google Authenticator, Authy, 1Password).

На бэкенде после `authenticate` вызывается `requireMfa` для критичных
роутов:
- `/security/ip-whitelist` (CRUD);
- `/users` (CRUD);
- `/custom-roles` (CRUD);
- `/integrations` (CRUD);
- `/backup`;
- `/universities/import`, `/universities/bulk`.

## 4. Разграничение доступа

### 4.1 Роли Keycloak

| Роль | Описание |
|---|---|
| `admin` | Полный доступ, управление пользователями и настройками |
| `manager` | Руководитель: назначает ответственных, видит воронку |
| `nam` | Менеджер по вузам: работает со своими вузами |

### 4.2 Кастомные роли (RBAC)

Администратор создаёт роли с точечным набором permissions
(`universities.create`, `contracts.approve`, …). Роль хранится
в `custom_roles.permissions` и прокидывается в `AuthUser.permissions`.

### 4.3 User scopes (row-level security)

Фильтры хранятся в `user_scopes.filter` (JSON) и применяются в
`buildScopeWhere`. Пример: менеджер видит только вузы своего города.

## 5. Обработка ПД (152-ФЗ)

### 5.1 Категории ПД

- ФИО контактных лиц вузов;
- email, телефоны;
- мессенджеры (Telegram, WhatsApp, MAX).

### 5.2 Шифрование

Поля `contact_email`, `contact_phone`, `telegram`, `whatsapp`,
`max_messenger` в `universities`, а также `email`, `phone`,
`telegram`, `whatsapp` в `university_contacts` шифруются алгоритмом
**AES-256-GCM** (`PiiService`).

Ключ: `PII_KEY` (≥ 32 символа), выводится через HKDF-SHA256.
Формат хранения: `v1:<iv_b64>:<tag_b64>:<cipher_b64>`.

### 5.3 Согласия субъектов

Каждое согласие на обработку ПД хранится в `pd_consents`:
кто, когда, на что дал, отозвано ли.

### 5.4 Права субъектов

Раздел **Безопасность → Персональные данные**:
- **Экспорт** всех ПД по email → JSON-файл (`POST /security/pd/export`).
- **Удаление (анонимизация)** (`POST /security/pd/forget`).
- **Отзыв согласия** (`PATCH /security/consents/:id`).

### 5.5 Журналирование доступа к ПД

`pii_access_log` фиксирует:
- кто (user_id, user_email);
- к каким ПД (subject_id — id университета, fields);
- зачем (purpose: view | export | edit);
- когда (created_at), откуда (ip, user_agent).

Срок хранения: **1 год** (требование ФСТЭК для журналов ИБ).

## 6. Сетевая защита

- Только HTTPS (TLS 1.2+), HSTS 1 год.
- IP-whitelist (`ip_whitelist`): если список не пуст — доступ
  только с указанных CIDR.
- Nginx rate-limit: 30 req/s на IP для /api/, 5 req/min для /login.
- CSP, X-Frame-Options, X-Content-Type-Options.

## 7. Антивирус

ClamAV sidecar проверяет все загружаемые файлы (INSTREAM-протокол).
Заражённые файлы не попадают в MinIO, событие
`malware_detected` пишется в `security_events`.

## 8. Резервное копирование

- Ежедневный `pg_dump` (контейнер `backup`, retention 30 дней).
- Восстановление через `scripts/restore-backup.sh`.
- Проверка свежести бэкапов — cron `check-backups` в 05:00.

## 9. Мониторинг

- Prometheus + Alertmanager → Telegram.
- Критичные алерты: backend down, БД down, Redis down,
  5xx > 5%, latency p95 > 2s, антивирус не отвечает.

## 10. Соответствие нормативам

| Норматив | Как выполнено |
|---|---|
| ФЗ-149 «Об информации» | Классификация, режим обработки |
| ФЗ-152 «О персональных данных» | Шифрование, согласия, права субъектов |
| ПП №1119 (об уровнях защищённости) | УЗ-2 |
| Приказ ФСТЭК №117 | Все меры из раздела 2 |
| Приказ ФСТЭК №17 (ГИС) | Не применимо (система не ГИС) |

## 11. Реагирование на инциденты

1. Алерт → дежурный инженер.
2. Локализация: блокировка источника, отзыв сессий.
3. Расследование: `audit_log`, `security_events`, `pii_access_log`.
4. Уведомление Роскомнадзора (при утечке ПД) — в течение 24 часов.

## 12. Контакты

- Ответственный за ИБ: admin@rt.ru
- Технический дежурный: on-call@rt.ru