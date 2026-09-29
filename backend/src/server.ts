import { app } from './index.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  logger.info(`🚀 CRM backend на порту ${env.PORT} (${env.NODE_ENV})`);
});