# Нагрузочное тестирование

**Дата:** 2026-09-22
**Инструмент:** k6 v2.2.0
**Стенд:** локальный (backend + PostgreSQL + Redis + Keycloak + MinIO)

## Требования ТЗ

| № | Требование | Метрика |
|---|---|---|
| НФТ-1 | Время отклика < 1 сек | p(95) `http_req_duration` |
| НФТ-6 | 50 параллельных пользователей | k6 `constant-vus=50` |
| НФТ-7 | 10 параллельных отчётов | k6 `constant-vus=10` |

## Тест 1. 50 параллельных пользователей

**Скрипт:** `scripts/loadtest/50-users.js`
**Сценарии:** sustained (50 VU × 5 мин) + ramp (0→50→50→0)

| Метрика | Значение | Порог | Статус |
|---|---|---|---|
| p(95) времени ответа | **230 ms** | < 1000 ms | ✅ |
| p(99) времени ответа | 358 ms | — | ✅ |
| http_req_failed | **0.00%** | < 1% | ✅ |
| checks_succeeded | **100.00%** | > 99% | ✅ |
| Всего запросов | 66 828 | — | |
| RPS | 111 req/s | — | |

## Тест 2. 10 параллельных отчётов

**Скрипт:** `scripts/loadtest/10-reports.js`

| Метрика | Значение | Порог | Статус |
|---|---|---|---|
| p(95) времени отчёта | **138.6 ms** | < 30 000 ms | ✅ |
| p(99) времени отчёта | 358 ms | — | ✅ |
| http_req_failed | **0.00%** | < 2% | ✅ |
| checks_succeeded | **100.00%** | — | ✅ |
| Всего запросов | 24 554 | — | |
| RPS | 204 req/s | — | |

**Покрытые эндпоинты:**
- `/reports/dashboard-summary`
- `/reports/interactions`
- `/analytics/abc-xyz`
- `/analytics/rfm`
- `/analytics/cohorts`
- `/analytics/ltv`
- `/analytics/metrics`
- `/analytics/period-comparison`

## Вывод

Система **выдерживает** нагрузку:
- 50 параллельных пользователей — с запасом по времени отклика **4.3×**.
- 10 параллельных отчётов — с запасом **216×**.

Все требования ТЗ НФТ-1, НФТ-6, НФТ-7 **выполнены**.

## Как воспроизвести

```bash
# 1. Запустить инфраструктуру
docker compose -f docker-compose.dev.yml up -d

# 2. Миграции + seed
cd backend
npx prisma migrate deploy
npx prisma db seed

# 3. Backend
npm run dev

# 4. В отдельном терминале — k6
cd ..
$env:BASE_URL = "http://localhost:4000/api/v1"
$env:TOKEN = ""
$env:TEST_USER_ID = "00000000-0000-0000-0000-000000000001"

# 50 пользователей
k6 run scripts/loadtest/50-users.js

# 10 отчётов
k6 run scripts/loadtest/10-reports.js