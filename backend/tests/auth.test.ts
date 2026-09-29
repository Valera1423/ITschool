import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission, buildScopeWhere } from '../src/middleware/auth.js';
import { AppError } from '../src/errors/codes.js';

function mockReq(auth: unknown): Request {
  return { auth } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('requireRole', () => {
  it('пускает совпадающую роль', () => {
    const mw = requireRole('admin');
    const next = vi.fn();
    mw(mockReq({ role: 'admin' }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('403 при несовпадении', () => {
    const mw = requireRole('admin');
    const next = vi.fn();
    mw(mockReq({ role: 'nam' }), mockRes(), next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
  });

  it('401 если auth отсутствует', () => {
    const mw = requireRole('admin');
    const next = vi.fn();
    mw(mockReq(undefined), mockRes(), next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
  });
});

describe('requirePermission', () => {
  it('admin всегда проходит', () => {
    const mw = requirePermission('audit.view');
    const next = vi.fn();
    mw(mockReq({ role: 'admin', permissions: [] }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('nam без permission — 403', () => {
    const mw = requirePermission('audit.view');
    const next = vi.fn();
    mw(mockReq({ role: 'nam', permissions: [] }), mockRes(), next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
  });

  it('nam с permission проходит', () => {
    const mw = requirePermission('analytics.view');
    const next = vi.fn();
    mw(mockReq({ role: 'nam', permissions: ['analytics.view'] }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('buildScopeWhere', () => {
  it('manager видит всё', () => {
    const where = buildScopeWhere(
      { role: 'manager', profileId: 'p1', name: 'X' } as never,
      'universities',
    );
    expect(where).toEqual({});
  });

  it('nam видит только свои (managerRef)', () => {
    const where = buildScopeWhere(
      { role: 'nam', profileId: 'p1', name: 'X' } as never,
      'universities',
    );
    expect(where).toHaveProperty('OR');
  });

  it('explicit scope перекрывает автоправило', () => {
    const where = buildScopeWhere(
      {
        role: 'nam',
        profileId: 'p1',
        name: 'X',
        scopes: { universities: { city: 'Москва' } },
      } as never,
      'universities',
    );
    expect(where).toEqual({ city: 'Москва' });
  });
});