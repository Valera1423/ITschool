import { useEffect, useState } from 'react';

/**
 * Откладывает обновление значения.
 * Полезно для поиска: пока пользователь печатает — не дёргаем API.
 *
 * Использование:
 *   const [query, setQuery] = useState('');
 *   const debounced = useDebounce(query, 300);
 *   useEffect(() => { ... fetch by debounced }, [debounced]);
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}