# ИТ Школа Ростелеком · CRM — Документация

**Система контроля и обработки статистических данных по обучению
студентов ВУЗов и школ по ИТ-направлениям.**

## Что здесь

Это техническая документация проекта. Она описывает:

- **Как запустить** систему локально и развернуть в проде
- **Архитектуру** — компоненты, потоки данных, безопасность
- **API** — все эндпоинты с примерами
- **Руководства** — для пользователей и администраторов
- **Runbooks** — что делать при инцидентах
- **Методы обработки данных** — ABC/XYZ, RFM, LTV, когорты
- **Соответствие** 152-ФЗ и ФСТЭК №117

## С чего начать

| Если вы… | Откройте |
|---|---|
| Разработчик, впервые видите проект | [Установка](getting-started/install.md) → [Разработка](getting-started/dev.md) |
| Администратор, разворачиваете прод | [Деплой](getting-started/deploy.md) |
| Backend-разработчик | [API](api/README.md), [Swagger](api/swagger.md) |
| Frontend-разработчик | [Архитектура](architecture/README.md), [API](api/README.md) |
| Аналитик | [Методы обработки данных](data-methods.md) |
| Дежурный инженер | [Runbooks](runbooks/README.md) |
| ИБ-специалист | [Безопасность](SECURITY.md), [Обработка ПД](DATA_PROCESSING.md) |
| Пользователь CRM | раздел «База знаний» внутри приложения |
| Администратор CRM | раздел «База знаний» внутри приложения |

## Ключевые ссылки

| | |
|---|---|
| **Репозиторий** | https://github.com/rt-it-school/crm |
| **Swagger UI** | https://crm.rt.ru/api/docs |
| **Grafana** | https://crm.rt.ru/grafana |
| **Keycloak** | https://keycloak.crm.rt.ru |

## Стек технологий

**Backend:** Node.js 20, Express, Prisma, PostgreSQL 16, Redis, BullMQ, Keycloak
**Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Query
**Инфраструктура:** Docker Compose, Nginx, MinIO, ClamAV, Prometheus, Grafana, Loki, Tempo

## Соглашения

- Все примеры в документации — рабочие
- В командах предполагается Linux/macOS; Windows — через WSL2
- Секреты в примерах — заглушки (`CHANGE_ME`, `***`)
- Комментарии в коде — на русском, для сложных мест — с обоснованием

## Как поддержать документацию

См. [CONTRIBUTING.md](https://github.com/rt-it-school/crm/blob/main/CONTRIBUTING.md).

Кратко:

1. Найти устаревший раздел
2. Исправить `.md` файл в `docs/`
3. Проверить локально: `mkdocs serve`
4. Создать PR

## Лицензия

Проприетарная. См. [LICENSE](https://github.com/rt-it-school/crm/blob/main/LICENSE).