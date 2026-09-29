import type { IntegrationAdapter, OutgoingMessage, SendResult } from './types.js';
import { logger } from '../../config/logger.js';

interface SmsConfig {
  provider?: 'smsc' | 'smsaero' | 'generic';
  api_url?: string;
  login?: string;
  password?: string;
  api_key?: string;
  sender?: string;
}

export class SmsAdapter implements IntegrationAdapter {
  constructor(private config: SmsConfig) {}

  async send(msg: OutgoingMessage): Promise<SendResult> {
    try {
      const provider = this.config.provider ?? 'smsc';
      if (provider === 'smsc') {
        const url = new URL('https://smsc.ru/sys/send.php');
        url.searchParams.set('login', this.config.login ?? '');
        url.searchParams.set('psw', this.config.password ?? '');
        url.searchParams.set('phones', msg.to.replace(/\D/g, ''));
        url.searchParams.set('mes', msg.body);
        url.searchParams.set('sender', this.config.sender ?? '');
        url.searchParams.set('fmt', '3');

        const res = await fetch(url);
        const data = await res.json() as { id?: number; error?: string; error_code?: number };
        if (data.error) return { ok: false, error: data.error };
        return { ok: true, externalId: String(data.id) };
      }
      return { ok: false, error: `Провайдер ${provider} не поддержан` };
    } catch (e) {
      logger.error({ err: e }, 'SmsAdapter.send failed');
      return { ok: false, error: e instanceof Error ? e.message : 'SMS error' };
    }
  }

  async test(): Promise<{ ok: boolean; error?: string; info?: string }> {
    if (!this.config.login || !this.config.password) {
      return { ok: false, error: 'login/password не заданы' };
    }
    return { ok: true, info: 'SMS-провайдер настроен (проверка при отправке)' };
  }
}