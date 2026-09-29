import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { SmsAdapter } from './inbox/sms.adapter.js';

/**
 * Отправка SMS менеджерам.
 * Использует ту же интеграцию SMS, что и Inbox.
 */
export class SmsService {
  /**
   * Отправить SMS всем подписчикам события.
   */
  static async notifyEvent(params: {
    eventType: string;
    title: string;
    body: string;
    userIds?: string[];
  }): Promise<{ sent: number; failed: number }> {
    const integration = await prisma.integration.findFirst({
      where: { type: 'sms', status: 'Активна', deletedAt: null },
    });
    if (!integration) return { sent: 0, failed: 0 };

    const subscriptions = await prisma.smsSubscription.findMany({
      where: {
        enabled: true,
        ...(params.userIds ? { userId: { in: params.userIds } } : {}),
        eventTypes: { has: params.eventType },
      },
    });

    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const adapter = new SmsAdapter(integration.config as Record<string, unknown>);

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const result = await adapter.send({
          to: sub.phone,
          body: `${params.title}\n\n${params.body}`.slice(0, 480),
        });

        if (result.ok) {
          sent++;
        } else {
          failed++;
          logger.warn({ userId: sub.userId, err: result.error }, 'SMS send failed');
        }
      } catch (e) {
        failed++;
        logger.error({ err: e, userId: sub.userId }, 'SMS error');
      }
    }

    return { sent, failed };
  }

  static async listForUser(userId: string) {
    return prisma.smsSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async upsert(params: {
    userId: string;
    phone: string;
    eventTypes: string[];
    enabled: boolean;
  }) {
    return prisma.smsSubscription.upsert({
      where: { userId_phone: { userId: params.userId, phone: params.phone } },
      update: {
        eventTypes: params.eventTypes,
        enabled: params.enabled,
        updatedAt: new Date(),
      },
      create: {
        userId: params.userId,
        phone: params.phone,
        eventTypes: params.eventTypes,
        enabled: params.enabled,
      },
    });
  }

  static async remove(id: string, userId: string) {
    const sub = await prisma.smsSubscription.findUnique({ where: { id } });
    if (!sub || sub.userId !== userId) return;
    await prisma.smsSubscription.delete({ where: { id } });
  }
}