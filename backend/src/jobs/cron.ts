// backend/src/jobs/cron.ts
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../config/logger.js';
import { prisma } from '../db/prisma.js';
import { SyncService } from '../services/sync.service.js';
import { PushService } from '../services/push.service.js';
import { SmartHintsService } from '../services/smart-hints.service.js';
import { ImapPoller } from '../services/inbox/imap.poller.js';
import { AiService } from '../services/ai.service.js';
import { enqueueIntegrationSync } from './queues.js';
import { runWithAuditContext } from '../db/audit-context.js';

const tasks: ScheduledTask[] = [];

function safeSchedule(
  expr: string,
  fn: () => Promise<void>,
  label: string,
): ScheduledTask {
  const t = cron.schedule(expr, () => {
    void fn().catch((e) =>
      logger.error({ err: e, job: label }, `cron ${label} failed`),
    );
  });
  tasks.push(t);
  return t;
}

function shouldRunNow(schedule: string | null, lastSync: Date | null): boolean {
  if (!schedule) return false;
  if (!lastSync) return true;
  const minutesSince = (Date.now() - lastSync.getTime()) / 60_000;

  if (schedule === '*/5 * * * *') return minutesSince >= 5;
  if (schedule === '*/15 * * * *') return minutesSince >= 15;
  if (schedule === '*/30 * * * *') return minutesSince >= 30;
  if (schedule === '0 * * * *') return minutesSince >= 60;
  if (schedule === '0 */2 * * *') return minutesSince >= 120;
  if (schedule === '0 */6 * * *') return minutesSince >= 360;
  if (schedule === '0 0 * * *') return minutesSince >= 1440;
  return minutesSince >= 120;
}

async function jobImapPoll(): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: { type: 'email', status: 'Активна' },
  });

  for (const integration of integrations) {
    const config = (integration.config ?? {}) as Record<string, unknown>;
    if (!config.imap_host) continue;
    try {
      await ImapPoller.poll(integration.id);
    } catch (e) {
      logger.error({ err: e, integration: integration.name }, 'IMAP poll error');
    }
  }
}

async function jobAutoSync(): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: { autoSync: true, status: 'Активна' },
  });

  for (const integration of integrations) {
    if (!shouldRunNow(integration.syncSchedule, integration.lastSyncAt)) continue;

    await enqueueIntegrationSync({
      integrationId: integration.id,
      trigger: 'cron',
      actor: 'система',
    }).catch((e) => logger.error({ err: e }, 'enqueue sync failed'));
  }
}

/**
 * Напоминания о встречах.
 *
 * ВАЖНО (исправлено): dedup идёт по ключу
 * `(entityType, entityId, userId, minutesBefore)` — уникальный индекс
 * обновлён в схеме Prisma + миграции. Раньше ключ был
 * `(entityType, entityId, minutesBefore)`, из-за чего у второго менеджера
 * напоминание не срабатывало (первая запись ReminderLog блокировала
 * второго получателя).
 */
async function jobReminders(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60_000);

  const interactions = await prisma.interaction.findMany({
    where: {
      status: 'Запланировано',
      reminderMinutes: { not: null },
      startTime: { not: null },
      interactionDate: {
        gte: new Date(now.toISOString().slice(0, 10)),
        lte: new Date(windowEnd.toISOString().slice(0, 10)),
      },
    },
    select: {
      id: true,
      title: true,
      interactionDate: true,
      startTime: true,
      reminderMinutes: true,
      manager: true,
    },
  });

  for (const ev of interactions) {
    if (!ev.startTime || !ev.reminderMinutes) continue;

    const start = new Date(
      `${ev.interactionDate.toISOString().slice(0, 10)}T${ev.startTime}`,
    );
    const remindAt = new Date(start.getTime() - ev.reminderMinutes * 60_000);
    if (remindAt < now || remindAt > windowEnd) continue;

    // Резолвим получателя — profile по fullName менеджера
    const profile = await prisma.profile.findFirst({
      where: { fullName: ev.manager, blocked: false },
      select: { id: true },
    });

    if (!profile) {
      logger.warn(
        { interactionId: ev.id, manager: ev.manager },
        'Напоминание: менеджер не найден среди профилей',
      );
      continue;
    }

    // Проверяем — не отправляли ли уже ИМЕННО ЭТОМУ пользователю
    const already = await prisma.reminderLog.findUnique({
      where: {
        entityType_entityId_userId_minutesBefore: {
          entityType: 'interaction',
          entityId: ev.id,
          userId: profile.id,
          minutesBefore: ev.reminderMinutes,
        },
      },
    });
    if (already) continue;

    await prisma.reminderLog
      .create({
        data: {
          entityType: 'interaction',
          entityId: ev.id,
          userId: profile.id,
          minutesBefore: ev.reminderMinutes,
        },
      })
      .catch((e) => {
        // P2002 = уникальный конфликт — параллельный cron успел первым
        if ((e as { code?: string }).code !== 'P2002') {
          logger.warn({ err: e, interactionId: ev.id }, 'reminderLog create failed');
        }
      });

    await PushService.send(profile.id, {
      title: `Через ${ev.reminderMinutes} мин: ${ev.title}`,
      body: `Начало в ${ev.startTime.slice(0, 5)}`,
      url: '/calendar',
      tag: `reminder-${ev.id}`,
    }).catch(() => {});
  }
}

async function jobHeartbeat(): Promise<void> {
  const url = process.env.HEARTBEAT_URL;
  if (!url) return;
  await fetch(url, { method: 'GET' }).catch((e) =>
    logger.warn({ err: e }, 'heartbeat failed'),
  );
}

/**
 * Ночная переиндексация базы знаний.
 *
 * Оптимизирует поиск по `kb_articles`: пересчитывает embeddings
 * (pgvector) для всех статей. Полный прогон в 3:00 — страховка на
 * случай, если точечные обновления из `knowledge.routes.ts` упали
 * или накопились расхождения.
 *
 * Дневной поток индексирует статьи поштучно (см. `scheduleReindex`
 * в `knowledge.routes.ts`) — чтобы пользователь получал свежие
 * результаты поиска сразу после сохранения статьи.
 */
async function jobKbReindex(): Promise<void> {
  const result = await AiService.embedAllArticles();
  logger.info(result, '✓ KB reindexed');
}

export function startCron(): void {
  logger.info('⏰ Запуск cron-задач');

  safeSchedule('*/2 * * * *', jobImapPoll, 'imap-poll');
  safeSchedule('*/5 * * * *', jobAutoSync, 'auto-sync');
  safeSchedule('*/5 * * * *', jobHeartbeat, 'heartbeat');
  safeSchedule('* * * * *', jobReminders, 'reminders');

  safeSchedule(
    '*/15 * * * *',
    async () => {
      await SyncService.syncAllUsers();
    },
    'sync-users',
  );

  // Каждые 5 минут — помечаем истёкшие по idle/absolute сессии.
  safeSchedule(
    '*/5 * * * *',
    async () => {
      const { SessionService } = await import('../services/session.service.js');
      const r = await SessionService.expireStale();
      if (r.idle + r.absolute > 0) {
        logger.info(
          { idle: r.idle, absolute: r.absolute },
          '✓ Истёкшие сессии помечены revoked',
        );
      }
    },
    'expire-sessions',
  );

  safeSchedule(
    '0 3 * * *',
    async () => {
      const purged = await prisma.$queryRaw<[{ cleanup_trash: number }]>`
        SELECT public.cleanup_trash(30) AS cleanup_trash
      `;
      logger.info({ purged: purged[0]?.cleanup_trash ?? 0 }, '✓ Корзина очищена');
    },
    'purge-deleted',
  );

  // Ночная переиндексация KB — 03:30, после очистки корзины,
  // до дневных бэкапов и аналитики.
  safeSchedule('30 3 * * *', jobKbReindex, 'kb-reindex');

  safeSchedule(
    '0 4 * * *',
    async () => {
      const threshold = new Date(Date.now() - 90 * 86400000);
      const [auditRemoved, syncRemoved] = await Promise.all([
        prisma.auditLog.deleteMany({ where: { createdAt: { lt: threshold } } }),
        prisma.integrationSyncLog.deleteMany({
          where: { startedAt: { lt: threshold } },
        }),
      ]);
      logger.info(
        { auditRemoved: auditRemoved.count, syncRemoved: syncRemoved.count },
        '✓ Старые логи очищены',
      );
    },
    'cleanup-logs',
  );

  // Раз в сутки в 04:30 — удаляем сессии старше 30 дней
  // (согласуется с политикой хранения audit_log).
  safeSchedule(
    '30 4 * * *',
    async () => {
      const cutoff = new Date(Date.now() - 30 * 86_400_000);
      const r = await prisma.userSession.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      logger.info({ removed: r.count }, '✓ Старые сессии удалены');
    },
    'cleanup-sessions',
  );

  safeSchedule(
    '30 4 * * *',
    async () => {
      const [notifs, idem] = await Promise.all([
        prisma.$queryRaw<[{ cleanup_notifications: number }]>`
          SELECT public.cleanup_notifications(30) AS cleanup_notifications
        `,
        prisma.$queryRaw<[{ cleanup_idempotency_keys: number }]>`
          SELECT public.cleanup_idempotency_keys() AS cleanup_idempotency_keys
        `,
      ]);
      logger.info(
        {
          notifications: notifs[0]?.cleanup_notifications ?? 0,
          idempotency: idem[0]?.cleanup_idempotency_keys ?? 0,
        },
        '✓ Вспомогательные таблицы очищены',
      );
    },
    'cleanup-misc',
  );

  safeSchedule(
    '0 5 * * *',
    async () => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dir = process.env.BACKUP_DIR ?? '/backups';

      const files = await fs.readdir(dir).catch(() => [] as string[]);
      const sqlFiles = files.filter((f) => f.endsWith('.sql.gz'));
      if (sqlFiles.length === 0) {
        logger.error('❌ Бэкапы отсутствуют!');
        return;
      }
      const stats = await Promise.all(
        sqlFiles.map(async (f) => ({
          name: f,
          mtime: (await fs.stat(path.join(dir, f))).mtime,
        })),
      );
      const latest = stats.sort(
        (a, b) => b.mtime.getTime() - a.mtime.getTime(),
      )[0];
      const hoursAgo = (Date.now() - latest.mtime.getTime()) / 3600_000;

      if (hoursAgo > 30) {
        logger.error(
          { latest: latest.name, hoursAgo: Math.round(hoursAgo) },
          '❌ Последний бэкап старше 30 часов',
        );
      } else {
        logger.info(
          { latest: latest.name, hoursAgo: Math.round(hoursAgo) },
          '✓ Бэкап свежий',
        );
      }
    },
    'check-backups',
  );

  safeSchedule(
    '0 8 * * *',
    async () => {
      await SmartHintsService.run();
    },
    'smart-hints',
  );

  logger.info('✓ Cron-задачи запущены');
}

export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return runWithAuditContext(
    { userId: null, userEmail: 'system@crm', source: 'cron' },
    fn,
  );
}