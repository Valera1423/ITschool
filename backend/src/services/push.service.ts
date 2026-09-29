import webpush from 'web-push';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

const CONCURRENCY = 10;
const PER_PUSH_TIMEOUT_MS = 10_000;

export class PushService {
  private static initialized = false;
  private static available = false;

  private static init(): boolean {
    if (this.initialized) return this.available;

    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subj = process.env.VAPID_SUBJECT ?? 'mailto:admin@rt.ru';

    if (!pub || !priv) {
      logger.warn('VAPID keys не заданы — Web Push отключён');
      this.initialized = true;
      this.available = false;
      return false;
    }

    webpush.setVapidDetails(subj, pub, priv);
    this.initialized = true;
    this.available = true;
    return true;
  }

  /**
   * Отправить push конкретному пользователю.
   *
   * userId === null означает «системное уведомление без получателя» —
   * такие НЕ рассылаем всем, а тихо игнорируем. Иначе cron/automation
   * спамят всю команду.
   */
  static async send(userId: string | null, payload: PushPayload): Promise<number> {
    if (!this.init()) return 0;

    if (!userId) {
      logger.debug(
        { title: payload.title },
        'PushService.send: userId=null — пропускаем (нужен явный получатель)',
      );
      return 0;
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subs.length === 0) return 0;

    let sent = 0;
    const dead: string[] = [];

    for (let i = 0; i < subs.length; i += CONCURRENCY) {
      const batch = subs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((sub) => this.sendOne(sub, payload)),
      );

      for (const r of results) {
        if (r.status === 'sent') sent++;
        else if (r.status === 'dead') dead.push(r.id);
      }
    }

    if (dead.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
      logger.info({ removed: dead.length }, 'Удалены мёртвые push-подписки');
    }

    return sent;
  }

  private static async sendOne(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<{ status: 'sent' | 'dead' | 'error'; id: string }> {
    try {
      // web-push не умеет timeout сам — используем Promise.race.
      // Underlying операция не отменяется, но цикл не блокируется.
      await Promise.race([
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body ?? '',
            url: payload.url ?? '/',
            tag: payload.tag ?? `crm-${Date.now()}`,
            data: payload.data,
          }),
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('web-push timeout')),
            PER_PUSH_TIMEOUT_MS,
          ),
        ),
      ]);
      return { status: 'sent', id: sub.id };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        return { status: 'dead', id: sub.id };
      }
      logger.warn({ err: e, subId: sub.id }, 'Push не отправлен');
      return { status: 'error', id: sub.id };
    }
  }

  static async sendToRole(role: string, payload: PushPayload): Promise<number> {
    if (!this.init()) return 0;

    const profiles = await prisma.profile.findMany({
      where: { role, blocked: false },
      select: { id: true },
    });

    let total = 0;
    for (const p of profiles) {
      total += await this.send(p.id, payload);
    }
    return total;
  }
}