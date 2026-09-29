// backend/src/routes/health.routes.ts
import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis } from '../db/redis.js';
import { WsService } from '../services/ws.service.js';

const router = Router();

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  info?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await redis.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function checkKeycloak(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const url = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}/.well-known/openid-configuration`;
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 3000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true, latencyMs: Date.now() - start };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function checkMinio(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const protocol = env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const url = `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/minio/health/live`;
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 3000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true, latencyMs: Date.now() - start };
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ============================================================
// Liveness — процесс жив, ничего не проверяет
// ============================================================
router.get('/live', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ============================================================
// Readiness — все зависимости
// ============================================================
router.get('/ready', async (_req, res, next) => {
  try {
    const [db, kc, minio, cache] = await Promise.all([
      checkDatabase(),
      checkKeycloak(),
      checkMinio(),
      checkRedis(),
    ]);

    const allOk = db.ok && kc.ok && minio.ok && cache.ok;

    return res.status(allOk ? 200 : 503).json({
      ok: allOk,
      checks: { database: db, keycloak: kc, minio, redis: cache },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, 'health check failed');
    next(e);
  }
});

// ============================================================
// GET /ws-stats — статистика WebSocket-подключений
//
// Возвращает агрегаты от WsService.stats():
//   - общее количество активных сокетов
//   - распределение по каналам и по scopeUniversityId
//   - количество уникальных авторизованных пользователей
//
// Персональные данные (имена, email, profileId) сюда НЕ попадают —
// только счётчики. Эндпоинт под auth + globalRateLimit; если нужно
// закрыть только для admin — оберни `requireRole('admin')`.
// ============================================================
router.get('/ws-stats', (_req, res) => {
  try {
    const stats =
      typeof WsService.stats === 'function' ? WsService.stats() : {};
    res.json({ ok: true, ...stats, timestamp: new Date().toISOString() });
  } catch (e) {
    // Не роняем мониторинг при ошибке внутри WsService
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================
// Базовый / (для совместимости с nginx /health)
// ============================================================
router.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'crm-backend',
    version: '1.0.0',
    env: env.NODE_ENV,
    uptime: process.uptime(),
  });
});

export default router;