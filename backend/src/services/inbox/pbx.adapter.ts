import type { IntegrationAdapter, OutgoingMessage, SendResult, ParsedIncoming } from './types.js';

interface PbxConfig {
  provider?: string;
  webhook_secret?: string;
}

export class PbxAdapter implements IntegrationAdapter {
  constructor(private config: PbxConfig) {}

  async send(): Promise<SendResult> {
    // АТС обычно не принимает исходящие через API — только через веб-интерфейс.
    return { ok: false, error: 'Исходящие через АТС не поддерживаются' };
  }

  async test(): Promise<{ ok: boolean; error?: string; info?: string }> {
    return { ok: true, info: `Провайдер: ${this.config.provider ?? 'unknown'}. Ожидаем webhook'и.` };
  }

  /**
   * Универсальный приём звонков от АТС.
   * Формат разный для каждого провайдера — поддержим самые частые.
   */
  async handleWebhook(body: unknown, headers: Record<string, string>) {
    if (this.config.webhook_secret) {
      const provided = headers['x-webhook-secret'] ?? headers['x-api-key'];
      if (provided !== this.config.webhook_secret) {
        return { ok: false, messages: [] };
      }
    }

    // Mango Office / Beeline / MTS / Sipuni — все присылают JSON с полями
    // phone, direction, duration, recording, call_id.
    const b = body as Record<string, unknown>;
    const from = String(b.from ?? b.phone ?? b.caller ?? '');
    const externalId = String(b.call_id ?? b.id ?? b.uuid ?? '');

    // Звонок обрабатывается отдельным сервисом (см. calls.service.ts),
    // а тут — только возвращаем распарсенные данные.
    return {
      ok: true,
      messages: [], // для звонков не создаём InboxMessage
      callData: {
        externalId,
        fromAddress: from,
        direction: String(b.direction ?? 'Входящий'),
        durationSeconds: Number(b.duration ?? 0),
        recordingUrl: String(b.recording ?? b.record_url ?? ''),
        startedAt: b.start_time ? new Date(String(b.start_time)) : new Date(),
        raw: b,
      },
    };
  }
}