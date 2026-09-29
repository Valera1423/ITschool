import type {
  AutomationRule,
  RuleCondition,
  RuleAction,
  ConditionOperator,
} from '@/types';
import { api } from './api';

/**
 * Автоматизация: «если — то».
 *
 * Примеры правил:
 * - «Если статус = Отказ → создать задачу "Узнать причину"»
 * - «Если лицензия истекает через 30 дней → напомнить менеджеру»
 * - «Если новый вуз → назначить ответственного по региону»
 *
 * Движок — на backend (Edge Function automation-runner).
 */

export const TRIGGER_LABELS: Record<string, string> = {
  on_create: 'При создании',
  on_update: 'При изменении',
  on_field_change: 'При смене поля',
  on_date_reached: 'В определённый день',
  on_schedule: 'По расписанию',
};

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'равно' },
  { value: 'not_equals', label: 'не равно' },
  { value: 'contains', label: 'содержит' },
  { value: 'not_contains', label: 'не содержит' },
  { value: 'greater', label: 'больше' },
  { value: 'less', label: 'меньше' },
  { value: 'empty', label: 'пусто' },
  { value: 'not_empty', label: 'не пусто' },
  { value: 'in', label: 'в списке' },
  { value: 'not_in', label: 'не в списке' },
];

export const ACTION_LABELS: Record<string, string> = {
  create_task: 'Создать задачу',
  create_interaction: 'Создать взаимодействие',
  update_field: 'Изменить поле',
  send_notification: 'Отправить уведомление',
  send_email: 'Отправить email',
  send_telegram: 'Отправить в Telegram',
  add_tag: 'Добавить тег',
  remove_tag: 'Снять тег',
  assign_manager: 'Назначить менеджера',
};

export const TRIGGER_FIELDS_BY_ENTITY: Record<
  string,
  { value: string; label: string }[]
> = {
  universities: [
    { value: 'status', label: 'Статус' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'city', label: 'Город' },
    { value: 'direction', label: 'Направление' },
    { value: 'product', label: 'Продукт' },
    { value: 'license_signed', label: 'Лицензия подписана' },
    { value: 'license_expires_at', label: 'Срок лицензии' },
    { value: 'contract_value', label: 'Сумма контракта' },
  ],
  tasks: [
    { value: 'status', label: 'Статус' },
    { value: 'priority', label: 'Приоритет' },
    { value: 'assignee', label: 'Ответственный' },
    { value: 'due_date', label: 'Срок' },
  ],
};

// ============================================================
// CRUD
// ============================================================

export async function listRules(): Promise<AutomationRule[]> {
  try {
    return await api.get<AutomationRule[]>('/automation');
  } catch {
    return [];
  }
}

export async function createRule(input: {
  name: string;
  description?: string;
  trigger_type: AutomationRule['trigger_type'];
  trigger_config: Record<string, unknown>;
  conditions: RuleCondition[];
  actions: RuleAction[];
  entity?: string;
}): Promise<{ data: AutomationRule | null; error: string | null }> {
  try {
    const data = await api.post<AutomationRule>('/automation', {
      name: input.name.trim(),
      description: input.description ?? null,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config,
      conditions: input.conditions,
      actions: input.actions,
      entity: input.entity ?? 'universities',
    });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

export async function updateRule(
  id: string,
  patch: Partial<AutomationRule>,
): Promise<string | null> {
  try {
    await api.patch(`/automation/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteRule(id: string): Promise<string | null> {
  try {
    await api.delete(`/automation/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function toggleRule(id: string, enabled: boolean): Promise<string | null> {
  return updateRule(id, { enabled });
}

/** Ручной запуск правила */
export async function runRuleManually(
  ruleId: string,
  entityId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`/automation/${ruleId}/run`, { entity_id: entityId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

// ============================================================
// ОПИСАНИЯ ДЛЯ UI
// ============================================================

export function describeTrigger(rule: AutomationRule): string {
  if (rule.trigger_type === 'on_field_change') {
    const cfg = rule.trigger_config as { field?: string; to?: string };
    const fieldLabel =
      TRIGGER_FIELDS_BY_ENTITY[rule.entity]?.find((f) => f.value === cfg.field)?.label ??
      cfg.field;
    return `Когда «${fieldLabel}» = «${cfg.to}»`;
  }
  if (rule.trigger_type === 'on_create') return 'При создании записи';
  if (rule.trigger_type === 'on_update') return 'При любом изменении';
  if (rule.trigger_type === 'on_date_reached') {
    const cfg = rule.trigger_config as { field?: string; days_before?: number };
    return `За ${cfg.days_before ?? 0} дн. до «${cfg.field}»`;
  }
  return TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type;
}

export function describeCondition(c: RuleCondition): string {
  const field = c.field;
  const op = CONDITION_OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
  if (c.operator === 'empty') return `«${field}» пусто`;
  if (c.operator === 'not_empty') return `«${field}» заполнено`;
  return `«${field}» ${op} «${Array.isArray(c.value) ? c.value.join(', ') : c.value}»`;
}

export function describeAction(a: RuleAction): string {
  const label = ACTION_LABELS[a.type] ?? a.type;
  const p = a.params as {
    title?: string;
    value?: string;
    field?: string;
    message?: string;
    tag_id?: string;
  };
  if (a.type === 'create_task') return `${label}: «${p.title ?? '—'}»`;
  if (a.type === 'update_field') return `${label}: ${p.field} = ${p.value}`;
  if (a.type === 'send_notification') return `${label}: «${p.message ?? '—'}»`;
  return label;
}

/**
 * Проверка условий локально — для тестового прогона.
 */
export function checkConditions(
  conditions: RuleCondition[],
  data: Record<string, unknown>,
): boolean {
  return conditions.every((c) => {
    const value = data[c.field];
    switch (c.operator) {
      case 'equals': return String(value) === String(c.value);
      case 'not_equals': return String(value) !== String(c.value);
      case 'contains':
        return String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
      case 'not_contains':
        return !String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
      case 'greater': return Number(value) > Number(c.value);
      case 'less': return Number(value) < Number(c.value);
      case 'empty': return value === null || value === undefined || value === '';
      case 'not_empty': return value !== null && value !== undefined && value !== '';
      case 'in':
        return Array.isArray(c.value) && (c.value as unknown[]).map(String).includes(String(value));
      case 'not_in':
        return Array.isArray(c.value) && !(c.value as unknown[]).map(String).includes(String(value));
      default: return true;
    }
  });
}