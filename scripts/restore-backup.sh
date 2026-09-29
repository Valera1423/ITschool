#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Восстановление из бэкапа.
# Использование: ./scripts/restore-backup.sh <backup-file.sql.gz> [--dry-run]
# ============================================================

cd "$(dirname "$0")/.."

BACKUP_FILE="${1:?Укажи файл бэкапа}"
DRY_RUN="${2:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Файл не найден: $BACKUP_FILE"
  exit 1
fi

# Загружаем .env
set -a
source .env
set +a

CONTAINER="${POSTGRES_CONTAINER:-crm-postgres}"
DB_NAME="${POSTGRES_DB}"
DB_USER="${POSTGRES_USER}"

echo "═══════════════════════════════════════════════════"
echo "  Восстановление БД из бэкапа"
echo "═══════════════════════════════════════════════════"
echo "  Файл:     $BACKUP_FILE"
echo "  Размер:   $(du -h "$BACKUP_FILE" | cut -f1)"
echo "  БД:       $DB_NAME"
echo "  Контейнер: $CONTAINER"
echo ""

if [ "$DRY_RUN" != "--dry-run" ]; then
  # Создаём safety-бэкап текущего состояния
  SAFETY_BACKUP="backups/pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
  echo "🛡️  Создаю safety-бэкап: $SAFETY_BACKUP"
  mkdir -p backups
  docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$SAFETY_BACKUP"
  echo "✓ Safety-бэкап: $(du -h "$SAFETY_BACKUP" | cut -f1)"
  echo ""

  read -p "⚠️  Продолжить восстановление? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 0
  fi
fi

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "🧪 DRY-RUN: проверка валидности архива..."
  gzip -t "$BACKUP_FILE" && echo "✓ Архив целый" || exit 1
  echo "✓ Тест пройден. Запусти без --dry-run для восстановления."
  exit 0
fi

# Terminate connections
echo "🔌 Отключаю активные соединения..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" > /dev/null

# Drop & recreate
echo "🗑️  DROP DATABASE..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME}_restore;"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME}_restore OWNER $DB_USER;"

# Restore
echo "📦 Восстанавливаю..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "${DB_NAME}_restore" > /dev/null

# Verify
TABLES=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "${DB_NAME}_restore" -t -c "
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
")
echo "✓ Восстановлено таблиц: $TABLES"

# Swap
echo "🔄 Замена основной БД..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "ALTER DATABASE ${DB_NAME}_restore RENAME TO $DB_NAME;"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Восстановление завершено"
echo "═══════════════════════════════════════════════════"
echo "  Safety:    $SAFETY_BACKUP"
echo "  Старая БД: ${DB_NAME}_old (удалить после проверки)"
echo ""
echo "  Перезапусти backend:"
echo "    docker compose -f docker-compose.prod.yml restart backend"
echo ""
echo "  Если всё хорошо — удали старую:"
echo "    docker exec $CONTAINER psql -U $DB_USER -d postgres -c 'DROP DATABASE ${DB_NAME}_old;'"