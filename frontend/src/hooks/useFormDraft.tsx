// frontend/src/hooks/useFormDraft.tsx
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
import { AutoDraftIndicator } from '@/components/AutoDraftIndicator';

/**
 * Автосохранение черновиков форм в localStorage.
 *
 * ⚠️ ВАЖНО: работает ТОЛЬКО с uncontrolled-формами (нативные input/textarea/select).
 * Для react-hook-form НЕ ИСПОЛЬЗОВАТЬ — RHF держит состояние внутри себя,
 * и присваивание el.value не вызовет его onChange. Для RHF-форм используйте
 * отдельный хук useRHFWithDraft (в разработке) или просто не сохраняйте черновики.
 *
 * Использование:
 *   <DraftForm draftKey="university-new" onSubmit={handleSubmit}>
 *     <input name="name" />
 *     <textarea name="notes" />
 *   </DraftForm>
 *
 * При вводе данные сохраняются, при перезагрузке — восстанавливаются,
 * при успешной отправке — удаляются. Под формой показывается индикатор
 * «Черновик сохранён N сек назад» с кнопкой «Сбросить».
 */

const PREFIX = 'crm:draft:';

/** Поля, которые НИКОГДА не сохраняем. */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordConfirm',
  'currentPassword',
  'newPassword',
  'token',
  'api_key',
  'apiKey',
  'secret',
  'cardNumber',
  'cvv',
  'ssn',
]);

export function clearDraft(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function hasDraft(key: string): boolean {
  return !!localStorage.getItem(PREFIX + key);
}

type Props = {
  draftKey: string;
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'>;

export function DraftForm({
  draftKey,
  children,
  onSubmit,
  ...formProps
}: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Восстановление из localStorage при монтировании
  useEffect(() => {
    const saved = localStorage.getItem(PREFIX + draftKey);
    if (!saved || !ref.current) return;

    try {
      const data = JSON.parse(saved) as Record<string, unknown>;

      Object.entries(data).forEach(([name, value]) => {
        if (SENSITIVE_FIELDS.has(name)) return;

        const el = ref.current!.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (!el) return;

        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          el.checked = Boolean(value);
        } else {
          el.value = String(value ?? '');
        }
      });

      // Если что-то восстановили — сразу показываем индикатор,
      // чтобы пользователь знал: черновик подхватился.
      setSavedAt(Date.now());
    } catch {
      // Битый JSON — игнорируем
    }
  }, [draftKey]);

  // Сохраняем при любом изменении
  const handleChange = () => {
    if (!ref.current) return;

    // Защита: если в форме есть поля, управляемые через react-hook-form
    // (с атрибутом data-rhf="true" или с name, начинающимся с _), НЕ сохраняем —
    // RHF держит состояние сам, и такое сохранение даст рассинхрон.
    // Разработчик должен использовать controlled-режим с ручным сохранением.
    if (ref.current.querySelector('[data-rhf="true"]')) {
      return;
    }

    const obj: Record<string, unknown> = {};
    new FormData(ref.current).forEach((v, k) => {
      if (SENSITIVE_FIELDS.has(k)) return;
      obj[k] = v;
    });

    ref.current
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')
      .forEach((el) => {
        if (SENSITIVE_FIELDS.has(el.name)) return;
        obj[el.name] = el.checked;
      });

    try {
      localStorage.setItem(PREFIX + draftKey, JSON.stringify(obj));
      setSavedAt(Date.now());
    } catch {
      /* localStorage переполнен — молча игнорируем */
    }
  };

  // Ручной сброс черновика: удаляем из localStorage, чистим форму
  // и убираем индикатор.
  const handleClear = () => {
    try {
      localStorage.removeItem(PREFIX + draftKey);
    } catch {
      /* ignore */
    }
    setSavedAt(null);
    ref.current?.reset();
  };

  // При отправке очищаем черновик и сбрасываем индикатор
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    try {
      localStorage.removeItem(PREFIX + draftKey);
    } catch {
      /* ignore */
    }
    setSavedAt(null);
    onSubmit?.(e);
  };

  return (
    <>
      <form
        ref={ref}
        {...formProps}
        onChange={handleChange}
        onSubmit={handleSubmit}
      >
        {children}
      </form>

      <AutoDraftIndicator savedAt={savedAt} onClear={handleClear} />
    </>
  );
}