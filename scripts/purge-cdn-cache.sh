#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Очистка CDN-кеша Nginx для MinIO.
# Использование: ./scripts/purge-cdn-cache.sh [pattern]
# ============================================================

PATTERN="${1:-}"

cd "$(dirname "$0")/.."

if [ -z "$PATTERN" ]; then
  echo "🗑️  Полная очистка кеша MinIO..."
  docker exec crm-nginx sh -c 'rm -rf /var/cache/nginx/minio/*'
  echo "✓ Кеш очищен"
else
  echo "🗑️  Очистка по паттерну: $PATTERN"
  docker exec crm-nginx sh -c "find /var/cache/nginx/minio -type f -name '*${PATTERN}*' -delete"
  echo "✓ Очищено"
fi

# Reload nginx
docker exec crm-nginx nginx -s reload