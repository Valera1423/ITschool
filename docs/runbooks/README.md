# Runbooks

Инструкции для дежурного инженера: **что делать при инциденте**.

## Что такое runbook

Это пошаговая инструкция: «если случилось X — сделай Y, потом Z».
Пишется заранее, когда нет паники.

## Оглавление

| Ситуация | Runbook |
|---|---|
| Redis недоступен | [redis-down.md](redis-down.md) |
| Keycloak недоступен | [keycloak-down.md](keycloak-down.md) |
| Восстановление из бэкапа | [restore-from-backup.md](restore-from-backup.md) |
| Postgres медленный | [postgres-slow.md](postgres-slow.md) |
| Кончилось место на диске | [disk-full.md](disk-full.md) |
| Nginx отдаёт 502 | [nginx-502.md](nginx-502.md) |

## Общие правила

### 1. Не паниковать

Почти всё восстанавливается. Сначала — оцените масштаб.

### 2. Оценить влияние

- **Кто затронут:** все пользователи / часть / один
- **Что не работает:** вся система / раздел / интеграция
- **Есть ли workaround:** ручная работа / другой сервис

### 3. Уведомить

- **Дежурного** (если не вы): on-call@rt.ru
- **Руководителя ИТ:** при серьёзном инциденте
- **Пользователей:** через Telegram-канал, если >15 мин

### 4. Зафиксировать

Создать запись: время, симптомы, действия, результат.
Пригодится для post-mortem.

### 5. Действовать по runbook

Не импровизировать. Если runbook не помогает — эскалация.

### 6. Post-mortem

После инцидента — разбор:

- Что случилось
- Почему не заметили заранее
- Что улучшить (мониторинг, runbook, код)

## Инструменты дежурного

### Доступ к серверу

```bash
ssh deploy@crm.example.ru
Основные команды
bash
# Статус всех контейнеров
docker compose -f docker-compose.prod.yml ps

# Логи сервиса
docker compose -f docker-compose.prod.yml logs -f <service>

# Ресурсы
docker stats --no-stream

# Диск
df -h

# Health-check
curl -s https://crm.example.ru/health/ready | jq
Grafana
https://crm.example.ru/grafana

Telegram-алерты
Приходят автоматически от Alertmanager.

Классификация инцидентов
Уровень	Что	Реакция
P1	Вся система недоступна	Немедленно
P2	Критичная функция недоступна	15 мин
P3	Деградация производительности	1 час
P4	Некритичный сбой	Рабочие часы
Контакты
Роль	Контакт
On-call	on-call@rt.ru
Руководитель ИТ	it-lead@rt.ru
Security	security@rt.ru
DPO (152-ФЗ)	dpo@rt.ru
Мониторинг
Grafana-дашборды
CRM Overview — общее здоровье

CRM Business — бизнес-метрики

CRM Realtime & WS — WS, push

Алерты
Critical → Telegram (немедленно)

Warning → Telegram (раз в 6 ч)

Автоматические проверки
Watchdog (внешний) — каждую минуту

Backup check — 05:00

SSL check — при обновлении

Чек-лист дежурного в начале смены
□ Проверить, что все контейнеры healthy
□ Открыть Grafana — нет ли красных панелей
□ Проверить Telegram — не было ли алертов
□ Свежий ли бэкап (ls -lh ./backups/ | tail -5)
□ Актуальны ли SSL-сертификаты
□ Нет ли подозрительных записей в security_events