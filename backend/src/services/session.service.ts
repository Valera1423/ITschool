// backend/src/services/session.service.ts
import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

/**
 * Управление сессиями пользователей.
 *
 * Модель:
 *   - Одна строка UserSession = одна активная сессия браузера.
 *   - Хранится хеш access_token (SHA-256), не сам токен.
 *   - lastActiveAt обновляется при запросах, но с троттлингом:
 *     не чаще одного раза в 60 секунд, чтобы не долбить БД.
 *   - Ротация: при silent renew (клиент обновляет access_token)
 *     старый хеш revoke-ится, создаётся новый с тем же IP/UA.
 *   - Idle timeout: если lastActiveAt старше IDLE_TIMEOUT_MIN → сессия
 *     помечается revoked с причиной 'idle_timeout'.
 */

const IDLE_TIMEOUT_MIN = Number(process.env.SESSION_IDLE_MIN ?? 30);
const ABSOLUTE_TIMEOUT_HOURS = Number(process.env.SESSION_ABSOLUTE_HOURS ?? 10);
const ACTIVITY_THROTTLE_SEC = 60;

export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
}

export class SessionService {
  /** SHA-256 hash от access_token. */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Обеспечить наличие записи сессии в БД.
   *
   * Вызывается при каждом запросе из middleware. Если строки ещё нет
   * (первый запрос после логина) — создаёт. Если есть — обновляет
   * lastActiveAt (с троттлингом).
   */
  static async ensureAndTouch(input: {
    userId: string;
    token: string;
    ctx: SessionContext;
  }): Promise<void> {
    const tokenHash = this.hashToken(input.token);

    const now = new Date();
    const absoluteExpiry = new Date(
      now.getTime() + ABSOLUTE_TIMEOUT_HOURS * 3600_000,
    );

    try {
      const existing = await prisma.userSession.findUnique({
        where: { tokenHash },
      });

      if (!existing) {
        // Первый раз видим этот access_token — создаём сессию
        await prisma.userSession.create({
          data: {
            userId: input.userId,
            tokenHash,
            ip: input.ctx.ip ?? null,
            userAgent: input.ctx.userAgent ?? null,
            deviceLabel: this.detectDevice(input.ctx.userAgent ?? ''),
            lastActiveAt: now,
            expiresAt: absoluteExpiry,
          },
        });
        return;
      }

      // Idle / absolute timeout
      if (
        existing.revoked ||
        existing.expiresAt < now ||
        now.getTime() - existing.lastActiveAt.getTime() >
          IDLE_TIMEOUT_MIN * 60_000
      ) {
        if (!existing.revoked) {
          await prisma.userSession.update({
            where: { id: existing.id },
            data: {
              revoked: true,
              revokedAt: now,
              revokedReason:
                existing.expiresAt < now ? 'absolute_timeout' : 'idle_timeout',
            },
          });
          logger.info(
            {
              sessionId: existing.id,
              userId: existing.userId,
              reason: existing.expiresAt < now ? 'absolute_timeout' : 'idle_timeout',
            },
            'Сессия закрыта',
          );
        }
        return;
      }

      // Троттлинг: обновляем lastActiveAt не чаще раза в минуту
      if (now.getTime() - existing.lastActiveAt.getTime() > ACTIVITY_THROTTLE_SEC * 1000) {
        await prisma.userSession.update({
          where: { id: existing.id },
          data: { lastActiveAt: now },
        });
      }
    } catch (e) {
      // Никогда не падаем из-за сессий
      logger.warn({ err: e }, 'ensureAndTouch failed');
    }
  }

  /**
   * Ротация токена при silent renew.
   *
   * Клиент после успешного обновления access_token вызывает
   * POST /auth/sessions/rotate со старым и новым токенами.
   * Старый → revoked('rotated'), новый → новая строка с той же
   * сессией (тот же IP/UA).
   */
  static async rotate(input: {
    oldToken: string;
    newToken: string;
    userId: string;
    ctx: SessionContext;
  }): Promise<void> {
    const oldHash = this.hashToken(input.oldToken);
    const newHash = this.hashToken(input.newToken);
    const now = new Date();

    try {
      const old = await prisma.userSession.findUnique({
        where: { tokenHash: oldHash },
      });

      if (!old) {
        // Старой записи нет — просто создаём новую
        await this.ensureAndTouch({
          userId: input.userId,
          token: input.newToken,
          ctx: input.ctx,
        });
        return;
      }

      await prisma.$transaction([
        prisma.userSession.update({
          where: { id: old.id },
          data: {
            revoked: true,
            revokedAt: now,
            revokedReason: 'rotated',
          },
        }),
        prisma.userSession.create({
          data: {
            userId: input.userId,
            tokenHash: newHash,
            ip: input.ctx.ip ?? old.ip,
            userAgent: input.ctx.userAgent ?? old.userAgent,
            deviceLabel: old.deviceLabel,
            lastActiveAt: now,
            expiresAt: new Date(
              now.getTime() + ABSOLUTE_TIMEOUT_HOURS * 3600_000,
            ),
          },
        }),
      ]);
    } catch (e) {
      logger.warn({ err: e }, 'rotate session failed');
    }
  }

  /** Отозвать сессию по id (проверяя владельца). */
  static async revoke(id: string, userId: string, reason = 'user_revoked'): Promise<boolean> {
    const existing = await prisma.userSession.findFirst({
      where: { id, userId },
      select: { id: true, revoked: true },
    });
    if (!existing) return false;
    if (existing.revoked) return true;

    await prisma.userSession.update({
      where: { id },
      data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
    });
    return true;
  }

  /** Отозвать все сессии пользователя, кроме текущей. */
  static async revokeAllExcept(
    userId: string,
    exceptToken: string | null,
    reason = 'user_revoked_all',
  ): Promise<number> {
    const exceptHash = exceptToken ? this.hashToken(exceptToken) : null;

    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        revoked: false,
        ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
      },
      data: { revoked: true, revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  /** Cron: пометить сессии, которые превысили idle/absolute timeout. */
  static async expireStale(): Promise<{ idle: number; absolute: number }> {
    const now = new Date();
    const idleThreshold = new Date(
      now.getTime() - IDLE_TIMEOUT_MIN * 60_000,
    );

    const idle = await prisma.userSession.updateMany({
      where: {
        revoked: false,
        lastActiveAt: { lt: idleThreshold },
        expiresAt: { gt: now },
      },
      data: {
        revoked: true,
        revokedAt: now,
        revokedReason: 'idle_timeout',
      },
    });

    const absolute = await prisma.userSession.updateMany({
      where: {
        revoked: false,
        expiresAt: { lt: now },
      },
      data: {
        revoked: true,
        revokedAt: now,
        revokedReason: 'absolute_timeout',
      },
    });

    return { idle: idle.count, absolute: absolute.count };
  }

  /** Простая эвристика для отображения устройства. */
  private static detectDevice(ua: string): string | null {
    if (!ua) return null;
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Macintosh|Mac OS/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return null;
  }
}