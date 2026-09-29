import { describe, it, expect } from 'vitest';
import {
  isPrismaError,
  prismaErrorToHttp,
} from '../src/utils/prisma-errors.js';

describe('prisma-errors', () => {
  it('isPrismaError: распознаёт P2002', () => {
    expect(isPrismaError({ code: 'P2002', meta: { target: ['email'] } })).toBe(true);
  });

  it('isPrismaError: не путает с обычной ошибкой', () => {
    expect(isPrismaError(new Error('nope'))).toBe(false);
    expect(isPrismaError({ code: 'E_NOT_PRISMA' })).toBe(false);
    expect(isPrismaError(null)).toBe(false);
  });

  it('P2002 → 409', () => {
    const r = prismaErrorToHttp({ code: 'P2002' });
    expect(r.status).toBe(409);
    expect(r.code).toBe('CRM-409-003');
  });

  it('P2025 → 404', () => {
    const r = prismaErrorToHttp({ code: 'P2025' });
    expect(r.status).toBe(404);
  });

  it('P1001 → 503', () => {
    expect(prismaErrorToHttp({ code: 'P1001' }).status).toBe(503);
  });

  it('неизвестный код → 500', () => {
    expect(prismaErrorToHttp({ code: 'P9999' }).status).toBe(500);
  });
});