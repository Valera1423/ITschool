# E2E-тесты (Playwright)

## Что проверяем

1. **Вузы** (`specs/universities.spec.ts`)
   - создание вуза → добавление взаимодействия → экспорт отчёта
   - поиск находит созданный вуз

## Предусловия

1. Подняты сервисы:
   ```bash
   docker compose -f docker-compose.dev.yml up -d