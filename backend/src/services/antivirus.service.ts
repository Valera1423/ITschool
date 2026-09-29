// backend/src/services/antivirus.service.ts
import net from 'node:net';
import { logger } from '../config/logger.js';

/**
 * Клиент ClamAV (clamd).
 *
 * Протокол — INSTREAM (RFC-ish, официальная документация ClamAV):
 *
 *   запрос:
 *     zINSTREAM\0
 *     <4-byte BE length><chunk bytes>     ← можно много раз
 *     <4-byte BE length=0>                 ← маркер конца
 *   ответ:
 *     stream: OK\0                          — файл чист
 *     stream: <VirusName> FOUND\0           — найден вирус
 *     stream: <error text>\0                — внутренняя ошибка clamd
 *
 * Пишем собственный клиент: официальный пакет `clamdjs` тянет
 * лишние зависимости, а для INSTREAM достаточно `net.Socket`.
 */

export interface ScanResult {
  /** Файл чистый (не заражён и ошибок нет). */
  clean: boolean;
  /** Имя вируса или текст ошибки, если clean === false. */
  reason?: string;
  /** Сколько миллисекунд длилась проверка. */
  durationMs: number;
  /** Если проверка не выполнялась — почему. */
  skipped?: 'disabled' | 'unavailable';
}

// Настройки берём из окружения (см. config/env.ts в патче ниже)
const HOST = process.env.CLAMAV_HOST ?? 'clamav';
const PORT = Number(process.env.CLAMAV_PORT ?? 3310);
const ENABLED = String(process.env.CLAMAV_ENABLED ?? 'true') === 'true';
const TIMEOUT_MS = Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000);
const CHUNK_SIZE = 64 * 1024;

export class AntivirusService {
  private static availabilityCache: { ok: boolean; until: number } | null = null;

  /**
   * Быстрая проверка доступности clamd.
   * Кешируем результат на 30 секунд, чтобы не дёргать PING на каждый файл.
   */
  static async ping(): Promise<boolean> {
    if (!ENABLED) return false;
    if (
      this.availabilityCache &&
      this.availabilityCache.until > Date.now()
    ) {
      return this.availabilityCache.ok;
    }

    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: HOST, port: PORT });
      const done = (v: boolean) => {
        socket.destroy();
        resolve(v);
      };
      socket.setTimeout(3000);
      socket.once('connect', () => {
        socket.write('zPING\0');
      });
      socket.once('data', (buf) => {
        done(buf.toString().trim() === 'PONG');
      });
      socket.once('error', () => done(false));
      socket.once('timeout', () => done(false));
    });

    this.availabilityCache = { ok, until: Date.now() + 30_000 };
    return ok;
  }

  /**
   * Проверить буфер на вирусы.
   *
   * Если CLAMAV_ENABLED=false — возвращает `skipped: 'disabled'`.
   * Если clamd недоступен — `skipped: 'unavailable'` (fail-open:
   * файл пропускается, но событие логируется).
   *
   * Политику fail-open/fail-closed выбираем сознательно:
   * для CRM ИТ Школы антивирус — критичная часть по ФСТЭК,
   * но полностью блокировать загрузку файлов при падении clamd
   * тоже нельзя (встанет бизнес). Компромисс: пропускаем, но
   * громко логируем и не выдаём фронту `X-AV-Status: clean`.
   */
  static async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    const start = Date.now();

    if (!ENABLED) {
      return { clean: true, durationMs: 0, skipped: 'disabled' };
    }

    const available = await this.ping();
    if (!available) {
      logger.warn(
        { host: HOST, port: PORT },
        'ClamAV недоступен — файл пропущен без проверки',
      );
      return { clean: true, durationMs: 0, skipped: 'unavailable' };
    }

    return new Promise<ScanResult>((resolve) => {
      const socket = net.createConnection({ host: HOST, port: PORT });
      let response = '';
      let settled = false;

      const finish = (result: ScanResult) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      socket.setTimeout(TIMEOUT_MS);

      socket.once('connect', () => {
        // 1) команда
        socket.write('zINSTREAM\0');

        // 2) чанки
        let offset = 0;
        const writeNext = () => {
          if (offset >= buffer.length) {
            // Маркер конца: 4 нулевых байта
            const end = Buffer.alloc(4);
            socket.write(end);
            return;
          }
          const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(chunk.length, 0);
          socket.write(len);
          socket.write(chunk);
          offset += chunk.length;
          // Без setTimeout(0) — синхронно, но с backpressure
          if (socket.writableNeedDrain) {
            socket.once('drain', writeNext);
          } else {
            writeNext();
          }
        };
        writeNext();
      });

      socket.on('data', (buf) => {
        response += buf.toString('utf8');
        // Ответ всегда заканчивается \0
        if (response.includes('\0')) {
          const line = response.split('\0')[0].trim();

          // stream: OK / stream: Virus FOUND / stream: <error>
          const m = line.match(/^stream:\s*(.*)$/i);
          const payload = m ? m[1].trim() : line;

          if (/^OK$/i.test(payload)) {
            finish({ clean: true, durationMs: Date.now() - start });
          } else if (/FOUND$/i.test(payload)) {
            finish({
              clean: false,
              reason: payload.replace(/\s*FOUND$/i, '').trim() || 'virus',
              durationMs: Date.now() - start,
            });
          } else {
            logger.warn({ line }, 'ClamAV вернул неожиданный ответ');
            finish({
              clean: true,
              durationMs: Date.now() - start,
              skipped: 'unavailable',
            });
          }
        }
      });

      socket.once('error', (err) => {
        logger.warn({ err: err.message }, 'ClamAV socket error');
        finish({
          clean: true,
          durationMs: Date.now() - start,
          skipped: 'unavailable',
        });
      });

      socket.once('timeout', () => {
        logger.warn({ ms: TIMEOUT_MS }, 'ClamAV timeout');
        finish({
          clean: true,
          durationMs: Date.now() - start,
          skipped: 'unavailable',
        });
      });
    });
  }
}