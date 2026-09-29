# Архитектура CRM ИТ Школы РТК

## 1. Обзор

CRM построена как классическое 3-звенное веб-приложение:
- **Frontend** — React SPA (Vite)
- **Backend** — Node.js + Express + Prisma
- **Хранилища** — PostgreSQL, Redis, MinIO

Взаимодействие — через REST API и WebSocket. Аутентификация — Keycloak (OIDC).

## 2. Компонентная архитектура

![Компоненты](diagrams/component-diagram.png)

_Схема построена в Archi (Archimate). Исходник: [crm.archimate](archimate/crm.archimate)._

### Компоненты

| Слой | Компонент | Назначение |
|---|---|---|
| Приложение | CRM Frontend | React SPA, работает в браузере |
| Приложение | CRM Backend | REST API, бизнес-логика, WS-сервер |
| Приложение | CRM Worker | BullMQ, обработка очередей (email, push, integrations) |
| Данные | PostgreSQL 16 | Основная БД |
| Данные | Redis 7 | Кэш, rate-limit, BullMQ |
| Данные | MinIO | S3-совместимое хранилище файлов |
| Инфра | Nginx | Reverse proxy, SSL termination |
| Инфра | Keycloak 26 | OIDC-провайдер |
| Инфра | Prometheus + Grafana + Loki + Tempo | Мониторинг, логи, трейсы |
| Инфра | Certbot | Автообновление Let's Encrypt |

## 3. Бизнес-процессы

### Workflow взаимодействия с вузом

![Workflow](diagrams/workflow.png)

_14 шагов от поиска контактов до контроля исполнения (см. ТЗ п.2)._

### Аналитические процессы

![Аналитика](diagrams/analytics.png)

- ABC/XYZ — классификация вузов
- RFM — сегментация
- LTV — оценка ценности
- Когортный анализ

## 4. Развёртывание

![Deploy](diagrams/deployment.png)

Один Docker-хост (Linux), 16 сервисов в `docker-compose.prod.yml`.

## 5. Модель данных

См. [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) — 50+ таблиц.

## 6. Безопасность

- **152-ФЗ** — шифрование ПД (PII_KEY), audit log, PdConsent
- **ФСТЭК №117** — RBAC, scopes, rate-limit, IP-whitelist, 2FA, session mgmt

См. [SECURITY.md](../SECURITY.md).