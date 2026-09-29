import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';

import { env, corsOrigins } from './config/env.js';
import { logger } from './config/logger.js';
import { swaggerSpec } from './config/swagger.js';
import { initSentry } from './config/sentry.js';
import { initTracing, shutdownTracing } from './config/tracing.js';
import { registry, metricsMiddleware } from './config/metrics.js';

import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { bodyLogger } from './middleware/body-logger.js';

import routes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';

import { startCron } from './jobs/cron.js';
import { startWorkers, disconnectQueues } from './jobs/queues.js';
import { WsService } from './services/ws.service.js';
import { disconnectPrisma } from './db/prisma.js';
import { disconnectRedis } from './db/redis.js';
import { auditContext } from './db/audit-context.js';

initSentry();
initTracing();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// ============================================================
// In-flight tracking — ДОЛЖЕН БЫТЬ ПЕРВЫМ.
// Иначе graceful shutdown не ждёт ничего, кроме запросов,
// которые всё равно завершатся сами.
// ============================================================
const inflight = new Set<() => void>();
app.use((_req, res, next) => {
  const done = () => inflight.delete(done);
  inflight.add(done);
  res.on('finish', done);
  res.on('close', done);
  next();
});

// ============================================================
// Безопасность
// ============================================================
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Trace-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Trace-Id', 'X-Feature-Flags'],
  }),
);

// ============================================================
// Инфраструктура
// ============================================================
app.use(compression());

// rawBody сохраняем для проверки подписи webhook'ов (WhatsApp/Meta).
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      (req as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(requestId);
app.use(metricsMiddleware);

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
  }),
);

app.use(bodyLogger);

// ============================================================
// Audit context (ALS)
// ============================================================
app.use((req, _res, next) => {
  const ctx = {
    userId: null as string | null,
    userEmail: null as string | null,
    ip: req.ip ?? undefined,
    userAgent: req.get('user-agent') ?? undefined,
  };
  auditContext.run(ctx, () => next());
});

// ============================================================
// Health + /metrics
// ============================================================
app.use('/health', healthRoutes);
app.use('/ready', healthRoutes);

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

// ============================================================
// Rate limit
// ============================================================
app.use(globalRateLimit);

// ============================================================
// Swagger
// ============================================================
if (env.SWAGGER_ENABLED) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { background-color: #0284c7; }',
      customSiteTitle: 'CRM API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        displayRequestDuration: true,
      },
    }),
  );
  app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec));
  logger.info(`📚 Swagger UI: ${env.API_BASE_URL}/api/docs`);
}

// ============================================================
// API
// ============================================================
app.use('/api/v1', routes);

// ============================================================
// Обработка ошибок (порядок важен!)
// 1) Sentry ловит ошибку и вызывает next(err)
// 2) notFoundHandler — для 404 без ошибок
// 3) errorHandler — формирует JSON-ответ
// ============================================================
Sentry.setupExpressErrorHandler(app);
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// HTTP + WS
// ============================================================
const server = http.createServer(app);
WsService.attach(server);

// ============================================================
// Cron + воркеры
// ============================================================
if (env.NODE_ENV !== 'test' && process.env.ENABLE_CRON !== 'false') {
  startCron();
  startWorkers();
}

// ============================================================
// Graceful shutdown
// ============================================================
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} — graceful shutdown, in-flight: ${inflight.size}`);

  server.close(() => logger.info('HTTP-сервер закрыт'));

  const deadline = Date.now() + 25_000;
  while (inflight.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (inflight.size > 0) {
    logger.warn(`${inflight.size} запросов не завершились за 25 сек`);
  }

  await Promise.allSettled([
    disconnectQueues().catch((e) => logger.error({ err: e }, 'queues disconnect')),
    disconnectRedis().catch((e) => logger.error({ err: e }, 'redis disconnect')),
    shutdownTracing().catch((e) => logger.error({ err: e }, 'tracing shutdown')),
    disconnectPrisma().catch((e) => logger.error({ err: e }, 'prisma disconnect')),
  ]);

  setTimeout(() => process.exit(1), 5000).unref();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — завершаем работу');
  process.exit(1);
});

export { app, server };
export default app;