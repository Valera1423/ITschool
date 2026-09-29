import { describe, it, expect } from 'vitest';
import { parseCursor, buildCursorPage } from '../src/utils/pagination.js';

describe('parseCursor', () => {
  it('дефолт: limit=50, forward', () => {
    const r = parseCursor({ query: {} } as never);
    expect(r.take).toBe(50);
    expect(r.cursor).toBeUndefined();
    expect(r.direction).toBe('forward');
  });

  it('limit клипуется к 200', () => {
    const r = parseCursor({ query: { limit: '99999' } } as never);
    expect(r.take).toBe(200);
  });

  it('cursor и backward', () => {
    const r = parseCursor({
      query: { cursor: 'abc', dir: 'backward' },
    } as never);
    expect(r.cursor).toEqual({ id: 'abc' });
    expect(r.skip).toBe(1);
    expect(r.direction).toBe('backward');
  });
});

describe('buildCursorPage', () => {
  it('hasMore=true если больше limit', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i}` }));
    const page = buildCursorPage(items, 10);
    expect(page.pagination.hasMore).toBe(true);
    expect(page.items.length).toBe(10);
    expect(page.pagination.nextCursor).toBe('id-9');
  });

  it('hasMore=false если меньше limit', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const page = buildCursorPage(items, 10);
    expect(page.pagination.hasMore).toBe(false);
    expect(page.pagination.nextCursor).toBeNull();
  });
});