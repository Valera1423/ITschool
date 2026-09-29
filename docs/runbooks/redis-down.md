# Redis недоступен

## Симптомы

- Алерт `RedisDown` в Telegram
- Grafana: `redis_up = 0`
- `curl https://crm.example.ru/health/ready` возвращает `redis.ok: false`
- Backend: ошибки `ECONNREFUSED` в логах
- Очереди BullMQ не обрабатываются
- Кэш не работает (запросы медленнее)
- Сессии пользователей могут сбрасываться
- WebSocket-соединения могут рваться

## Влияние

| Что | Работает? |
|---|---|
| Frontend | ✅ |
| Backend (чтение) | ✅ (медленнее) |
| Backend (запись) | ✅ |
| Кэш ответов | ❌ |
| Очереди (email, push) | ❌ |
| Rate-limit | ⚠️ (fallback на memory) |
| Сессии | ⚠️ (пересоздаются) |
| WebSocket | ⚠️ (переподключение) |

Пользователи могут работать, но медленнее. Очереди копятся.

## Действия

### 1. Проверить Redis

```bash
docker compose -f docker-compose.prod.yml ps redis
docker compose -f docker-compose.prod.yml logs redis --tail 50
2. Проверить соединение
bash
docker exec crm-redis redis-cli ping
# Должно быть: PONG
Если PONG — Redis жив, проблема в сети или конфиге.
Если ошибка — Redis упал.

3. Перезапустить Redis
bash
docker compose -f docker-compose.prod.yml restart redis
Подождать 10 секунд.

4. Проверить, что поднялся
bash
docker exec crm-redis redis-cli ping
curl -s https://crm.example.ru/health/ready | jq '.checks.redis'
5. Если Redis не поднимается
Проверить память:

bash
docker stats crm-redis --no-stream
free -h
Redis 7 в этом проекте ограничен 256 МБ (--maxmemory 256mb).
Если используется больше — контейнер убит по OOM.

Проверить логи:

bash
docker compose -f docker-compose.prod.yml logs redis | grep -i error
Частые причины:

OOM — увеличить --maxmemory или очистить

Disk full — Redis с AOF не может писать → см. disk-full.md

Повреждение AOF — восстановить из appendonly.aof

6. Если данные повреждены
bash
# Остановить
docker compose -f docker-compose.prod.yml stop redis

# Сохранить AOF (для расследования)
cp -r ./volumes/redis/data ./volumes/redis/data.broken-$(date +%s)

# Удалить повреждённый AOF
rm -f ./volumes/redis/data/appendonly.aof

# Запустить
docker compose -f docker-compose.prod.yml up -d redis
⚠️ Данные кэша будут потеряны, но это не критично:
они восстановятся из БД при первых запросах.

7. Проверить очереди
bash
docker exec crm-redis redis-cli
> keys bull:*
> llen bull:email:wait
> llen bull:push:wait
Если очереди большие — backend подхватит их после восстановления.

8. Проверить backend
bash
docker compose -f docker-compose.prod.yml logs backend --tail 100 | grep -i redis
Backend с ioredis автоматически переподключается. Ручной перезапуск
нужен только если соединение «залипло».

bash
docker compose -f docker-compose.prod.yml restart backend
9. Уведомить
Если Redis был недоступен >15 минут:

Написать в Telegram-канал команды

Уведомить пользователей, если пропущены уведомления/напоминания

Постмортем
Проверить:

Почему упал: OOM? Диск? Сеть?

Была ли деградация до падения: Grafana → memory usage

Можно ли было предотвратить: увеличить лимиты? Улучшить мониторинг?

Профилактика
Мониторинг памяти: алерт RedisHighMemory при >90%

Резерв Redis: рассмотреть Redis Sentinel или Cluster (сейчас single-instance)

Persistent storage: AOF + RDB включены

Отдельный сервер: Redis не должен делить сервер с тяжёлыми сервисами