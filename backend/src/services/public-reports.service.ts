import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/codes.js';
import { AnalyticsService } from './analytics.service.js';
import { UniversitiesService } from './universities.service.js';

const SCRYPT_KEYLEN = 64;

// ============================================================
// scrypt-хэш: salt$hash (hex)
// ============================================================
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

export class PublicReportsService {
  static async create(params: {
    reportType: string;
    params: Record<string, unknown>;
    userId: string;
    expiresInDays?: number;
    password?: string;
  }) {
    const token = randomBytes(24).toString('base64url');
    const passwordHash = params.password ? hashPassword(params.password) : null;

    const link = await prisma.publicReportLink.create({
      data: {
        token,
        reportType: params.reportType,
        params: params.params as never,
        createdBy: params.userId,
        expiresAt: params.expiresInDays
          ? new Date(Date.now() + params.expiresInDays * 86400000)
          : null,
        password: passwordHash,
      },
    });

    return { id: link.id, token: link.token, url: `${env.APP_URL}/public/${link.token}` };
  }

  static async get(token: string, password?: string) {
    const link = await prisma.publicReportLink.findUnique({ where: { token } });
    if (!link) throw new AppError('NOT_FOUND', 404);
    if (link.revokedAt) throw new AppError('FORBIDDEN', 403, { reason: 'Ссылка отозвана' });
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new AppError('FORBIDDEN', 403, { reason: 'Ссылка истекла' });
    }

    if (link.password) {
      if (!password) throw new AppError('UNAUTHORIZED', 401, { reason: 'Требуется пароль' });
      if (!verifyPassword(password, link.password)) {
        throw new AppError('UNAUTHORIZED', 401, { reason: 'Неверный пароль' });
      }
    }

    // Статистика — «fire & forget»
    void prisma.publicReportLink
      .update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 }, lastViewAt: new Date() },
      })
      .catch(() => {});

    const params = (link.params ?? {}) as Record<string, unknown>;

    switch (link.reportType) {
      case 'universities': {
        const { items, total } = await UniversitiesService.list({
          skip: 0,
          take: 500,
          ...params,
        } as never);
        return { type: 'universities', items, total, params };
      }
      case 'abc-xyz': {
        const r = await AnalyticsService.abcXyz(
          params.from as string | undefined,
          params.to as string | undefined,
        );
        return { type: 'abc-xyz', ...r, params };
      }
      case 'rfm': {
        const r = await AnalyticsService.rfm();
        return { type: 'rfm', items: r, params };
      }
      case 'period-comparison': {
        const r = await AnalyticsService.periodComparison({
          from: params.from as string,
          to: params.to as string,
          prevFrom: params.prevFrom as string,
          prevTo: params.prevTo as string,
        });
        return { type: 'period-comparison', items: r, params };
      }
      default:
        throw new AppError('VALIDATION_FAILED', 400, {
          reason: `Неизвестный тип: ${link.reportType}`,
        });
    }
  }

  static async listByUser(userId: string) {
    return prisma.publicReportLink.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async revoke(id: string, userId: string) {
    const link = await prisma.publicReportLink.findUnique({ where: { id } });
    if (!link) throw new AppError('NOT_FOUND', 404);
    if (link.createdBy !== userId) throw new AppError('FORBIDDEN', 403);

    await prisma.publicReportLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}