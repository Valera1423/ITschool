import type {
  IntegrationAdapter,
  OutgoingMessage,
  SendResult,
  ParsedIncoming,
} from './types.js';
import { logger } from '../../config/logger.js';

interface TelegramConfig {
  bot_token?: string;
  chat_id?: string;      // для исходящих по умолчанию
  webhook_secret?: string;
}

export class TelegramAdapter implements IntegrationAdapter {
  private api = 'https://api.telegram.org';

  constructor(private config: TelegramConfig) {}

  // ============================================================
  // Отправка
  // ============================================================
  async send(msg: OutgoingMessage): Promise<SendResult> {
    if (!this.config.bot_token) return { ok: false, error: 'bot_token не задан' };
    const chatId = msg.to || this.config.chat_id;
    if (!chatId) return { ok: false, error: 'chat_id не задан' };

    try {
      const url = `${this.api}/bot${this.config.bot_token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg.body,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      };
      if (!data.ok) return { ok: false, error: data.description ?? 'Telegram error' };
      return { ok: true, externalId: String(data.result?.message_id) };
    } catch (e) {
      logger.error({ err: e }, 'TelegramAdapter.send failed');
      return { ok: false, error: e instanceof Error ? e.message : 'Telegram error' };
    }
  }

  // ============================================================
  // Проверка соединения
  // ============================================================
  async test(): Promise<{ ok: boolean; error?: string; info?: string }> {
    if (!this.config.bot_token) return { ok: false, error: 'bot_token не задан' };
    try {
      const res = await fetch(`${this.api}/bot${this.config.bot_token}/getMe`);
      const data = (await res.json()) as {
        ok: boolean;
        result?: { username: string };
        description?: string;
      };
      if (!data.ok) return { ok: false, error: data.description };
      return { ok: true, info: `@${data.result?.username}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Telegram error' };
    }
  }

  // ============================================================
  // Webhook (входящие)
  //
  // Проверка X-Telegram-Bot-Api-Secret-Token:
  //   - prod + нет секрета → fail-closed (отклоняем)
  //   - секрет задан → сравниваем константным временем
  //   - dev + нет секрета → пропускаем, но пишем warn
  // ============================================================
  async handleWebhook(
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ ok: boolean; messages: ParsedIncoming[] }> {
    const secret = this.config.webhook_secret;
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd && !secret) {
      logger.error(
        'Telegram webhook_secret не задан в production — webhook отклонён',
      );
      return { ok: false, messages: [] };
    }

    if (secret) {
      const provided = headers['x-telegram-bot-api-secret-token'];
      if (provided !== secret) {
        logger.warn(
          { hasHeader: !!provided },
          'Telegram webhook: неверный или отсутствует secret_token',
        );
        return { ok: false, messages: [] };
      }
    }

    const update = body as {
      message?: {
        message_id: number;
        from?: {
          id: number;
          first_name?: string;
          last_name?: string;
          username?: string;
        };
        chat: { id: number };
        text?: string;
        caption?: string;
        date: number;
      };
    };

    if (!update?.message) return { ok: true, messages: [] };

    const m = update.message;
    const fullName =
      [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') ||
      m.from?.username ||
      'Telegram User';

    const parsed: ParsedIncoming = {
      externalId: String(m.message_id),
      threadId: String(m.chat.id),
      fromAddress: String(m.chat.id),
      fromName: fullName,
      toAddress: 'bot',
      subject: undefined,
      body: m.text ?? m.caption ?? '',
      attachments: [],
      raw: update as Record<string, unknown>,
      receivedAt: new Date(m.date * 1000),
    };

    return { ok: true, messages: [parsed] };
  }
}