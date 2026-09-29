import { describe, it, expect } from 'vitest';
import { validateFieldValue } from '../src/services/custom-fields.service.js';
import { AppError } from '../src/errors/codes.js';

const baseField = {
  id: 'f1',
  key: 'test',
  label: 'Test',
  fieldType: 'text',
  options: [],
  required: false,
};

describe('validateFieldValue', () => {
  it('text: сохраняет строку', () => {
    const r = validateFieldValue(baseField, 'hello');
    expect(r.valueText).toBe('hello');
  });

  it('number: парсит число', () => {
    const r = validateFieldValue({ ...baseField, fieldType: 'number' }, '42');
    expect(r.valueNumber).toBe(42);
  });

  it('number: невалидное → ошибка', () => {
    expect(() =>
      validateFieldValue({ ...baseField, fieldType: 'number' }, 'abc'),
    ).toThrow(AppError);
  });

  it('date: парсит дату', () => {
    const r = validateFieldValue({ ...baseField, fieldType: 'date' }, '2026-02-05');
    expect(r.valueDate).toBeInstanceOf(Date);
  });

  it('email: валидирует формат', () => {
    expect(() =>
      validateFieldValue({ ...baseField, fieldType: 'email' }, 'not-an-email'),
    ).toThrow(AppError);
  });

  it('select: проверяет options', () => {
    expect(() =>
      validateFieldValue(
        { ...baseField, fieldType: 'select', options: ['a', 'b'] },
        'c',
      ),
    ).toThrow(AppError);
  });

  it('multiselect: сохраняет массив', () => {
    const r = validateFieldValue(
      { ...baseField, fieldType: 'multiselect', options: ['a', 'b'] },
      ['a', 'b'],
    );
    expect(r.valueJson).toEqual(['a', 'b']);
  });

  it('required + пусто → ошибка', () => {
    expect(() =>
      validateFieldValue({ ...baseField, required: true }, ''),
    ).toThrow(AppError);
  });
});