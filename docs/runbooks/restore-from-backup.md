# Восстановление из бэкапа

## Когда применять

- Потеря данных (случайное удаление, порча)
- Ошибка миграции, которая испортила схему
- Переезд на новый сервер
- Восстановление после ransomware-атаки

## Подготовка

### 1. Оценить ситуацию

- **Что потеряно:** таблицы? данные? схема?
- **Когда:** когда последний раз всё работало?
- **Как:** из-за чего потеряно?

### 2. Остановить запись

**Критично!** Иначе новые записи потеряются при восстановлении.

```bash
docker compose -f docker-compose.prod.yml stop backend
Frontend можно оставить, но он не сможет писать.

3. Уведомить
Telegram-канал команды

Пользователей: «система недоступна на N минут»

4. Выбрать бэкап
bash
ls -lh ./backups/
Выбрать файл до момента проблемы.

Последний свежий — если проблема «только что»

Раньше — если данные испортились незаметно

Dry-run (проверка)
ВСЕГДА сначала dry-run:

bash
./scripts/restore-backup.sh backups/backup-2026-09-24-030000.sql.gz --dry-run
Проверит целостность архива. Ничего не изменит.

Восстановление
1. Запустить скрипт
bash
./scripts/restore-backup.sh backups/backup-2026-09-24-030000.sql.gz
Скрипт:

Создаст safety-бэкап текущего состояния (pre-restore-*.sql.gz)

Спросит подтверждение (y/N)

Отключит активные соединения

Создаст crm_db_restore

Восстановит в неё

Проверит количество таблиц

Переименует:

crm_db → crm_db_old

crm_db_restore → crm_db

2. Подтвердить
Нажать y. Процесс занимает 1–10 минут (зависит от размера).

3. Запустить backend
bash
docker compose -f docker-compose.prod.yml start backend
4. Проверить
bash
# Health
curl -s https://crm.example.ru/health/ready | jq

# Логи
docker compose -f docker-compose.prod.yml logs -f backend
Зайти в UI, проверить ключевые разделы:

□ Список вузов
□ Карточка вуза
□ Workflow
□ Аналитика
□ Отчёты
5. Удалить старую БД
Если всё хорошо — через 1–2 дня:

bash
docker exec crm-postgres psql -U crm_user -d postgres \
  -c 'DROP DATABASE crm_db_old;'
До этого храните — на случай отката.

Откат (если восстановление не помогло)
bash
# Остановить backend
docker compose -f docker-compose.prod.yml stop backend

# Вернуть старую БД
docker exec crm-postgres psql -U crm_user -d postgres \
  -c 'ALTER DATABASE crm_db RENAME TO crm_db_failed;'
docker exec crm-postgres psql -U crm_user -d postgres \
  -c 'ALTER DATABASE crm_db_old RENAME TO crm_db;'

# Запустить
docker compose -f docker-compose.prod.yml start backend
Частичное восстановление (одна таблица)
Если потеряна только часть данных:

bash
# Распаковать дамп
gunzip -c backups/backup-2026-09-24.sql.gz > /tmp/backup.sql

# Восстановить только нужную таблицу
pg_restore --table=universities \
  -h localhost -U crm_user -d crm_db /tmp/backup.sql
⚠️ Связанные таблицы (interactions, tasks) могут «отстать». Придётся восстанавливать
и их.

Проверка после восстановления
Целостность
sql
-- Количество ключевых записей
SELECT 'universities', count(*) FROM universities WHERE deleted_at IS NULL
UNION ALL
SELECT 'interactions', count(*) FROM interactions WHERE deleted_at IS NULL
UNION ALL
SELECT 'tasks', count(*) FROM tasks WHERE deleted_at IS NULL
UNION ALL
SELECT 'profiles', count(*) FROM profiles;
Сравнить с ожидаемым (например, последний известный count).

ПД
Убедиться, что PII_KEY тот же, что был при бэкапе:

sql
SELECT contact_email FROM universities WHERE contact_email IS NOT NULL LIMIT 1;
-- Должно начинаться с "v1:" (шифротекст)
Если ключ другой — расшифровка провалится. Восстановить старый PII_KEY.

Сессии
После восстановления все сессии из бэкапа «воскреснут».
Возможно, стоит их отозвать:

sql
UPDATE user_sessions SET revoked = true, revoked_at = now(), revoked_reason = 'restore';
После восстановления
□ Все сервисы healthy
□ Пользователи могут войти
□ Данные на месте
□ Нет ошибок в логах
□ Метрики в норме
Постмортем
Что потеряли: сколько данных, за какой период

Как восстановили: какой бэкап, сколько заняло

Что улучшить: частоту бэкапов, retention, мониторинг

Профилактика
Ежедневный авто-бэкап (уже есть)

Ежемесячный тест восстановления (обязательно!)

Оффсайт-копия бэкапов (S3, внешний сервер)

Шифрование бэкапов (GPG)

Мониторинг размера бэкапа (если резко упал — что-то не так)