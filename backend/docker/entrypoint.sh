#!/bin/sh
# ============================================================
# Entrypoint backend: ждёт БД, применяет миграции, запускает сервер.
#
# ВАЖНО (исправлено): в POSIX sh нет here-string `<<<`, был бы
# bashism. Используем echo | ... для передачи SQL в stdin.
# ============================================================
set -eu

echo "🚀 CRM Backend"
echo "   Environment: ${NODE_ENV:-production}"

# ---------- Ожидание PostgreSQL ----------
echo "⏳ Ждём PostgreSQL..."
MAX_TRIES=60
TRIES=0

until echo "SELECT 1" | npx prisma db execute --stdin --schema=./prisma/schema.prisma > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "❌ PostgreSQL не отвечает за $MAX_TRIES попыток"
    exit 1
  fi
  echo "  PostgreSQL не готов ($TRIES/$MAX_TRIES)..."
  sleep 2
done
echo "✓ PostgreSQL готов"

# ---------- Миграции ----------
# При нескольких репликах может быть гонка — делаем retry, потому что
# prisma migrate deploy идемпотентен и сам использует advisory-lock,
# но иногда падает с P1001/P2028 при холодном старте.
echo "📦 Применяем миграции Prisma..."
MIGRATE_TRIES=0
until npx prisma migrate deploy; do
  MIGRATE_TRIES=$((MIGRATE_TRIES + 1))
  if [ "$MIGRATE_TRIES" -ge 5 ]; then
    echo "❌ prisma migrate deploy упал 5 раз — выходим"
    exit 1
  fi
  echo "  Миграция не удалась ($MIGRATE_TRIES/5), retry через 5с..."
  sleep 5
done
echo "✓ Миграции применены"

# ---------- Seed (опционально) ----------
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "🌱 Запускаем seed…"
  # Не падаем, если seed частично не прошёл
  npx prisma db seed || echo "⚠️  Seed завершился с ошибкой (продолжаем)"
fi

# ---------- Запуск ----------
echo "✅ Старт сервера на порту ${PORT:-4000}"
exec "$@"