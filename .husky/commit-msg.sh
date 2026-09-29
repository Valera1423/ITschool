#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Проверяем формат Conventional Commits
npx --no -- commitlint --edit "$1"