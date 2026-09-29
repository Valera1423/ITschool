import type { Segment, SegmentRule, University, Interaction, Task } from '@/types';
import { api } from './api';
import { daysUntil } from './utils';
import { colorClasses } from './colors';

/**
 * Сегменты — «умные» группы вузов.
 *
 * ⚠️ С Спринта 2 цвета сегментов берутся из lib/colors.ts.
 */

export const SEGMENT_FIELDS: {
  value: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'bool' | 'enum' | 'computed';
}[] = [
  { value: 'name', label: 'Название', type: 'text' },
  { value: 'city', label: 'Город', type: 'text' },
  { value: 'direction', label: 'Направление', type: 'text' },
  { value: 'product', label: 'Продукт', type: 'text' },
  { value: 'status', label: 'Статус', type: 'enum' },
  { value: 'manager', label: 'Менеджер', type: 'text' },
  { value: 'license_signed', label: 'Лицензия подписана', type: 'bool' },
  { value: 'contract_value', label: 'Сумма контракта', type: 'number' },
  { value: 'license_days_left', label: 'Дней до истечения лицензии', type: 'computed' },
  { value: 'last_touch_days', label: 'Дней без касаний', type: 'computed' },
  { value: 'interactions_count', label: 'Всего касаний', type: 'computed' },
  { value: 'open_tasks_count', label: 'Открытых задач', type: 'computed' },
  { value: 'has_email', label: 'Есть email', type: 'computed' },
  { value: 'has_phone', label: 'Есть телефон', type: 'computed' },
  { value: 'has_tags', label: 'Есть теги', type: 'computed' },
];

export const SEGMENT_OPERATORS: Record<
  string,
  { value: string; label: string }[]
> = {
  text: [
    { value: 'equals', label: 'равно' },
    { value: 'not_equals', label: 'не равно' },
    { value: 'contains', label: 'содержит' },
    { value: 'empty', label: 'пусто' },
    { value: 'not_empty', label: 'не пусто' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'greater', label: '>' },
    { value: 'less', label: '<' },
  ],
  date: [
    { value: 'greater', label: 'позже' },
    { value: 'less', label: 'раньше' },
  ],
  bool: [{ value: 'equals', label: 'равно' }],
  enum: [
    { value: 'equals', label: 'равно' },
    { value: 'not_equals', label: 'не равно' },
    { value: 'in', label: 'в списке' },
    { value: 'not_in', label: 'не в списке' },
  ],
  computed: [
    { value: 'equals', label: '=' },
    { value: 'greater', label: '>' },
    { value: 'less', label: '<' },
  ],
};

// ============================================================
// CRUD
// ============================================================

export async function listSegments(_userId: string | null): Promise<Segment[]> {
  try {
    return await api.get<Segment[]>('/segments');
  } catch {
    return [];
  }
}

export async function createSegment(input: {
  name: string;
  description?: string;
  rules: SegmentRule[];
  logic: 'AND' | 'OR';
  color?: string;
  shared?: boolean;
}): Promise<Segment | null> {
  try {
    return await api.post<Segment>('/segments', {
      name: input.name.trim(),
      description: input.description ?? null,
      entity: 'universities',
      rules: input.rules,
      logic: input.logic,
      color: input.color ?? 'sky',
      shared: input.shared ?? false,
    });
  } catch {
    return null;
  }
}

export async function updateSegment(
  id: string,
  patch: Partial<Segment>,
): Promise<string | null> {
  try {
    await api.patch(`/segments/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteSegment(id: string): Promise<string | null> {
  try {
    await api.delete(`/segments/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// ДВИЖОК СЕГМЕНТАЦИИ (локальная оценка для UI)
// ============================================================

interface ComputeContext {
  university: University;
  interactions: Interaction[];
  tasks: Task[];
  tagsCount: number;
}

function computeField(field: string, ctx: ComputeContext): unknown {
  const u = ctx.university;
  switch (field) {
    case 'license_days_left':
      return u.license_expires_at ? daysUntil(u.license_expires_at) : null;
    case 'last_touch_days': {
      const last = ctx.interactions
        .filter((i) => i.university_id === u.id)
        .map((i) => new Date(i.interaction_date).getTime())
        .sort((a, b) => b - a)[0];
      return last ? Math.round((Date.now() - last) / 86400000) : 999;
    }
    case 'interactions_count':
      return ctx.interactions.filter((i) => i.university_id === u.id).length;
    case 'open_tasks_count':
      return ctx.tasks.filter(
        (t) => t.university_id === u.id && t.status !== 'Готово' && t.status !== 'Отменено',
      ).length;
    case 'has_email':
      return !!(u.contact_email);
    case 'has_phone':
      return !!(u.contact_phone);
    case 'has_tags':
      return ctx.tagsCount > 0;
    default: {
      const v = (u as unknown as Record<string, unknown>)[field];
      return v ?? null;
    }
  }
}

function matchesRule(value: unknown, rule: SegmentRule): boolean {
  const { operator, value: ruleValue } = rule;
  switch (operator) {
    case 'equals':
      if (typeof value === 'boolean' || typeof ruleValue === 'boolean') {
        return Boolean(value) === Boolean(ruleValue);
      }
      return String(value) === String(ruleValue);
    case 'not_equals':
      return String(value) !== String(ruleValue);
    case 'greater':
      return Number(value) > Number(ruleValue);
    case 'less':
      return Number(value) < Number(ruleValue);
    case 'contains':
      return String(value ?? '').toLowerCase().includes(String(ruleValue ?? '').toLowerCase());
    case 'empty':
      return value === null || value === undefined || value === '';
    case 'not_empty':
      return value !== null && value !== undefined && value !== '';
    case 'in':
      return Array.isArray(ruleValue) && (ruleValue as unknown[]).map(String).includes(String(value));
    case 'not_in':
      return Array.isArray(ruleValue) && !(ruleValue as unknown[]).map(String).includes(String(value));
    default:
      return true;
  }
}

/**
 * Применить сегмент локально — для превью без обращения к БД.
 */
export function evaluateSegment(
  segment: Segment,
  universities: University[],
  interactions: Interaction[],
  tasks: Task[],
  tagsByUniversity: Record<string, string[]>,
): University[] {
  const rules = segment.rules ?? [];
  if (rules.length === 0) return universities;

  return universities.filter((u) => {
    const ctx: ComputeContext = {
      university: u,
      interactions,
      tasks,
      tagsCount: (tagsByUniversity[u.id] ?? []).length,
    };
    const results = rules.map((r) => matchesRule(computeField(r.field, ctx), r));
    return segment.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  });
}

// ============================================================
// ЦВЕТА И ОПИСАНИЯ
// ============================================================

/**
 * @deprecated Спринт 2: используйте colorClasses() из lib/colors.ts
 */
export function segmentColor(color: string | null) {
  return colorClasses(color ?? 'sky');
}

export function describeRule(rule: SegmentRule): string {
  const field = SEGMENT_FIELDS.find((f) => f.value === rule.field)?.label ?? rule.field;
  const op =
    Object.values(SEGMENT_OPERATORS).flat().find((o) => o.value === rule.operator)?.label ??
    rule.operator;
  if (rule.operator === 'empty') return `«${field}» пусто`;
  if (rule.operator === 'not_empty') return `«${field}» заполнено`;
  const v = Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value ?? '');
  return `«${field}» ${op} ${v}`;
}

export async function evaluateSegmentBackend(segmentId: string): Promise<University[]> {
  try {
    const res = await api.get<{ items: University[] } | University[]>(
      `/segments/${segmentId}/evaluate?pageSize=500`,
    );
    if (Array.isArray(res)) return res;
    return (res as { items: University[] }).items ?? [];
  } catch {
    return [];
  }
}

export async function evaluateInline(
  rules: SegmentRule[],
  logic: 'AND' | 'OR',
): Promise<University[]> {
  try {
    const res = await api.post<{ items: University[] }>('/segments/evaluate-inline', {
      rules,
      logic,
    });
    return res.items ?? [];
  } catch {
    return [];
  }
}