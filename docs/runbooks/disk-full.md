# Кончилось место на диске

## Симптомы

- Алерт на `/` > 90%
- Сервисы падают: `no space left on device`
- Postgres: не может писать WAL
- Redis: не может писать AOF
- MinIO: не может загружать файлы
- Логи не пишутся
- Бэкапы падают

## Критичность

**P1.** При 100% заполнении:
- Postgres переходит в **read-only** или падает
- Redis отказывается писать
- Backend получает 500 на всех записях

## Диагностика

### 1. Проверить место

```bash
df -h
Показывает по разделам. Обратить внимание на / и /var/lib/docker.

2. Что занимает
bash
# Топ-10 директорий в /
du -h --max-depth=1 / | sort -hr | head -10

# Docker
docker system df -v
3. Размер Docker
bash
docker system df
Вывод:

text
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          15        10        8.2GB     3.1GB
Containers      20        20        500MB     0B
Local Volumes   8         8         45GB      0B
Build Cache     0         0         0B        0B
RECLAIMABLE — сколько можно освободить.

Экстренные действия (быстро освободить)
1. Очистить логи Docker
bash
# Ограничить размер логов всех контейнеров
truncate -s 0 /var/lib/docker/containers/*/*-json.log
⚠️ Радикально — сотрёт все логи. Для расследования лучше сначала скопировать.

Более мягко:

bash
docker compose -f docker-compose.prod.yml logs --tail=0 -f &  # ничего
# Или ротация через docker-compose.yml:
yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
2. Удалить старые образы
bash
docker image prune -a
Удалит все образы без контейнеров. Экономит гигабайты.

3. Удалить build cache
bash
docker builder prune -a
4. Удалить старые бэкапы
bash
# Смотрим
ls -lh /opt/crm/backups/ | sort -k9 | head -20

# Удаляем старше 30 дней
find /opt/crm/backups/ -name "*.sql.gz" -mtime +30 -delete
5. Очистить старые логи приложения
bash
# Nginx
docker exec crm-nginx find /var/log/nginx -name "*.log.*" -mtime +7 -delete
6. Очистить БД
sql
-- Старые записи
DELETE FROM audit_log WHERE created_at < now() - interval '90 days';
DELETE FROM integration_sync_logs WHERE started_at < now() - interval '90 days';
DELETE FROM user_sessions WHERE created_at < now() - interval '30 days';
DELETE FROM notifications WHERE created_at < now() - interval '30 days' AND read = true;
DELETE FROM idempotency_keys WHERE expires_at < now();

-- VACUUM (освободить место на диске)
VACUUM FULL;
⚠️ VACUUM FULL блокирует таблицы. Не в рабочие часы.

Пошаговое освобождение
Шаг 1. Быстрые победы
bash
# 1. Docker
docker system prune -a -f

# 2. Docker logs
find /var/lib/docker/containers -name "*-json.log" -exec truncate -s 0 {} \;

# 3. Старые бэкапы (>30 дней)
find /opt/crm/backups/ -name "*.sql.gz" -mtime +30 -delete
Обычно это освобождает 10–50 ГБ.

Шаг 2. Проверить /var/lib/docker
bash
du -h --max-depth=1 /var/lib/docker/ | sort -hr
Что там:

overlay2 — слои образов

volumes — данные контейнеров

containers — логи контейнеров

Шаг 3. Проверить volume'ы
bash
docker volume ls
docker volume inspect crm_postgres_data
postgres_data не удалять! Это БД.

minio_data — файлы (можно перенести на отдельный диск).

Шаг 4. Перенести тяжёлое на отдельный диск
Если есть второй диск (/dev/sdb):

bash
# Отформатировать
mkfs.ext4 /dev/sdb

# Примонтировать
mkdir -p /mnt/data
mount /dev/sdb /mnt/data

# В fstab
echo "/dev/sdb /mnt/data ext4 defaults 0 2" >> /etc/fstab

# Перенести Docker
systemctl stop docker
mv /var/lib/docker /mnt/data/docker
ln -s /mnt/data/docker /var/lib/docker
systemctl start docker
Шаг 5. Настроить ротацию
Docker-логи:

В docker-compose.prod.yml:

yaml
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
Бэкапы:

В docker/backup/backup.sh:

bash
find /backups -name "*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete
Логи приложения:

Pino уже пишет в stdout, Docker собирает. Loki хранит 90 дней.

Шаг 6. Почистить MinIO
Если MinIO занимает много:

bash
# Через mc (MinIO Client)
docker exec crm-minio mc admin info local

# Или через консоль http://localhost:9001
В UI можно удалить старые/ненужные файлы.

Шаг 7. Проверить, что всё ожило
bash
df -h
curl -s https://crm.example.ru/health/ready | jq
Postgres может выйти из read-only сам, или:

sql
SELECT pg_is_in_recovery();
Если диск 100% и Postgres в read-only
bash
# 1. Освободить хоть немного
docker system prune -a -f

# 2. Перезапустить Postgres
docker compose -f docker-compose.prod.yml restart postgres

# 3. Проверить
docker exec crm-postgres psql -U crm_user -d crm_db -c "SELECT 1"
Мониторинг
Алерты:

DiskUsageHigh — / > 80% (warning)

DiskUsageCritical — / > 90% (critical)

Метрика: node_filesystem_avail_bytes.

Постмортем
Что заняло место: логи? бэкапы? данные?

Как быстро заметили: алерт сработал?

Что улучшить: ротация, раздельные диски, мониторинг

Профилактика
Мониторинг диска с алертами

Ротация Docker-логов (max-size, max-file)

Ротация приложения (Loki retention)

Retention бэкапов 30 дней

Отдельный диск для /var/lib/docker (рекомендуется)

Отдельный диск для backups (рекомендуется)

Регулярная очистка БД (cron уже есть)

pg_repack для VACUUM без блокировки