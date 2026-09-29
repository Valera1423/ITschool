#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Локальный деплой CRM.
# Использование: ./scripts/deploy.sh [tag]
# ============================================================

cd "$(dirname "$0")/.."

TAG="${1:-latest}"
export IMAGE_TAG="$TAG"

echo "🚀 Deploy CRM (tag: $TAG)"

# Проверка .env
if [ ! -f ".env" ]; then
  echo "❌ Нет .env. Скопируйте .env.production.example → .env и заполните."
  exit 1
fi

# Build
echo "📦 Сборка образов..."
docker compose -f docker-compose.prod.yml build --pull backend frontend

# Pull
echo "⬇️  Обновление базовых образов..."
docker compose -f docker-compose.prod.yml pull postgres redis keycloak minio nginx certbot prometheus grafana

# Up
echo "🔥 Запуск..."
docker compose -f docker-compose.prod.yml up -d

# Ждём
echo "⏳ Ждём готовности..."
sleep 20

# Smoke
echo "🧪 Smoke-test..."
if curl -fsS "http://localhost/health" > /dev/null; then
  echo "✓ /health OK"
else
  echo "✗ /health FAIL"
  docker compose -f docker-compose.prod.yml logs --tail=50 nginx
  exit 1
fi

echo ""
echo "═════════════════════════════════════════════"
echo "  ✅ Деплой завершён"
echo "═════════════════════════════════════════════"
docker compose -f docker-compose.prod.yml ps