import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../config/logger.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * BullMQ: Queue могут делить соединение, а вот каждый Worker
 * ОБЯЗАН иметь своё (использует блокирующие команды).
 * QueueEvents — тоже отдельное.
 */
type RedisConnection = InstanceType<typeof Redis>;

function makeConnection(name: string): RedisConnection {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: `bullmq:${name}`,
  });
}

// Единое соединение только для Queue
const queueConnection = makeConnection('queues');

// ============================================================
// Определение очередей
// ============================================================
export const QUEUES = {
  email: new Queue('email', { connection: queueConnection }),
  push: new Queue('push', { connection: queueConnection }),
  reports: new Queue('reports', { connection: queueConnection }),
  integrations: new Queue('integrations', { connection: queueConnection }),
  excel: new Queue('excel', { connection: queueConnection }),
  presentation: new Queue('presentation', { connection: queueConnection }),
} as const;

// ============================================================
// Логируем события
// ============================================================
const queueEvents: QueueEvents[] = [];
Object.entries(QUEUES).forEach(([name, _queue]) => {
  const events = new QueueEvents(name, { connection: makeConnection(`events:${name}`) });
  queueEvents.push(events);

  events.on('completed', ({ jobId }) => {
    logger.debug({ queue: name, jobId }, 'job completed');
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.warn({ queue: name, jobId, reason: failedReason }, 'job failed');
  });
});

// ============================================================
// Хелперы для постановки задач
// ============================================================

export async function enqueueEmail(payload: {
  integrationId: string;
  to: string;
  toName?: string;
  subject?: string;
  body: string;
  universityId?: string;
}): Promise<string> {
  const job = await QUEUES.email.add('send', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  });
  return job.id!;
}

export async function enqueuePush(payload: {
  userId: string | null;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}): Promise<string> {
  const job = await QUEUES.push.add('send', payload, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 86400 },
  });
  return job.id!;
}

export async function enqueueIntegrationSync(payload: {
  integrationId: string;
  trigger: 'manual' | 'cron' | 'webhook';
  actor: string;
}): Promise<string> {
  const job = await QUEUES.integrations.add('sync', payload, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { age: 604800 },
    removeOnFail: { age: 604800 },
  });
  return job.id!;
}

export async function enqueueExcelImport(payload: {
  sessionId: string;
  userId: string;
  entity: string;
  filePath: string;
}): Promise<string> {
  const job = await QUEUES.excel.add('import', payload, {
    attempts: 1,
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  });
  return job.id!;
}

export async function enqueuePresentation(payload: {
  userId: string;
  from?: string;
  to?: string;
}): Promise<string> {
  const job = await QUEUES.presentation.add('generate', payload, {
    attempts: 1,
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 86400 },
  });
  return job.id!;
}

// ============================================================
// Регистрация воркеров — каждый со своим соединением
// ============================================================
export function startWorkers(): void {
  new Worker(
    'email',
    async (job: Job) => {
      const { InboxService } = await import('../services/inbox/inbox.service.js');
      return InboxService.send(job.data);
    },
    { connection: makeConnection('worker:email'), concurrency: 5 },
  );

  new Worker(
    'push',
    async (job: Job) => {
      const { PushService } = await import('../services/push.service.js');
      const { userId, ...payload } = job.data;
      return PushService.send(userId, payload);
    },
    { connection: makeConnection('worker:push'), concurrency: 10 },
  );

  new Worker(
    'integrations',
    async (job: Job) => {
      const { IntegrationsService } = await import('../services/integrations.service.js');
      const { integrationId, trigger, actor } = job.data;
      return IntegrationsService.syncIntegration(integrationId, trigger, actor);
    },
    { connection: makeConnection('worker:integrations'), concurrency: 2 },
  );

  new Worker(
    'excel',
    async (job: Job) => {
      const fs = await import('node:fs/promises');
      const { ExcelSyncService } = await import('../services/excel-sync.service.js');
      const { userId, entity, filePath } = job.data;
      const buffer = await fs.readFile(filePath);
      const user = {
        profileId: userId,
        name: 'Import',
        email: '',
        role: 'admin' as const,
        sub: '',
        blocked: false,
      };
      const result = await ExcelSyncService.import(entity, buffer, user);
      await fs.unlink(filePath).catch(() => {});
      return result;
    },
    { connection: makeConnection('worker:excel'), concurrency: 2 },
  );

  new Worker(
    'presentation',
    async (job: Job) => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { PresentationService } = await import('../services/presentation.service.js');
      const buffer = await PresentationService.generate(job.data);
      const dir = path.join(process.cwd(), 'tmp', 'presentations');
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${job.id}.pdf`);
      await fs.writeFile(filePath, buffer);
      return { filePath, sizeBytes: buffer.length };
    },
    { connection: makeConnection('worker:presentation'), concurrency: 1 },
  );

  logger.info('✓ BullMQ воркеры запущены');
}

export async function disconnectQueues(): Promise<void> {
  await Promise.all([
    ...Object.values(QUEUES).map((q) => q.close()),
    ...queueEvents.map((e) => e.close()),
  ]);
  await queueConnection.quit();
}