#!/bin/sh
# Подготовка realm JSON: envsubst + удаление BOM
set -e

SRC="/opt/keycloak/data/import/realm-it-school.json.template"
DST="/opt/keycloak/data/import/realm-it-school.json"

if [ -f "$SRC" ]; then
  echo "→ Рендерим realm JSON через envsubst"
  envsubst < "$SRC" | sed '1s/^\xEF\xBB\xBF//' > "$DST"
fi

exec /opt/keycloak/bin/kc.sh "$@"