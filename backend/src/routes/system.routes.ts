import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { ok } from '../utils/response.js';

const router = Router();

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  severity: z.enum(['warning', 'error', 'critical']).optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
});

/**
 * GET /system/errors — последние ошибки.
 * Читает из audit_log (там же хранится frontend_errors).
 */
router.get('/errors', requireRole('admin'), async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const rows = await prisma.$queryRaw<Array<{
      id: bigint;
      user_email: string | null;
      action: string;
      after: unknown;
      created_at: Date;
    }>>`
      SELECT id, user_email, action, after, created_at
      FROM audit_log
      WHERE entity = 'frontend_errors'
        ${q.from ? prisma.$queryRaw`AND created_at >= ${new Date(q.from)}` : prisma.$queryRaw``}
        ${q.to ? prisma.$queryRaw`AND created_at <= ${new Date(q.to)}` : prisma.$queryRaw``}
      ORDER BY created_at DESC
      LIMIT ${q.limit}
    `;
    return ok(res, rows);
  } catch (e) { next(e); }
});

/**
 * GET /system/health — сводка по сервисам.
 */
router.get('/health', requireRole('admin'), async (_req, res, next) => {
  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - started;

    // Redis
    const { redis } = await import('../db/redis.js');
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;

    // MinIO
    const { StorageService } = await import('../services/storage.service.js');
    const minioStart = Date.now();
    let minioOk = false;
    try {
      minioOk = await StorageService.exists('__healthcheck__');
    } catch { /* not found = ok */ minioOk = true; }
    const minioLatency = Date.now() - minioStart;

    // Keycloak
    const kcStart = Date.now();
    const { env } = await import('../config/env.js');
    const kcRes = await fetch(
      `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}/.well-known/openid-configuration`,
    ).catch(() => null);
    const kcOk = kcRes?.ok ?? false;
    const kcLatency = Date.now() - kcStart;

    // Очереди
    const { QUEUES } = await import('../jobs/queues.js');
    const queues: Record<string, unknown> = {};
    for (const [name, q] of Object.entries(QUEUES)) {
      queues[name] = await q.getJobCounts();
    }

    return ok(res, {
      db: { ok: true, latencyMs: dbLatency },
      redis: { ok: true, latencyMs: redisLatency },
      minio: { ok: minioOk, latencyMs: minioLatency },
      keycloak: { ok: kcOk, latencyMs: kcLatency },
      queues,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (e) { next(e); }
});

export default router;