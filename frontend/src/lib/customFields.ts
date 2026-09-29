import type { CustomField, CustomFieldType, CustomFieldValue } from '@/types';
import { api } from './api';

/**
 * Кастомные поля (по ТЗ «каждая компания хочет свои поля»).
 *
 * Типы: text, number, date, select, multiselect, bool, url, phone, email.
 * Значения хранятся в отдельной таблице custom_field_values
 * (поля типизированы — value_text, value_number, value_date, value_bool, value_json).
 */

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Текст',
  number: 'Число',
  date: 'Дата',
  select: 'Список',
  multiselect: 'Мультисписок',
  bool: 'Да/Нет',
  url: 'Ссылка',
  phone: 'Телефон',
  email: 'Email',
};

// ============================================================
// CRUD
// ============================================================

export async function listCustomFields(
  entity = 'universities',
): Promise<CustomField[]> {
  try {
    return await api.get<CustomField[]>(`/custom-fields?entity=${entity}`);
  } catch {
    return [];
  }
}

export async function createCustomField(input: {
  key: string;
  label: string;
  field_type: CustomFieldType;
  options?: string[];
  help_text?: string;
  required?: boolean;
  show_in_table?: boolean;
  sort_order?: number;
  entity?: string;
}): Promise<{ data: CustomField | null; error: string | null }> {
  try {
    const data = await api.post<CustomField>('/custom-fields', {
      key: input.key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_'),
      label: input.label.trim(),
      field_type: input.field_type,
      options: input.options ?? [],
      help_text: input.help_text ?? null,
      required: input.required ?? false,
      show_in_table: input.show_in_table ?? false,
      sort_order: input.sort_order ?? 100,
      entity: input.entity ?? 'universities',
    });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

export async function updateCustomField(
  id: string,
  patch: Partial<CustomField>,
): Promise<string | null> {
  try {
    await api.patch(`/custom-fields/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteCustomField(id: string): Promise<string | null> {
  try {
    await api.delete(`/custom-fields/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// ЗНАЧЕНИЯ
// ============================================================

/** Значения полей для одной сущности в формате map field_id → value. */
export async function getValuesForEntity(
  entityId: string,
): Promise<Record<string, CustomFieldValue>> {
  try {
    const list = await api.get<CustomFieldValue[]>(
      `/custom-fields/values?entity_id=${entityId}`,
    );
    const map: Record<string, CustomFieldValue> = {};
    list.forEach((v) => {
      map[v.field_id] = v;
    });
    return map;
  } catch {
    return {};
  }
}

/** Батч-загрузка для списка сущностей. */
export async function getValuesForEntities(
  entityIds: string[],
): Promise<Record<string, Record<string, CustomFieldValue>>> {
  if (entityIds.length === 0) return {};
  try {
    const list = await api.get<CustomFieldValue[]>(
      `/custom-fields/values?entity_ids=${entityIds.join(',')}`,
    );

    const byEntity: Record<string, Record<string, CustomFieldValue>> = {};
    list.forEach((v) => {
      if (!byEntity[v.entity_id]) byEntity[v.entity_id] = {};
      byEntity[v.entity_id][v.field_id] = v;
    });
    return byEntity;
  } catch {
    return {};
  }
}

/** Преобразовать UI-значение в колонки БД. */
export function valueToColumn(
  field: CustomField,
  value: unknown,
): {
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
  value_json: unknown[] | null;
} {
  const base = {
    value_text: null as string | null,
    value_number: null as number | null,
    value_date: null as string | null,
    value_bool: null as boolean | null,
    value_json: null as unknown[] | null,
  };

  if (value === null || value === undefined || value === '') return base;

  switch (field.field_type) {
    case 'number':
      base.value_number = typeof value === 'number' ? value : Number(value);
      return base;
    case 'date':
      base.value_date = typeof value === 'string' ? value : String(value);
      return base;
    case 'bool':
      base.value_bool = Boolean(value);
      return base;
    case 'multiselect':
      base.value_json = Array.isArray(value) ? value : [];
      return base;
    default:
      base.value_text = String(value);
      return base;
  }
}

/** Из записи в UI-значение. */
export function columnToValue(
  field: CustomField,
  row: CustomFieldValue | undefined,
): unknown {
  if (!row) {
    if (field.field_type === 'bool') return false;
    if (field.field_type === 'multiselect') return [];
    return '';
  }
  switch (field.field_type) {
    case 'number':
      return row.value_number ?? '';
    case 'date':
      return row.value_date ?? '';
    case 'bool':
      return row.value_bool ?? false;
    case 'multiselect':
      return row.value_json ?? [];
    default:
      return row.value_text ?? '';
  }
}

/** Сохранить все значения для сущности одним запросом (batch). */
export async function upsertValues(
  fields: CustomField[],
  entityId: string,
  values: Record<string, unknown>,
): Promise<string | null> {
  const payload = {
    entity_id: entityId,
    values: fields.map((f) => ({
      field_id: f.id,
      value: values[f.id] ?? null,
    })),
  };

  if (payload.values.length === 0) return null;

  try {
    await api.post('/custom-fields/values/batch', payload);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка сохранения';
  }
}

/** Сохранить одно значение. */
export async function upsertValue(
  field: CustomField,
  entityId: string,
  value: unknown,
): Promise<string | null> {
  try {
    await api.post('/custom-fields/values', {
      field_id: field.id,
      entity_id: entityId,
      value,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}