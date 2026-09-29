import express from 'express';
import { requestId } from '../../src/middleware/requestId.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import routes from '../../src/routes/index.js';

/**
 * Собирает Express-приложение БЕЗ cron, без WsService, без server.listen.
 * Используется в supertest.
 */
export function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(requestId);
  app.use('/api/v1', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}