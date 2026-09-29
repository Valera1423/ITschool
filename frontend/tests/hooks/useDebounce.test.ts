import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('не обновляет сразу', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    expect(result.current).toBe('a');

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // ещё не прошло 300мс

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('b');
  });

  it('сброс при быстром вводе', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ab' });
    act(() => { vi.advanceTimersByTime(150); });

    rerender({ v: 'abc' });
    act(() => { vi.advanceTimersByTime(150); });

    expect(result.current).toBe('a'); // таймер сбросился

    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe('abc');
  });
});