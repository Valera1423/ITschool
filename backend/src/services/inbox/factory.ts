import type { IntegrationAdapter } from './types.js';
import { EmailAdapter } from './email.adapter.js';
import { TelegramAdapter } from './telegram.adapter.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { SmsAdapter } from './sms.adapter.js';
import { PbxAdapter } from './pbx.adapter.js';

export function createAdapter(type: string, config: Record<string, unknown>): IntegrationAdapter {
  switch (type) {
    case 'email':
      return new EmailAdapter(config);
    case 'telegram':
      return new TelegramAdapter(config);
    case 'whatsapp':
      return new WhatsAppAdapter(config);
    case 'sms':
      return new SmsAdapter(config);
    case 'pbx':
      return new PbxAdapter(config);
    default:
      throw new Error(`Неизвестный тип интеграции: ${type}`);
  }
}