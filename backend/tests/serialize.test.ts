import { describe, it, expect } from 'vitest';
import { toSnakeCase } from '../src/utils/serialize.js';

describe('toSnakeCase', () => {
  it('преобразует camelCase → snake_case', () => {
    expect(toSnakeCase({ firstName: 'Ivan' })).toEqual({ first_name: 'Ivan' });
  });

  it('рекурсивно обрабатывает объекты', () => {
    const out = toSnakeCase({
      userInfo: { firstName: 'Ivan', lastName: 'Petrov' },
    });
    expect(out).toEqual({
      user_info: { first_name: 'Ivan', last_name: 'Petrov' },
    });
  });

  it('обрабатывает массивы', () => {
    const out = toSnakeCase([{ userId: 1 }, { userId: 2 }]);
    expect(out).toEqual([{ user_id: 1 }, { user_id: 2 }]);
  });

  it('Date с временем 00:00:00.000Z → YYYY-MM-DD', () => {
    const d = new Date('2026-02-05T00:00:00.000Z');
    expect(toSnakeCase({ dueDate: d })).toEqual({ due_date: '2026-02-05' });
  });

  it('Date с реальным временем → ISO', () => {
    const d = new Date('2026-02-05T14:30:00.000Z');
    expect(toSnakeCase({ createdAt: d })).toEqual({
      created_at: '2026-02-05T14:30:00.000Z',
    });
  });

  it('BigInt → number', () => {
    expect(toSnakeCase({ sizeBytes: 123n })).toEqual({ size_bytes: 123 });
  });

  it('null/undefined сохраняются', () => {
    expect(toSnakeCase({ x: null, y: undefined })).toEqual({ x: null, y: undefined });
  });
});