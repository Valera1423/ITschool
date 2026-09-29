import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { isPrismaError } from './prisma-errors.js';

type TxFn<T> = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>;

/**
 * Транзакция с автоматическим retry на сериализационных ошибках.
 */
export async function withTransaction<T>(
  fn: TxFn<T>,
  opts: { retries?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  let attempt = 0;

  while (true) {
    try {
      return await prisma.$transaction(fn, {
        timeout: 15_000,
        maxWait: 10_000,
      });
    } catch (e) {
      attempt++;
      if (isPrismaError(e) && e.code === 'P2034' && attempt < retries) {
        logger.warn({ attempt }, 'Транзакция откатилась, повторяем');
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw e;
    }
  }
}