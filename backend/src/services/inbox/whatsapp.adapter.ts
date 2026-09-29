import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  IntegrationAdapter,
  OutgoingMessage,
  SendResult,
  ParsedIncoming,
} from './types.js';
import { logger } from '../../config/logger.js';

interface WhatsAppConfig {
  provider?: 'meta' | 'twilio' | '360dialog';
  phone_number_id?: string;
  access_token?: string;
  business_phone?: string;
  webhook_verify_token?: string;
}

export class WhatsAppAdapter implements IntegrationAdapter {
  constructor(private config: WhatsAppConfig) {}

  // ============================================================
  // Send
  // ============================================================
  async send(msg: OutgoingMessage): Promise<SendResult> {
    const provider = this.config.provider ?? 'meta';

    try {
      if (provider === 'meta') {
        if (!this.config.phone_number_id || !this.config.access_token) {
          return { ok: false, error: 'phone_number_id / access_token не заданы' };
        }
        const url = `https://graph.facebook.com/v20.0/${this.config.phone_number_id}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: msg.to.replace(/\D/g, ''),
            type: 'text',
            text: { body: msg.body },
          }),
        });
        const data = (await res.json()) as {
          messages?: { id: string }[];
          error?: { message: string };
        };
        if (!res.ok) return { ok: false, error: data.error?.message ?? 'WhatsApp error' };
        return { ok: true, externalId: data.messages?.[0]?.id };
      }

      return { ok: false, error: `Провайдер ${provider} ещё не реализован` };
    } catch (e) {
      logger.error({ err: e }, 'WhatsAppAdapter.send failed');
      return { ok: false, error: e instanceof Error ? e.message : 'WhatsApp error' };
    }
  }

  // ============================================================
  // Test
  // ============================================================
  async test(): Promise<{ ok: boolean; error?: string; info?: string }> {
    if (!this.config.access_token) return { ok: false, error: 'access_token не задан' };
    try {
      const url = `https://graph.facebook.com/v20.0/${this.config.phone_number_id}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.access_token}` },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true, info: 'WhatsApp Business API доступен' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'WhatsApp error' };
    }
  }

  // ============================================================
  // Signature verification (Meta)
  //
  // Meta присылает заголовок X-Hub-Signature-256:
  //   X-Hub-Signature-256: sha256=<hex>
  // Считаем HMAC-SHA256 от RAW body с WHATSAPP_APP_SECRET
  // и сравниваем константным временем.
  // ============================================================
  private verifySignature(
  rawBody: Buffer | undefined,
  sigHeader: string | undefined,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  // В проде без секрета — отклоняем (fail-closed)
  if (!secret) {
    if (isProd) {
      logger.error(
        'WHATSAPP_APP_SECRET не задан в production — webhook отклонён',
      );
      return false;
    }
    logger.warn(
      'WHATSAPP_APP_SECRET не задан (dev) — пропускаем проверку подписи',
    );
    return true;
  }

  if (!sigHeader?.startsWith('sha256=')) return false;
  if (!rawBody || rawBody.length === 0) return false;

  const provided = sigHeader.slice('sha256='.length);
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  if (expected.length !== provided.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  } catch {
    return false;
  }
}

  // ============================================================
  // Webhook
  // ============================================================
  async handleWebhook(
    body: unknown,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): Promise<{ ok: boolean; messages: ParsedIncoming[] }> {
    // 1. Проверка подписи
    const sigHeader = headers['x-hub-signature-256'];
    if (!this.verifySignature(rawBody, sigHeader)) {
      logger.warn({ hasSig: !!sigHeader, hasRaw: !!rawBody }, 'WhatsApp: подпись невалидна');
      return { ok: false, messages: [] };
    }

    // 2. Разбор полезной нагрузки
    const payload = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              id: string;
              from: string;
              timestamp: string;
              text?: { body: string };
              type: string;
            }>;
            contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
          };
        }>;
      }>;
    };

    const messages: ParsedIncoming[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;
        for (const m of value.messages) {
          const contact = value.contacts?.[0];
          messages.push({
            externalId: m.id,
            fromAddress: m.from,
            fromName: contact?.profile?.name ?? m.from,
            toAddress: this.config.business_phone,
            body: m.text?.body ?? `[${m.type}]`,
            attachments: [],
            raw: m as unknown as Record<string, unknown>,
            receivedAt: new Date(Number(m.timestamp) * 1000),
          });
        }
      }
    }
    return { ok: true, messages };
  }
}