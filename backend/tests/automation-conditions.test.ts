import { describe, it, expect } from 'vitest';

// Экспортируй checkConditions из AutomationService
// или продублируй функцию здесь для теста
function checkConditions(
  conditions: { field: string; operator: string; value?: unknown }[],
  data: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => {
    const value = data[c.field];
    switch (c.operator) {
      case 'equals': return String(value) === String(c.value);
      case 'not_equals': return String(value) !== String(c.value);
      case 'contains':
        return String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
      case 'greater': return Number(value) > Number(c.value);
      case 'less': return Number(value) < Number(c.value);
      case 'empty': return value === null || value === undefined || value === '';
      case 'not_empty': return value !== null && value !== undefined && value !== '';
      case 'in':
        return Array.isArray(c.value) &&
          (c.value as unknown[]).map(String).includes(String(value));
      default: return true;
    }
  });
}

describe('automation checkConditions', () => {
  it('пустое условие = true', () => {
    expect(checkConditions([], { status: 'x' })).toBe(true);
  });

  it('equals', () => {
    expect(checkConditions([{ field: 'status', operator: 'equals', value: 'Отказ' }], { status: 'Отказ' })).toBe(true);
    expect(checkConditions([{ field: 'status', operator: 'equals', value: 'Отказ' }], { status: 'Партнёр' })).toBe(false);
  });

  it('contains (регистронезависимо)', () => {
    expect(checkConditions(
      [{ field: 'name', operator: 'contains', value: 'мфти' }],
      { name: 'МФТИ' },
    )).toBe(true);
  });

  it('empty / not_empty', () => {
    expect(checkConditions([{ field: 'x', operator: 'empty' }], { x: '' })).toBe(true);
    expect(checkConditions([{ field: 'x', operator: 'empty' }], { x: 'value' })).toBe(false);
    expect(checkConditions([{ field: 'x', operator: 'not_empty' }], { x: 'value' })).toBe(true);
  });

  it('in', () => {
    expect(checkConditions(
      [{ field: 'status', operator: 'in', value: ['Новый', 'Переговоры'] }],
      { status: 'Новый' },
    )).toBe(true);
    expect(checkConditions(
      [{ field: 'status', operator: 'in', value: ['Новый', 'Переговоры'] }],
      { status: 'Партнёр' },
    )).toBe(false);
  });
});