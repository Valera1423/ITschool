#!/usr/bin/env bash
# ============================================================
# Рендер PlantUML-диаграмм в PNG для MkDocs.
#
# Запуск: ./scripts/render-diagrams.sh
# Требует: plantuml + graphviz (dot)
#
# Установка:
#   macOS:  brew install plantuml graphviz
#   Ubuntu: sudo apt install plantuml graphviz
#   Docker: docker run --rm -v "$PWD":/work plantuml/plantuml \
#             -o /work/docs/architecture/diagrams \
#             /work/docs/architecture/diagrams/*.puml
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="docs/architecture/diagrams"

if ! command -v plantuml > /dev/null 2>&1; then
  echo "❌ plantuml не найден. Установите: brew install plantuml graphviz"
  exit 1
fi

echo "🎨 Рендер диаграмм из $DIR"
plantuml -tpng -charset UTF-8 "$DIR"/*.puml
echo "✓ PNG готовы:"
ls -1 "$DIR"/*.png

echo ""
echo "Чтобы закоммитить:"
echo "  git add $DIR/*.png"