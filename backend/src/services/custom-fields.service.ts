import { prisma } from '../db/prisma.js';
import { AppError } from '../errors/codes.js';
import { z } from 'zod';

interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
}

/**
 * Валидация значения против определения поля.
 * Возвращает нормализованные колонки БД или бросает AppError.
 */
export function validateFieldValue(
  field: CustomFieldDef,
  rawValue: unknown,
): {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  valueJson: unknown[] | null;
} {
  const empty = {
    valueText: null as string | null,
    valueNumber: null as number | null,
    valueDate: null as Date | null,
    valueBool: null as boolean | null,
    valueJson: null as unknown[] | null,
  };

  // Проверка на пустоту
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    if (field.required) {
      throw new AppError('MISSING_REQUIRED_FIELD', 400, { field: field.key });
    }
    return empty;
  }

  switch (field.fieldType) {
    case 'text':
    case 'url':
    case 'phone':
    case 'email': {
      const s = String(rawValue);

      if (field.fieldType === 'email' && !/^[^@]+@[^@]+\.[^@]+$/.test(s)) {
        throw new AppError('INVALID_FORMAT', 400, { field: field.key, expected: 'email' });
      }
      if (field.fieldType === 'url' && !/^https?:\/\//.test(s)) {
        throw new AppError('INVALID_FORMAT', 400, { field: field.key, expected: 'url' });
      }
      if (field.fieldType === 'phone' && !/^[\d\s+()-]{5,}$/.test(s)) {
        throw new AppError('INVALID_FORMAT', 400, { field: field.key, expected: 'phone' });
      }

      return { ...empty, valueText: s };
    }

    case 'number': {
      const n = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(n)) {
        throw new AppError('INVALID_FORMAT', 400, { field: field.key, expected: 'number' });
      }
      return { ...empty, valueNumber: n };
    }

    case 'date': {
      const d = new Date(String(rawValue));
      if (isNaN(d.getTime())) {
        throw new AppError('INVALID_FORMAT', 400, { field: field.key, expected: 'date' });
      }
      // Обрезаем до даты
      d.setHours(0, 0, 0, 0);
      return { ...empty, valueDate: d };
    }

    case 'bool': {
      const b = typeof rawValue === 'boolean'
        ? rawValue
        : ['true', '1', 'yes', 'да'].includes(String(rawValue).toLowerCase());
      return { ...empty, valueBool: b };
    }

    case 'select': {
      const s = String(rawValue);
      if (field.options.length > 0 && !field.options.includes(s)) {
        throw new AppError('INVALID_FORMAT', 400, {
          field: field.key,
          expected: `one of: ${field.options.join(', ')}`,
        });
      }
      return { ...empty, valueText: s };
    }

    case 'multiselect': {
      const arr = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];
      if (field.options.length > 0) {
        const invalid = arr.filter((v) => !field.options.includes(v));
        if (invalid.length > 0) {
          throw new AppError('INVALID_FORMAT', 400, {
            field: field.key,
            invalid,
          });
        }
      }
      return { ...empty, valueJson: arr };
    }

    default:
      throw new AppError('INVALID_FORMAT', 400, {
        field: field.key,
        reason: `Неизвестный тип поля: ${field.fieldType}`,
      });
  }
}

export class CustomFieldsService {
  /**
   * Валидирует и сохраняет значения для сущности.
   */
  static async saveValues(
    entityId: string,
    values: Array<{ field_id: string; value: unknown }>,
  ): Promise<void> {
    // Загружаем определения
    const fieldIds = values.map((v) => v.field_id);
    const fields = await prisma.customField.findMany({
      where: { id: { in: fieldIds } },
    });
    const fieldMap = new Map(fields.map((f) => [f.id, f]));

    for (const v of values) {
      const field = fieldMap.get(v.field_id);
      if (!field) {
        throw new AppError('NOT_FOUND', 404, { fieldId: v.field_id });
      }

      const normalized = validateFieldValue(field, v.value);

      await prisma.customFieldValue.upsert({
        where: {
          fieldId_entityId: { fieldId: field.id, entityId },
        },
        update: {
          valueText: normalized.valueText,
          valueNumber: normalized.valueNumber,
          valueDate: normalized.valueDate,
          valueBool: normalized.valueBool,
          valueJson: normalized.valueJson as never,
          updatedAt: new Date(),
        },
        create: {
          fieldId: field.id,
          entityId,
          valueText: normalized.valueText,
          valueNumber: normalized.valueNumber,
          valueDate: normalized.valueDate,
          valueBool: normalized.valueBool,
          valueJson: normalized.valueJson as never,
        },
      });
    }
  }
}