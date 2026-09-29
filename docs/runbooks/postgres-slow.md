# Postgres медленный

## Симптомы

- Алерт `SlowRequests` (p95 > 2s) или `VerySlowRequests` (p99 > 5s)
- Grafana: latency выросла
- Пользователи жалуются на медленный интерфейс
- `pg_stat_activity_max_tx_duration > 300`
- `PostgresTooManyConnections` алерт

## Диагностика

### 1. Проверить Grafana

**CRM Overview** → панели:

- **Latency** — p50/p95/p99
- **DB query p95 by model** — какая модель тормозит
- **PostgreSQL connections** — сколько занято
- **Node.js memory** — нет ли утечки

### 2. Проверить активные запросы

```bash
docker exec -it crm-postgres psql -U crm_user -d crm_db
sql
-- Активные запросы
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;
3. Проверить pg_stat_statements
Если расширение установлено:

sql
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
4. Проверить блокировки
sql
SELECT
  blocked_locks.pid AS blocked_pid,
  blocking_locks.pid AS blocking_pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
5. Проверить соединения
sql
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
Если active > 80% от max_connections — нужно увеличить пул или уменьшить нагрузку.

sql
SHOW max_connections;
6. Проверить размер БД
sql
SELECT pg_size_pretty(pg_database_size('crm_db'));

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
Действия
1. Убить долгие запросы
Если видите запрос, висящий >5 минут:

sql
SELECT pg_cancel_backend(pid);   -- мягко
SELECT pg_terminate_backend(pid);  -- жёстко
⚠️ Осторожно с транзакциями записи — может быть rollback.

2. VACUUM ANALYZE
Если БД давно не обслуживалась:

sql
VACUUM ANALYZE;
Может занять минуты. Не блокирует чтение.

3. Увеличить пул соединений
В .env backend:

bash
DB_POOL_MAX=20
Перезапустить:

bash
docker compose -f docker-compose.prod.yml restart backend
⚠️ Не превышайте max_connections Postgres (по умолчанию 100).

4. Увеличить ресурсы Postgres
yaml
# docker-compose.prod.yml
postgres:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 4G
Настройки postgresql.conf:

conf
shared_buffers = 1GB          # 25% RAM
effective_cache_size = 3GB    # 75% RAM
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 100
Перезапустить:

bash
docker compose -f docker-compose.prod.yml restart postgres
5. Добавить индексы
Если видите медленные запросы по конкретному полю:

sql
-- Анализ запроса
EXPLAIN ANALYZE SELECT * FROM universities WHERE status = 'Партнёр';
Если Seq Scan — нужен индекс:

sql
CREATE INDEX CONCURRENTLY idx_universities_status ON universities(status);
⚠️ CONCURRENTLY — без блокировки таблицы, но долго.

В коде: добавить @@index([field]) в schema.prisma и миграцию.

6. Уменьшить нагрузку
Увеличить кэш-таймауты Redis

Отключить не критичные cron-задачи

Ограничить частые эндпоинты

7. Убить «мёртвые» сессии
sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '10 minutes';
8. Отключить тяжёлые фичи
Временно:

Отчёты (rate-limit уже есть)

Аналитика (кэш 5-10 минут)

Bulk-операции

Экстренные меры
Если Postgres совсем не отвечает
bash
# Перезапустить
docker compose -f docker-compose.prod.yml restart postgres

# Подождать 30 секунд
sleep 30

# Проверить
docker exec crm-postgres pg_isready -U crm_user -d crm_db
Если не помогло — восстановить из бэкапа
См. Restore from backup.

Постмортем
Что тормозило: конкретный запрос? Общая нагрузка? Диск?

Как быстро заметили: алерт сработал?

Что улучшить: индексы, ресурсы, мониторинг

Профилактика
Регулярный VACUUM ANALYZE (cron в Postgres)

Мониторинг медленных запросов (log_min_duration_statement = 1000)

pg_stat_statements — расширение для анализа

Алерты на p95 > 1s, connection > 80%

Индексы для фильтров

Партиционирование больших таблиц (audit_log, inbox_messages)

Читающая реплика для отчётов (сейчас нет)