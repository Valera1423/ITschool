/**
 * Простой фронтенд-логгер.
 * В dev — console, в prod — можно подключить Sentry.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

function log(level: LogLevel, message: string, data?: unknown) {
  if (!isDev && level === 'debug') return;

  const time = new Date().toISOString().slice(11, 19);
  const prefix = `[${time}] [${level.toUpperCase()}]`;

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(prefix, message, data ?? '');
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(prefix, message, data ?? '');
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(prefix, message, data ?? '');
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(prefix, message, data ?? '');
      // Сюда можно добавить Sentry.captureMessage
      break;
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};