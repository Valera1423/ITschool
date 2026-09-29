.PHONY: help deploy up down restart logs ps build backup restore shell-backend shell-db shell-keycloak health clean third-party

help:
	@echo "ИТ Школа Ростелеком · CRM"
	@echo "══════════════════════════════"
	@echo "  make deploy         — полный деплой"
	@echo "  make up             — запуск всех сервисов"
	@echo "  make down           — остановка"
	@echo "  make restart        — перезапуск"
	@echo "  make logs           — логи всех сервисов"
	@echo "  make logs-backend   — логи backend"
	@echo "  make logs-frontend  — логи frontend"
	@echo "  make logs-keycloak  — логи keycloak"
	@echo "  make ps             — статус контейнеров"
	@echo "  make build          — пересборка образов"
	@echo "  make backup         — создать бэкап сейчас"
	@echo "  make restore F=…    — восстановить из бэкапа"
	@echo "  make shell-backend  — shell в backend"
	@echo "  make shell-db       — psql в postgres"
	@echo "  make shell-keycloak — shell в keycloak"
	@echo "  make health         — проверка здоровья"
	@echo "  make third-party    — обновить THIRD_PARTY.md"
	@echo "  make clean          — удалить всё (с volumes!)"

deploy:
	@./scripts/deploy.sh

up:
	@docker compose up -d

down:
	@docker compose down

restart:
	@docker compose restart

logs:
	@docker compose logs -f

logs-backend:
	@docker compose logs -f backend

logs-frontend:
	@docker compose logs -f frontend

logs-keycloak:
	@docker compose logs -f keycloak

ps:
	@docker compose ps

build:
	@docker compose build --pull

backup:
	@./scripts/backup-now.sh

restore:
	@if [ -z "$(F)" ]; then echo "Использование: make restore F=backups/file.sql.gz"; exit 1; fi
	@./scripts/restore-backup.sh $(F)

shell-backend:
	@docker compose exec backend sh

shell-db:
	@docker compose exec postgres psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}

shell-keycloak:
	@docker compose exec keycloak sh

health:
	@./scripts/health-check.sh

third-party:
	@node scripts/generate-third-party.mjs

clean:
	@echo "⚠️  Это удалит ВСЕ данные!"
	@read -p "Продолжить? (yes/no): " c; if [ "$$c" = "yes" ]; then docker compose down -v; else echo "Отменено"; fi