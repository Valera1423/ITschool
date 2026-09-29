// backend/src/config/metrics.ts
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

export const registry = new Registry();

// Собираем стандартные метрики Node.js (CPU, memory, event loop)
collectDefaultMetrics({ register: registry });

// ============================================================
// HTTP-метрики
// ============================================================
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

// ============================================================
// Бизнес-метрики
// ============================================================
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Prisma query duration',
  labelNames: ['model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

export const dbErrorsTotal = new Counter({
  name: 'db_errors_total',
  help: 'Total DB errors',
  labelNames: ['code'],
  registers: [registry],
});

export const activeUsersGauge = new Gauge({
  name: 'crm_active_users',
  help: 'Users with activity in last 15 minutes',
  registers: [registry],
});

export const pushSentTotal = new Counter({
  name: 'push_notifications_sent_total',
  help: 'Total push notifications sent',
  registers: [registry],
});

export const automationRunsTotal = new Counter({
  name: 'automation_runs_total',
  help: 'Total automation runs',
  labelNames: ['rule', 'success'],
  registers: [registry],
});

// ============================================================
// WebSocket-метрики
//
// Используются WsService при connect/disconnect/broadcast.
// Labels намеренно минимальны, чтобы не порождать «кардинальность»
// (по пользователям, по конкретным сущностям) — это увело бы
// метрики в десятки тысяч серий и убило Prometheus.
// ============================================================

/** Общее число подключённых WS-клиентов (включая неавторизованных). */
export const wsClientsTotal = new Gauge({
  name: 'crm_ws_clients_total',
  help: 'Total WebSocket clients connected',
  registers: [registry],
});

/** Число WS-клиентов, прошедших аутентификацию (есть profileId). */
export const wsClientsAuthed = new Gauge({
  name: 'crm_ws_clients_authed',
  help: 'WebSocket clients with valid JWT',
  registers: [registry],
});

/**
 * Счётчик broadcast-сообщений.
 *
 * Метка `type` — это тип события (`universities:transferred`,
 * `comments:created`, `notifications:new`, `workflows:transition` и т.д.).
 * Типов событий у нас десятки, не тысячи, поэтому кардинальность
 * остаётся низкой.
 */
export const wsBroadcastTotal = new Counter({
  name: 'ws_broadcast_total',
  help: 'Total WebSocket broadcasts',
  labelNames: ['type'],
  registers: [registry],
});

/**
 * Опционально: счётчик отброшенных сообщений (например, когда у
 * клиента переполнен буфер или сокет в состоянии CLOSING/CLOSED).
 * Метка `reason` — короткая строка-причина: 'closed', 'backpressure',
 * 'no-target' и т.п.
 */
export const wsBroadcastDroppedTotal = new Counter({
  name: 'ws_broadcast_dropped_total',
  help: 'Total WebSocket broadcasts dropped (no target / closed socket)',
  labelNames: ['reason'],
  registers: [registry],
});

// ============================================================
// Middleware
// ============================================================
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Пропускаем сам /metrics, чтобы не засорять
  if (req.path === '/metrics') return next();

  const start = Date.now();

  res.on('finish', () => {
    // Нормализуем path — убираем uuid, чтобы не создавать тысячи серий
    const path = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');

    const duration = (Date.now() - start) / 1000;

    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: String(res.statusCode),
    });

    httpRequestDuration.observe(
      { method: req.method, path, status: String(res.statusCode) },
      duration,
    );
  });

  next();
}