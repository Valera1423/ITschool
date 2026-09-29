import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';
import { InboxService } from './inbox.service.js';

export class ImapPoller {
  static async poll(integrationId: string): Promise<number> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) return 0;

    const config = (integration.config ?? {}) as Record<string, unknown>;
    const host = String(config.imap_host ?? '');
    const port = Number(config.imap_port ?? 993);
    const secure = config.imap_secure !== false;
    const user = String(config.imap_user ?? '');
    const password = String(config.imap_password ?? '');
    const folder = String(config.imap_folder ?? 'INBOX');

    if (!host || !user) return 0;

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass: password },
      logger: false,
    });

    let processed = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);

      try {
        for await (const msg of client.fetch(
          { seen: false },
          { source: true, uid: true, envelope: true },
        )) {
          try {
            const parsed = await simpleParser(msg.source as Buffer);

            // Используем Message-ID, если есть — он стабилен между сессиями IMAP.
            // Fallback — UID с префиксом папки (менее надёжно, но лучше чем ничего).
            const messageId = parsed.messageId ?? `${folder}:${msg.uid}`;
            const externalId = messageId;

            const existing = await prisma.inboxMessage.findFirst({
              where: { externalId, integrationId },
            });
            if (existing) {
              // Уже обработано — помечаем прочитанным и идём дальше
              await client
                .messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
                .catch(() => {});
              continue;
            }

            // mailparser возвращает AddressObject | AddressObject[]
            const toAddr = (() => {
              if (!parsed.to) return undefined;
              if (Array.isArray(parsed.to)) {
                return parsed.to[0]?.value?.[0]?.address ?? undefined;
              }
              return parsed.to.value?.[0]?.address ?? undefined;
            })();

            await InboxService.ingest(
              integrationId,
              {
                externalId,
                fromAddress: parsed.from?.value?.[0]?.address ?? '',
                fromName: parsed.from?.value?.[0]?.name,
                toAddress: toAddr,
                subject: parsed.subject ?? undefined,
                body: parsed.text ?? parsed.html?.toString() ?? '',
                attachments: [],
                raw: { uid: msg.uid, folder, messageId } as Record<string, unknown>,
                receivedAt: parsed.date ?? new Date(),
              },
              'email',
            );
            processed++;

            await client
              .messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
              .catch(() => {});
          } catch (e) {
            logger.warn({ err: e, uid: msg.uid }, 'Не удалось обработать письмо');
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {
        /* ignore */
      });
    }

    if (processed > 0) {
      logger.info({ integrationId, processed }, 'IMAP poll: обработано писем');
    }
    return processed;
  }
}