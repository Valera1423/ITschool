import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'crm:draft:';

/** Поля, которые НИКОГДА не сохраняем. */
const SENSITIVE_FIELDS = new Set([
  'password', 'passwordConfirm', 'currentPassword', 'newPassword',
  'token', 'api_key', 'apiKey', 'secret', 'cardNumber', 'cvv', 'ssn',
]);

export interface DraftState<T> {
  value: T;
  savedAt: number | null;
  hasDraft: boolean;
}

/**
 * Автосохранение controlled-state (в т.ч. из react-hook-form).
 *
 * Отличия от DraftForm:
 * - Работает с React-состоянием, а не с DOM
 * - Есть debounce (по умолчанию 1 сек)
 * - Показывает «сохранено N сек назад»
 * - Не сохраняет чувствительные поля (см. SENSITIVE_FIELDS)
 *
 * Использование:
 *   const [data, setData] = useAutoDraft('university-new', initial, {
 *     fields: ['name', 'city', 'contact_email'],
 *   });
 *
 *   // data — обычный объект, setData работает как setState
 *   // если черновик есть — он восстановится автоматически
 */
export function useAutoDraft<T extends Record<string, unknown>>(
  draftKey: string,
  initial: T,
  options: {
    /** Какие поля сохранять. Если не указано — все, кроме SENSITIVE. */
    fields?: (keyof T)[];
    /** Debounce мс (по умолчанию 1000). */
    debounceMs?: number;
    /** Не сохранять, пока не изменился хотя бы раз. */
    skipInitial?: boolean;
  } = {},
): [
  T,
  (value: T | ((prev: T) => T)) => void,
  { savedAt: number | null; hasDraft: boolean; clearDraft: () => void },
] {
  const { fields, debounceMs = 1000, skipInitial = true } = options;

  // Читаем черновик один раз при инициализации
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(PREFIX + draftKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as Partial<T>;
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  });

  const [savedAt, setSavedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(PREFIX + draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { __savedAt?: number };
      return parsed.__savedAt ?? null;
    } catch {
      return null;
    }
  });

  const isFirstRender = useRef(true);
  const timerRef = useRef<number | null>(null);

  // Фильтрация: только разрешённые поля, без sensitive
  const pickFields = useCallback(
    (obj: T): Partial<T> => {
      const out: Record<string, unknown> = {};
      const keys = fields ?? (Object.keys(obj) as (keyof T)[]);
      keys.forEach((k) => {
        if (SENSITIVE_FIELDS.has(String(k))) return;
        out[String(k)] = obj[k];
      });
      return out as Partial<T>;
    },
    [fields],
  );

  // Debounced save
  useEffect(() => {
    if (skipInitial && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        const payload = { ...pickFields(value), __savedAt: Date.now() };
        localStorage.setItem(PREFIX + draftKey, JSON.stringify(payload));
        setSavedAt(Date.now());
      } catch { /* localStorage переполнен */ }
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [value, draftKey, debounceMs, pickFields, skipInitial]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(PREFIX + draftKey); }
    catch { /* ignore */ }
    setSavedAt(null);
  }, [draftKey]);

  const hasDraft = savedAt !== null;

  return [value, setValue, { savedAt, hasDraft, clearDraft }];
}

/** Есть ли черновик по данному ключу. */
export function hasDraft(draftKey: string): boolean {
  try { return !!localStorage.getItem(PREFIX + draftKey); }
  catch { return false; }
}

/** Очистить черновик. */
export function clearDraft(draftKey: string): void {
  try { localStorage.removeItem(PREFIX + draftKey); }
  catch { /* ignore */ }
}