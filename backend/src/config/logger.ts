import pino from 'pino';
import { env } from './env.js';

/**
 * Структурированный логгер.
 * В dev — цветной pretty, в prod — JSON (для сбора в ELK/Loki).
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  base: { service: 'crm-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      '*.api_key',
      '*.secret',
    ],
    remove: true,
  },
});