# Nginx отдаёт 502 Bad Gateway

## Что значит

Nginx не может получить ответ от upstream (backend, frontend, keycloak, minio).

## Диагностика

### 1. Проверить логи Nginx

```bash
docker compose -f docker-compose.prod.yml logs nginx --tail 100
Ищем:

text
connect() failed (111: Connection refused) while connecting to upstream
upstream timed out (110: Connection timed out)
no live upstreams
2. Проверить контейнеры
bash
docker compose -f docker-compose.prod.yml ps
Все должны быть healthy / running.

3. Проверить конкретный upstream
Если 502 на /api/* → backend:

bash
docker exec crm-nginx wget -qO- http://backend:4000/health
Если 502 на / → frontend:

bash
docker exec crm-nginx wget -qO- http://frontend:80/health
Если 502 на /keycloak/*:

bash
docker exec crm-nginx wget -qO- http://keycloak:8080/health/ready
Причины и решения
1. Backend не запущен
Симптом:

text
connect() failed (111: Connection refused) while connecting to upstream: http://backend:4000
Диагностика:

bash
docker compose -f docker-compose.prod.yml ps backend
docker compose -f docker-compose.prod.yml logs backend --tail 100
Решение:

bash
docker compose -f docker-compose.prod.yml restart backend
sleep 10
curl -s https://crm.example.ru/health
2. Backend упал при старте
Частые причины:

Ошибка .env → проверить docker logs backend

Миграции упали → применить вручную

БД недоступна → проверить postgres

Redis недоступен → проверить redis (backend должен стартовать без Redis, но ругаться)

Проверить логи:

bash
docker compose -f docker-compose.prod.yml logs backend | tail -50
3. Backend не отвечает вовремя
Симптом:

text
upstream timed out (110: Connection timed out) while reading response header from upstream
Причина: backend медленный (>60 сек).

Диагностика: Grafana → Latency.

Решение:

Уменьшить нагрузку

Увеличить proxy_read_timeout в nginx.conf:

nginx
location /api/ {
  proxy_read_timeout 120s;
}
Оптимизировать эндпоинт (см. Postgres slow)

4. Frontend не отвечает
bash
docker compose -f docker-compose.prod.yml restart frontend
Проверить, что контейнер запущен:

bash
docker compose -f docker-compose.prod.yml ps frontend
5. Keycloak упал
См. Keycloak down.

6. MinIO упал
bash
docker compose -f docker-compose.prod.yml restart minio
sleep 5
docker exec crm-nginx wget -qO- http://minio:9000/minio/health/live
7. Nginx сам сломался
bash
# Проверить конфиг
docker exec crm-nginx nginx -t

# Если ок — перезагрузить
docker exec crm-nginx nginx -s reload

# Если ошибка — исправить конфиг и перезагрузить
8. SSL-проблемы
Если в логах:

text
SSL_do_handshake() failed
Проверить сертификаты:

bash
ls -la docker/nginx/certs/live/crm.example.ru/
openssl x509 -in docker/nginx/certs/live/crm.example.ru/fullchain.pem -noout -dates
Если истёк — обновить:

bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker exec crm-nginx nginx -s reload
Пошаговое восстановление
Шаг 1. Понять, что именно 502
bash
# Смотрим логи Nginx
docker compose -f docker-compose.prod.yml logs nginx --tail 50 | grep 502
Найти строку вида:

text
2026/09/24 10:15:30 [error] 12#12: *123 connect() failed (111: Connection refused) while connecting to upstream, client: 1.2.3.4, request: "GET /api/v1/universities HTTP/1.1", upstream: "http://172.20.0.5:4000/api/v1/universities"
Смотрим upstream: http://... — это конкретный сервис.

Шаг 2. Проверить конкретный сервис
URL	Сервис
/api/*	backend:4000
/	frontend:80
/keycloak/*	keycloak:8080
/storage/*	minio:9000
/grafana/*	grafana:3000
Шаг 3. Перезапустить проблемный сервис
bash
docker compose -f docker-compose.prod.yml restart <service>
sleep 15
curl -s https://crm.example.ru/health
Шаг 4. Если не помогло — перезапустить всё
bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
sleep 60
curl -s https://crm.example.ru/health/ready | jq
⚠️ Downtime ~1–2 минуты.

Шаг 5. Если всё ещё 502 — проверить DNS/сеть
bash
# Из контейнера Nginx
docker exec -it crm-nginx sh
# Внутри:
getent hosts backend
ping -c 2 backend
wget -qO- http://backend:4000/health
Если DNS не резолвится — контейнеры не в одной сети:

bash
docker network inspect crm-internal
Все сервисы должны быть в crm-internal.

Особые случаи
502 только на /api/v1/ws
WebSocket. Проверьте nginx.conf:

nginx
location /ws {
  proxy_pass http://backend:4000/ws;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_read_timeout 3600s;
}
Без Upgrade/Connection — WebSocket не работает.

502 на большие запросы
client_max_body_size 25M — если файл больше, Nginx отдаст 413, не 502.

502 на медленные отчёты
Отчёты (PDF, XLSX) могут занять >60 сек. Увеличить:

nginx
location /api/v1/reports/ {
  proxy_read_timeout 300s;
}
Мониторинг
Алерт Nginx5xxRateHigh — 5xx > 5%.

В Grafana → CRM Overview → Error rate.

Постмортем
Что именно упало: backend? frontend? БД?

Почему: OOM? Ошибка кода? Внешний сбой?

Как быстро заметили: алерт сработал?

Что улучшить: мониторинг, health-check, HA

Профилактика
Health-check в docker-compose.yml (уже есть)

Restart policy: unless-stopped (уже есть)

Мониторинг 5xx в Grafana

Алерты на недоступность сервисов

HA backend: 2+ реплик за балансировщиком (сейчас 1)