// frontend/src/lib/integrations.ts
import type { Integration, IntegrationType } from '@/types';
import { api } from './api';

/**
 * Каталог шаблонов интеграций + проверка соединений.
 * Используется страницей IntegrationsPage.
 */

export interface IntegrationTemplate {
  type: IntegrationType;
  label: string;
  description: string;
  icon: string;
  color: string;
  testMethod: 'HEAD' | 'GET' | 'POST';
  configFields: {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    secret?: boolean;
  }[];
  docsUrl?: string;
}

export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    type: 'custom_api',
    label: 'Свой API',
    description: 'Любой REST endpoint с ключом',
    icon: 'Code2',
    color: 'sky',
    testMethod: 'HEAD',
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://api.example.ru/v1', required: true },
      { key: 'api_key', label: 'API-ключ', placeholder: 'sk_live_...', secret: true },
      { key: 'method', label: 'Метод', placeholder: 'POST' },
      { key: 'header_name', label: 'Имя заголовка', placeholder: 'Authorization' },
    ],
  },
  {
    type: 'pbx',
    label: 'Виртуальная АТС',
    description: 'Mango, Билайн, МТС, Sipuni, Asterisk',
    icon: 'Phone',
    color: 'emerald',
    testMethod: 'GET',
    configFields: [
      { key: 'provider', label: 'Провайдер', placeholder: 'mango / beeline / mts / sipuni', required: true },
      { key: 'endpoint', label: 'API URL', placeholder: 'https://app.mango-office.ru/vpbx', required: true },
      { key: 'api_key', label: 'API-ключ', secret: true, required: true },
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your.app/hooks/pbx' },
      { key: 'extension', label: 'Внутренний номер', placeholder: '101' },
    ],
  },
  {
    type: 'telegram',
    label: 'Telegram Bot',
    description: 'Отправка уведомлений и приём заявок',
    icon: 'Send',
    color: 'sky',
    testMethod: 'GET',
    configFields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: '123:ABC...', secret: true, required: true },
      { key: 'chat_id', label: 'Chat ID', placeholder: '@my_channel', required: true },
      { key: 'parse_mode', label: 'Parse mode', placeholder: 'HTML' },
    ],
    docsUrl: 'https://core.telegram.org/bots/api',
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp Business',
    description: 'Twilio / 360dialog / Meta Cloud API',
    icon: 'MessageCircle',
    color: 'emerald',
    testMethod: 'GET',
    configFields: [
      { key: 'provider', label: 'Провайдер', placeholder: 'twilio / 360dialog / meta', required: true },
      { key: 'phone', label: 'Business-телефон', placeholder: '+7 999 000-00-00', required: true },
      { key: 'api_key', label: 'API-ключ', secret: true, required: true },
      { key: 'webhook_url', label: 'Webhook для входящих' },
    ],
  },
  {
    type: 'max',
    label: 'MAX мессенджер',
    description: 'Национальный мессенджер VK',
    icon: 'Zap',
    color: 'violet',
    testMethod: 'GET',
    configFields: [
      { key: 'bot_token', label: 'Token бота', secret: true },
      { key: 'phone', label: 'Номер аккаунта', placeholder: '+7 999 000-00-00' },
      { key: 'webhook_url', label: 'Webhook' },
    ],
  },
  {
    type: 'email',
    label: 'Email (SMTP)',
    description: 'Корпоративная почта',
    icon: 'Mail',
    color: 'amber',
    testMethod: 'HEAD',
    configFields: [
      { key: 'host', label: 'SMTP-хост', placeholder: 'smtp.yandex.ru', required: true },
      { key: 'port', label: 'Порт', placeholder: '465' },
      { key: 'user', label: 'Пользователь', placeholder: 'crm@rt.ru', required: true },
      { key: 'password', label: 'Пароль', secret: true, required: true },
      { key: 'from_name', label: 'Имя отправителя', placeholder: 'ИТ Школа РТК' },
    ],
  },
  {
    type: 'sms',
    label: 'SMS-шлюз',
    description: 'SMS-уведомления',
    icon: 'MessageSquare',
    color: 'rose',
    testMethod: 'GET',
    configFields: [
      { key: 'provider', label: 'Провайдер', placeholder: 'smsc / smsaero', required: true },
      { key: 'endpoint', label: 'API URL', placeholder: 'https://smsc.ru/sys/send.php' },
      { key: 'login', label: 'Логин', required: true },
      { key: 'password', label: 'Пароль', secret: true, required: true },
      { key: 'sender', label: 'Отправитель', placeholder: 'RTK_SCHOOL' },
    ],
  },
];

export function getTemplate(type: IntegrationType): IntegrationTemplate | undefined {
  return INTEGRATION_TEMPLATES.find((t) => t.type === type);
}

// ============================================================
// ПРОВЕРКА
// ============================================================

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
  details?: string;
}

/**
 * Тест соединения через backend API.
 * Backend делает запрос к внешнему API — не блокируется CORS.
 */
export async function testIntegration(integration: Integration): Promise<TestResult> {
  try {
    const result = await api.post<TestResult>(`/integrations/${integration.id}/test`);
    return result;
  } catch (e) {
    return {
      ok: false,
      latencyMs: 0,
      error: e instanceof Error ? e.message : 'Ошибка',
    };
  }
}

/** Валидация конфигурации — все обязательные поля заполнены? */
export function validateConfig(
  type: IntegrationType,
  config: Record<string, unknown>,
): string[] {
  const tpl = getTemplate(type);
  if (!tpl) return [];
  const errors: string[] = [];
  tpl.configFields.forEach((f) => {
    if (f.required && !config[f.key]) errors.push(`Поле «${f.label}» обязательно`);
  });
  return errors;
}

// ============================================================
// PREVIEW
// ============================================================

export interface PreviewResult {
  ok: boolean;
  url: string;
  httpStatus: number;
  latencyMs: number;
  fetched: number;
  fields: string[];
  sample: unknown[];
  error?: string;
}

export async function previewIntegration(
  integrationId: string,
  endpointId?: string,
  limit = 5,
): Promise<PreviewResult> {
  const params = new URLSearchParams();
  if (endpointId) params.set('endpointId', endpointId);
  params.set('limit', String(limit));

  try {
    return await api.get<PreviewResult>(
      `/integrations/${integrationId}/preview?${params.toString()}`,
    );
  } catch (e) {
    return {
      ok: false,
      url: '',
      httpStatus: 0,
      latencyMs: 0,
      fetched: 0,
      fields: [],
      sample: [],
      error: e instanceof Error ? e.message : 'Ошибка',
    };
  }
}

// ============================================================
// RULES (LMS → workflow)
// ============================================================

export interface IntegrationRule {
  id: string;
  integration_id: string;
  endpoint_id: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  condition: Record<string, unknown>;
  actions: Record<string, unknown>[];
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function listIntegrationRules(
  integrationId: string,
): Promise<IntegrationRule[]> {
  try {
    return await api.get<IntegrationRule[]>(
      `/integrations/${integrationId}/rules`,
    );
  } catch {
    return [];
  }
}

export async function createIntegrationRule(input: {
  integrationId: string;
  name: string;
  description?: string;
  endpointId?: string;
  enabled?: boolean;
  condition: Record<string, unknown>;
  actions: Record<string, unknown>[];
}): Promise<string | null> {
  try {
    await api.post(`/integrations/${input.integrationId}/rules`, {
      name: input.name,
      description: input.description ?? null,
      endpointId: input.endpointId ?? null,
      enabled: input.enabled ?? true,
      condition: input.condition,
      actions: input.actions,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка создания правила';
  }
}

export async function updateIntegrationRule(
  ruleId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    endpointId: string | null;
    enabled: boolean;
    condition: Record<string, unknown>;
    actions: Record<string, unknown>[];
  }>,
): Promise<string | null> {
  try {
    await api.patch(`/integrations/rules/${ruleId}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка обновления правила';
  }
}

export async function deleteIntegrationRule(
  ruleId: string,
): Promise<string | null> {
  try {
    await api.delete(`/integrations/rules/${ruleId}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка удаления правила';
  }
}