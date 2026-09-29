import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';
import { createAdapter } from './factory.js';
import type { ParsedIncoming } from './types.js';

export class InboxService {
  static async ingest(
    integrationId: string,
    parsed: ParsedIncoming,
    channel: string,
  ): Promise<void> {
    const university = await this.findUniversity(parsed, channel);

    const message = await prisma.inboxMessage.create({
      data: {
        integrationId,
        channel,
        direction: 'in',
        externalId: parsed.externalId ?? null,
        threadId: parsed.threadId ?? null,
        fromAddress: parsed.fromAddress || 'unknown',
        fromName: parsed.fromName ?? null,
        toAddress: parsed.toAddress ?? null,
        subject: parsed.subject ?? null,
        body: parsed.body ?? '',
        attachments: (parsed.attachments ?? []) as never,
        universityId: university?.id ?? null,
        interactionId: null,
        manager: null,
        receivedAt: parsed.receivedAt ?? new Date(),
        raw: (parsed.raw ?? {}) as never,
      },
    });

    logger.info(
      { id: message.id, channel, from: parsed.fromAddress, universityId: university?.id },
      'Входящее сообщение принято',
    );

    await prisma.notification
      .create({
        data: {
          userId: null,
          type: 'inbox',
          title: `Новое сообщение из ${channelLabel(channel)}`,
          body: (parsed.body ?? '').slice(0, 200),
          entity: 'inbox',
          entityId: message.id,
          actionUrl: '/inbox',
        },
      })
      .catch(() => {});
  }

  static async send(params: {
    integrationId: string;
    to: string;
    toName?: string;
    subject?: string;
    body: string;
    universityId?: string;
    manager?: string;
    channel?: string;
  }) {
    const integration = await prisma.integration.findUnique({
      where: { id: params.integrationId },
    });
    if (!integration) throw new Error('Интеграция не найдена');
    if (integration.status !== 'Активна') throw new Error('Интеграция отключена');

    const adapter = createAdapter(
      integration.type,
      (integration.config ?? {}) as Record<string, unknown>,
    );

    const result = await adapter.send({
      to: params.to,
      toName: params.toName,
      subject: params.subject,
      body: params.body,
    });

    if (!result.ok) throw new Error(result.error ?? 'Ошибка отправки');

    return prisma.inboxMessage.create({
      data: {
        integrationId: params.integrationId,
        channel: params.channel ?? integration.type,
        direction: 'out',
        externalId: result.externalId ?? null,
        threadId: null,
        fromAddress: 'crm',
        fromName: null,
        toAddress: params.to ?? null,
        subject: params.subject ?? null,
        body: params.body,
        attachments: [],
        universityId: params.universityId ?? null,
        interactionId: null,
        manager: params.manager ?? null,
        receivedAt: new Date(),
        raw: {} as never,
      },
    });
  }

  static async handleWebhook(params: {
    integrationId: string;
    body: unknown;
    headers: Record<string, string>;
    rawBody?: Buffer;
  }) {
    const integration = await prisma.integration.findUnique({
      where: { id: params.integrationId },
    });
    if (!integration) throw new Error('Интеграция не найдена');

    const adapter = createAdapter(
      integration.type,
      (integration.config ?? {}) as Record<string, unknown>,
    );

    const log = await prisma.webhookLog.create({
      data: {
        integrationId: params.integrationId,
        provider: integration.type,
        method: 'POST',
        headers: params.headers as never,
        body: params.body as never,
      },
    });

    if (!adapter.handleWebhook) {
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 400,
          error: 'Тип интеграции не принимает webhook',
          processed: true,
        },
      });
      return { ok: false, error: 'not supported', messages: [] as ParsedIncoming[] };
    }

    try {
      const result = await adapter.handleWebhook(
        params.body,
        params.headers,
        params.rawBody,
      );

      for (const parsed of result.messages) {
        await this.ingest(params.integrationId, parsed, integration.type);
      }

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 200, processed: true },
      });

      return { ok: result.ok, count: result.messages.length };
    } catch (e) {
      await prisma.webhookLog
        .update({
          where: { id: log.id },
          data: {
            status: 500,
            error: e instanceof Error ? e.message : 'unknown',
            processed: true,
          },
        })
        .catch(() => {});
      throw e;
    }
  }

  private static async findUniversity(parsed: ParsedIncoming, channel: string) {
    const where: Record<string, unknown>[] = [];

    if (parsed.fromAddress) {
      if (channel === 'email') {
        where.push({ contactEmail: { equals: parsed.fromAddress, mode: 'insensitive' } });
      }
      if (channel === 'telegram') where.push({ telegram: parsed.fromAddress });
      if (channel === 'whatsapp') where.push({ whatsapp: parsed.fromAddress });
      if (channel === 'max') where.push({ maxMessenger: parsed.fromAddress });
      if (channel === 'sms') {
        where.push({
          contactPhone: { contains: parsed.fromAddress.replace(/\D/g, '').slice(-10) },
        });
      }
    }

    if (where.length === 0) return null;

    return prisma.university.findFirst({
      where: { OR: where as never },
      select: { id: true },
    });
  }
}

function channelLabel(ch: string): string {
  return (
    {
      email: 'Email',
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      max: 'MAX',
      sms: 'SMS',
      web: 'Web',
    }[ch] ?? ch
  );
}