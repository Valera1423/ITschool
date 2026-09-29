# Keycloak недоступен

## Симптомы

- Алерт о недоступности Keycloak
- `curl https://crm.example.ru/health/ready` возвращает `keycloak.ok: false`
- Пользователи **не могут войти** (SSO не работает)
- Уже вошедшие могут работать (access-token не проверяется через Keycloak после выпуска — только подпись через JWKS-кэш)
- Через 15 минут истекают access-tokens → все разлогинятся
- Silent renew не срабатывает

## Влияние

| Что | Работает? |
|---|---|
| Вход новых пользователей | ❌ |
| Работа существующих | ✅ пока JWT жив |
| Работа существующих (>15 мин) | ❌ |
| API для интеграций | ⚠️ (зависит от auth) |
| Webhooks | ✅ (без auth) |

**Критичный инцидент.** Через 15 минут система фактически недоступна.

## Действия

### 1. Проверить Keycloak

```bash
docker compose -f docker-compose.prod.yml ps keycloak
docker compose -f docker-compose.prod.yml logs keycloak --tail 100
2. Проверить health-endpoint
bash
docker exec crm-keycloak /opt/keycloak/bin/kc.sh show-config | head
curl -s http://localhost:8080/health/ready
Keycloak 26 использует порт 9000 для health-check (не 8080):

bash
curl -s http://localhost:9000/health/ready
3. Проверить базу данных
Keycloak использует ту же БД, схема keycloak:

bash
docker exec crm-postgres psql -U crm_user -d crm_db -c "SELECT count(*) FROM keycloak.realm;"
Если ошибка — БД недоступна (см. Postgres slow).

4. Перезапустить Keycloak
bash
docker compose -f docker-compose.prod.yml restart keycloak
Подождать 60–120 секунд — Keycloak стартует медленно.

5. Проверить готовность
bash
docker compose -f docker-compose.prod.yml logs keycloak | grep "Running the server"
curl -s http://localhost:9000/health/ready
6. Если Keycloak не стартует
Частые причины:

6.1. OOM
Keycloak требует ~2 ГБ. Проверить:

bash
docker stats crm-keycloak --no-stream
free -h
Увеличить память:

yaml
# docker-compose.prod.yml
keycloak:
  deploy:
    resources:
      limits:
        memory: 2G
6.2. Ошибка миграции схемы
Keycloak 26 может падать при обновлении с 22/23:

bash
docker compose -f docker-compose.prod.yml logs keycloak | grep -i "migration"
Откат на предыдущую версию (временно):

yaml
image: quay.io/keycloak/keycloak:25.0
6.3. Ошибка конфигурации
Проверить .env:

KEYCLOAK_ADMIN_PASSWORD — не пустой

KC_DB_URL — корректный

KC_HOSTNAME — совпадает с DNS

6.4. Порт 8080 занят
bash
ss -tulpn | grep 8080
7. Восстановить из бэкапа схемы keycloak
⚠️ Крайняя мера! Потеряются все сессии и настройки.

bash
# Остановить Keycloak
docker compose -f docker-compose.prod.yml stop keycloak

# Восстановить схему
gunzip -c keycloak-backup.sql.gz | \
  docker exec -i crm-postgres psql -U crm_user -d crm_db

# Запустить
docker compose -f docker-compose.prod.yml up -d keycloak
8. Пока Keycloak лежит
Обходной путь: выдать пользователям временные access-tokens
напрямую (не через Keycloak), но это требует ручной подписи — сложно.

Проще: сообщить пользователям, что вход недоступен, и ждать.

Для критичных операций: админ может зайти через
TEST_BYPASS_AUTH=true + X-Test-User-Id (только в dev-подобных условиях,
не использовать в проде).

9. Уведомить
Telegram-канал команды

Пользователей, если >15 минут

Руководителя ИТ

Постмортем
Почему упал: OOM? Обновление? Ошибка конфига?

Как быстро заметили: алерт сработал?

Как быстро восстановили: ttd, ttr

Что улучшить: мониторинг, runbook, HA

Профилактика
Мониторинг: health-check каждые 30 секунд

HA Keycloak: 2+ инстанса за балансировщиком (сейчас single)

Отдельная БД для Keycloak: изоляция от основной

Плановая проверка обновлений: не «в пятницу вечером»

Регулярный бэкап схемы keycloak