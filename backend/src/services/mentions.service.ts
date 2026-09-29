import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { PushService } from './push.service.js';

/**
 * Парсер @mentions.
 * Формат: @username@domain или @email@domain.
 * Ищем по email или по имени.
 */
export class MentionsService {
  /**
   * Извлекает mention'ы из текста.
   * Возвращает массив email'ов.
   */
  static extractEmails(text: string): string[] {
    // Ищем email-подобные паттерны после @
    const regex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emails: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      emails.push(m[1].toLowerCase());
    }

    // Также ищем @username (без домена)
    const usernameRegex = /@([a-zA-Z0-9._-]{2,})/g;
    while ((m = usernameRegex.exec(text)) !== null) {
      const u = m[1].toLowerCase();
      if (!u.includes('.')) emails.push(u);
    }

    return Array.from(new Set(emails));
  }

  /**
   * Обрабатывает comment, создаёт Mention'ы и уведомления.
   */
  static async processComment(params: {
    commentId: string;
    text: string;
    authorId: string | null;
    authorName: string;
    entity: string;
    entityId: string;
    entityTitle: string;
  }): Promise<void> {
    const tokens = this.extractEmails(params.text);
    if (tokens.length === 0) return;

    // Ищем пользователей
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { email: { in: tokens } },
          // По username — часть email до @
          ...tokens.map((t) => ({ email: { startsWith: `${t}@`, mode: 'insensitive' as const } })),
        ],
        blocked: false,
      },
    });

    if (profiles.length === 0) return;

    for (const p of profiles) {
      // Не уведомляем автора
      if (p.id === params.authorId) continue;

      try {
        await prisma.mention.upsert({
          where: { commentId_mentionedId: { commentId: params.commentId, mentionedId: p.id } },
          update: {},
          create: { commentId: params.commentId, mentionedId: p.id },
        });

        // In-app уведомление
        await prisma.notification.create({
          data: {
            userId: p.id,
            type: 'mention',
            title: `${params.authorName} упомянул вас`,
            body: params.text.slice(0, 200),
            entity: params.entity,
            entityId: params.entityId,
            actionUrl: `/${params.entity}/${params.entityId}`,
          },
        });

        // Push
        await PushService.send(p.id, {
          title: `${params.authorName} упомянул вас`,
          body: params.text.slice(0, 100),
          url: `/${params.entity}/${params.entityId}`,
          tag: `mention-${params.commentId}`,
        });
      } catch (e) {
        logger.warn({ err: e, profileId: p.id }, 'mention failed');
      }
    }
  }

  /**
   * Список упоминаний пользователя.
   */
  static async listForUser(userId: string, onlyUnread = false) {
    return prisma.mention.findMany({
      where: {
        mentionedId: userId,
        ...(onlyUnread ? { read: false } : {}),
      },
      orderBy: { mentionedAt: 'desc' },
      take: 100,
    });
  }

  static async markRead(userId: string, mentionIds?: number[]) {
    await prisma.mention.updateMany({
      where: {
        mentionedId: userId,
        ...(mentionIds ? { id: { in: mentionIds } } : {}),
      },
      data: { read: true },
    });
  }
}