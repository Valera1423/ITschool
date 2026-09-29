#!/usr/bin/env bash
# Внешний watchdog. Запускать на отдельной машине через cron */1
# Проверяет /health, при падении 3 раза подряд — алерт.

set -u

CRM_URL="https://crm.rt.ru/health"
STATE_FILE="/var/lib/crm-watchdog/state"
FAIL_THRESHOLD=3
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

mkdir -p "$(dirname "$STATE_FILE")"
FAILS=$(cat "$STATE_FILE" 2>/dev/null || echo 0)

if curl -fsS --max-time 10 "$CRM_URL" > /dev/null 2>&1; then
  if [ "$FAILS" -ge "$FAIL_THRESHOLD" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=✅ CRM: сервис восстановлен" > /dev/null
  fi
  echo 0 > "$STATE_FILE"
  exit 0
fi

FAILS=$((FAILS + 1))
echo "$FAILS" > "$STATE_FILE"

if [ "$FAILS" -eq "$FAIL_THRESHOLD" ]; then
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=🚨 CRM: сервис недоступен (${FAILS} попыток подряд). URL: ${CRM_URL}" > /dev/null
fi