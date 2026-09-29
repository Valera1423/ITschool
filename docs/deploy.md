# Деплой в production

Документ описывает развёртывание CRM на боевом сервере.

## Требования к серверу

| Параметр | Минимум | Рекомендуется |
|---|---|---|
| CPU | 4 ядра | 8 ядер |
| RAM | 8 ГБ | 16 ГБ |
| Диск (SSD) | 100 ГБ | 250 ГБ |
| ОС | Ubuntu 22.04 / Debian 12 / RHEL 9 | Ubuntu 22.04 LTS |
| Docker | ≥ 24 | ≥ 26 |
| Docker Compose | ≥ 2.20 | ≥ 2.24 |

**Размещение:** для соответствия 152-ФЗ — **хостинг в РФ** (Selectel, Yandex Cloud, VK Cloud, Timeweb).

## Шаг 1. Подготовка сервера

```bash
ssh root@YOUR_SERVER_IP

# Обновить систему
apt update && apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Установить git
apt install -y git

# Проверить
docker --version
docker compose version
Настройка firewall
bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (ACME)
ufw allow 443/tcp   # HTTPS
ufw enable
Установка fail2ban
bash
apt install -y fail2ban
systemctl enable --now fail2ban
Шаг 2. DNS
Создайте A-записи, указывающие на IP сервера:

text
crm.example.ru            A    YOUR_SERVER_IP
keycloak.crm.example.ru   A    YOUR_SERVER_IP
Подождите распространения (5 минут — 24 часа). Проверьте:

bash
dig +short crm.example.ru
# Должен вернуть IP сервера
Шаг 3. Клонирование
bash
cd /opt
git clone https://github.com/rt-it-school/crm.git
cd crm
Шаг 4. Настройка .env
bash
cp .env.production.example .env
nano .env
Обязательные поля
bash
# Домены
APP_HOSTNAME=crm.example.ru
KEYCLOAK_HOSTNAME=keycloak.crm.example.ru
ACME_EMAIL=admin@example.ru

# PostgreSQL — сгенерировать пароль
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 24)
KEYCLOAK_BACKEND_SECRET=$(openssl rand -base64 48)

# MinIO
MINIO_ROOT_USER=crm_minio
MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)

# 152-ФЗ — ОБЯЗАТЕЛЬНО
PII_KEY=$(openssl rand -base64 48)

# OAuth state (опционально, fallback на KEYCLOAK_BACKEND_SECRET)
OAUTH_STATE_SECRET=

# WhatsApp (опционально)
WHATSAPP_APP_SECRET=

# Web Push (сгенерировать через npm run vapid)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.ru

# SMTP (для писем Keycloak)
SMTP_HOST=smtp.example.ru
SMTP_PORT=587
SMTP_USER=crm-noreply@example.ru
SMTP_PASSWORD=***

# Telegram-алерты
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_CRITICAL_CHAT_ID=-1001234567890
TELEGRAM_WARNINGS_CHAT_ID=-1001234567890

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)

# ClamAV
CLAMAV_ENABLED=true
⚠️ Сохраните .env в безопасное место! Восстановить PII_KEY без бэкапа невозможно — все ПД станут нечитаемыми.

Ограничить права:

bash
chmod 600 .env
Шаг 5. SSL-сертификаты
Первый выпуск — через certbot standalone (пока нет nginx):

bash
mkdir -p docker/nginx/certs docker/nginx/www

docker run --rm \
  -p 80:80 \
  -v $PWD/docker/nginx/certs:/etc/letsencrypt \
  -v $PWD/docker/nginx/www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d crm.example.ru \
  -d keycloak.crm.example.ru \
  --email admin@example.ru \
  --agree-tos --non-interactive
Проверьте:

bash
ls docker/nginx/certs/live/
# crm.example.ru  keycloak.crm.example.ru
Шаг 6. Сборка и запуск
bash
./scripts/deploy.sh
Скрипт:

Проверит наличие .env

Соберёт образы backend и frontend

Подтянет базовые образы (postgres, redis, keycloak, minio)

Запустит всё через docker-compose.prod.yml

Дождётся health-check

Покажет статус

Первый запуск занимает 10–15 минут.

Проверьте:

bash
docker compose -f docker-compose.prod.yml ps
Все сервисы должны быть healthy / running.

Шаг 7. Проверка
bash
# Backend health
curl https://crm.example.ru/health

# Ready (со всеми зависимостями)
curl https://crm.example.ru/health/ready

# Swagger UI
curl -I https://crm.example.ru/api/docs
Откройте в браузере:

Frontend: https://crm.example.ru

Keycloak: https://keycloak.crm.example.ru

Grafana: https://crm.example.ru/grafana

Шаг 8. Первичная настройка
8.1. Засеять БД (опционально)
bash
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma db seed
⚠️ В проде не запускайте seed без необходимости — он создаёт демо-данные.

8.2. Задать пароли пользователям
Через Keycloak Admin Console:

Открыть https://keycloak.crm.example.ru

Войти как admin / KEYCLOAK_ADMIN_PASSWORD

Realm it-school → Users

Выбрать пользователя → Credentials → Set Password

Или через CLI:

bash
docker exec -it crm-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user admin --password "$KEYCLOAK_ADMIN_PASSWORD"

docker exec -it crm-keycloak /opt/keycloak/bin/kcadm.sh set-password \
  --realm it-school --username admin@rt.ru --new-password 'Admin123!'
8.3. Настроить SMTP
Keycloak использует SMTP для писем (сброс пароля, приглашения).
Проверьте .env и перезапустите Keycloak:

bash
docker compose -f docker-compose.prod.yml restart keycloak
8.4. Настроить 2FA
По ФСТЭК №117 для ролей admin и manager — обязательна.
Пользователь настраивает её сам при первом входе.

Можно потребовать принудительно: Keycloak → Authentication → Required Actions → Configure OTP.

Обновление
bash
cd /opt/crm
git pull
./scripts/deploy.sh
Скрипт применит новые миграции автоматически (через entrypoint backend).

Откат
bash
git checkout <previous-tag>
./scripts/deploy.sh
⚠️ Откат миграций Prisma не поддерживается автоматически. Если релиз содержит несовместимую миграцию — восстановите из бэкапа (см. runbook).

Бэкапы
Автоматические
Сервис backup в docker-compose.prod.yml ежедневно в 03:00 делает pg_dump.

Файлы: /opt/crm/backups/backup-YYYY-MM-DD-HHMMSS.sql.gz.
Retention: 30 дней.

Проверка
bash
ls -lh /opt/crm/backups/ | tail -5
Свежий файл должен быть не старше 24 часов.

Ручной бэкап
bash
./scripts/backup-now.sh
Восстановление
См. runbooks/restore-from-backup.md.

Мониторинг
Grafana: https://crm.example.ru/grafana

Alertmanager: отправляет алерты в Telegram

Проверить Grafana:

bash
docker compose -f docker-compose.prod.yml logs grafana | grep "HTTP Server Listen"
Логи
bash
# Backend
docker compose -f docker-compose.prod.yml logs -f backend

# Nginx
docker compose -f docker-compose.prod.yml logs -f nginx

# Postgres
docker compose -f docker-compose.prod.yml logs -f postgres
Или через Loki (в Grafana → Explore → Loki).

Обслуживание
Обновить SSL (Certbot сам обновляет)
Проверить:

bash
docker compose -f docker-compose.prod.yml logs certbot | tail -20
Проверить срок действия:

bash
openssl s_client -connect crm.example.ru:443 -servername crm.example.ru 2>/dev/null \
  | openssl x509 -noout -dates
Почистить Docker
bash
docker system prune -a --volumes
⚠️ Не удаляйте volumes, если не уверены! Они содержат БД, MinIO, Keycloak.

Обновить образы базовых сервисов
bash
docker compose -f docker-compose.prod.yml pull postgres redis keycloak minio nginx
docker compose -f docker-compose.prod.yml up -d
Чек-лист продакшена
□ DNS-записи настроены
□ SSL-сертификаты получены и обновляются
□ .env заполнен, права 600
□ PII_KEY сохранён в безопасном месте
□ Firewall настроен (22, 80, 443)
□ fail2ban работает
□ Все контейнеры healthy
□ /health/ready возвращает ok: true
□ Swagger доступен
□ Frontend открывается
□ Keycloak Admin доступен
□ Grafana доступна
□ SMTP настроен
□ Telegram-алерты приходят
□ Backup работает (свежий файл в backups/)
□ Тестовое восстановление из бэкапа проведено
□ 2FA обязательна для admin/manager
□ Мониторинг и алерты работают
□ Документация передана команде