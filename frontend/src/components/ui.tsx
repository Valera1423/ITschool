// frontend/src/components/ui.tsx
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import { ArrowUpRight, CheckCircle2, FileText, Plus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STATUS_COLORS } from '@/constants';

// ============================================================
// ЗАГОЛОВОК ПАНЕЛИ
// ============================================================

export function PanelHeading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="atmr-h3 text-atmr-fg">{title}</h2>
      {action && (
        <button
          onClick={onClick}
          className="flex items-center gap-1 atmr-body-s-strong text-atmr-accent hover:text-atmr-accent-hover transition-colors duration-atmr-2xs"
        >
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}

// ============================================================
// БЕЙДЖИ
// ============================================================

export function StatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_COLORS[status] ?? 'bg-atmr-bg-surface2 text-atmr-fg-soft';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-atmr-full atmr-desc-l-strong ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    STATUS_COLORS[priority] ?? 'bg-atmr-bg-surface2 text-atmr-fg-soft';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-atmr-s atmr-desc-l-strong ${cls}`}
    >
      {priority}
    </span>
  );
}

// ============================================================
// ПУСТОЕ СОСТОЯНИЕ
// ============================================================

export function EmptyState({
  text,
  icon: Icon = FileText,
  actionLabel,
  onAction,
  hint,
}: {
  text: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-atmr-xl bg-atmr-bg-surface2 flex items-center justify-center text-atmr-fg-muted">
        <Icon size={24} />
      </div>
      <div className="max-w-sm">
        <p className="atmr-body-s-strong text-atmr-fg">{text}</p>
        {hint && <p className="atmr-desc-l text-atmr-fg-muted mt-1">{hint}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-2 px-4 py-2.5 rounded-atmr-l atmr-body-s-strong text-atmr-accent-on bg-atmr-accent hover:bg-atmr-accent-hover shadow-atmr-s transition-colors duration-atmr-2xs"
        >
          <Plus size={15} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================
// МОДАЛЬНОЕ ОКНО (с focus trap + aria-labelledby)
// ============================================================

const modalStack: symbol[] = [];

export function SimpleModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const id = Symbol('modal');
    modalStack.push(id);

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const top = modalStack[modalStack.length - 1];
      if (top !== id) return;

      const root = modalRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const top = modalStack[modalStack.length - 1];
      if (top === id) {
        e.stopPropagation();
        onClose();
      }
    };

    requestAnimationFrame(() => {
      const root = modalRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    });

    window.addEventListener('keydown', handleTab);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleTab);
      window.removeEventListener('keydown', handleEscape);
      const idx = modalStack.lastIndexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
    };
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-atmr-modal flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`bg-atmr-bg-elevated-xl rounded-atmr-xl shadow-atmr-xl w-full ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        } max-h-[90vh] overflow-y-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-atmr-border-soft sticky top-0 bg-atmr-bg-elevated-xl rounded-t-atmr-xl z-atmr-s">
          <h2 id={titleId} className="atmr-h3 text-atmr-fg">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 hover:text-atmr-fg transition-colors duration-atmr-2xs"
            aria-label="Закрыть"
          >
            <X size={19} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// ФОРМА
// ============================================================

export function FormActions({
  onClose,
  submitLabel,
  saving,
}: {
  onClose: () => void;
  submitLabel: string;
  saving?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-atmr-l atmr-body-s-strong text-atmr-fg bg-atmr-bg-surface2 hover:bg-atmr-surface-hover transition-colors duration-atmr-2xs"
      >
        Отмена
      </button>
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-atmr-l atmr-body-s-strong text-atmr-accent-on bg-atmr-accent hover:bg-atmr-accent-hover disabled:opacity-60 transition-colors duration-atmr-2xs"
      >
        {saving ? 'Сохраняем…' : submitLabel}
      </button>
    </div>
  );
}

// ============================================================
// ТОСТ
// ============================================================

export function Toast({
  message,
  onClose,
  action,
}: {
  message: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="fixed top-5 right-5 z-atmr-toast flex items-center gap-3 px-5 py-3.5 bg-atmr-fg text-atmr-fg-inverse rounded-atmr-l shadow-atmr-xl atmr-body-s animate-slide-in-right max-w-md">
      <CheckCircle2 size={18} className="text-atmr-success flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="atmr-desc-l-strong text-atmr-accent hover:opacity-80 transition-opacity duration-atmr-2xs flex-shrink-0"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity duration-atmr-2xs flex-shrink-0"
        aria-label="Закрыть"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ============================================================
// LOADING
// ============================================================

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="w-8 h-8 border-[3px] border-atmr-accent-soft border-t-atmr-accent rounded-full animate-spin" />
      <p className="atmr-body-s text-atmr-fg-soft">
        Загружаем рабочее пространство…
      </p>
    </div>
  );
}

// ============================================================
// КНОПКА
// ============================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  loading?: boolean;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'children'
>;

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  disabled,
  loading,
  title,
  className = '',
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-atmr-accent text-atmr-accent-on hover:bg-atmr-accent-hover active:bg-atmr-accent-active shadow-atmr-s',
    secondary:
      'bg-atmr-bg-surface2 text-atmr-fg hover:bg-atmr-surface-hover active:bg-atmr-surface-active',
    ghost:
      'text-atmr-fg-soft hover:bg-atmr-bg-surface2 hover:text-atmr-fg',
    danger:
      'bg-atmr-error-soft text-atmr-error-fg hover:bg-atmr-error-soft-hover',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 atmr-desc-l-strong gap-1.5 rounded-atmr-m',
    md: 'px-4 py-2.5 atmr-body-s-strong gap-2 rounded-atmr-l',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-atmr-2xs disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

// ============================================================
// ПОЛЕ ФОРМЫ
// ============================================================

export function Field({
  label,
  children,
  wide,
  hint,
  error,
  className = '',
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''} ${className}`}>
      <span className="block atmr-desc-l-strong text-atmr-fg-soft mb-1.5">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="block atmr-desc-m text-atmr-fg-muted mt-1">{hint}</span>
      )}
      {error && (
        <span role="alert" className="block atmr-desc-m text-atmr-error mt-1">
          {error}
        </span>
      )}
    </label>
  );
}

// ============================================================
// АВАТАР
// ============================================================

const AVATAR_COLORS = {
  blue: 'bg-atmr-info-soft text-atmr-info-fg',
  green: 'bg-atmr-success-soft text-atmr-success-fg',
  orange: 'bg-atmr-warning-soft text-atmr-warning-fg',
  purple:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
} as const;

type AvatarColor = keyof typeof AVATAR_COLORS;

const AVATAR_SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
} as const;

export function Avatar({
  name,
  size = 'md',
  color = 'blue',
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  color?: AvatarColor | string;
}) {
  const init =
    name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const colorClass = AVATAR_COLORS[color as AvatarColor] ?? AVATAR_COLORS.blue;

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold flex-shrink-0 ${AVATAR_SIZES[size]} ${colorClass}`}
      title={name}
      aria-label={name}
    >
      {init}
    </div>
  );
}

// ============================================================
// УТИЛИТЫ ФОРМ
// ============================================================

export function formDataObject(form: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  form.forEach((value, key) => {
    result[key] = String(value);
  });
  return result;
}

// ============================================================
// КЛАССЫ ДЛЯ INPUT / SELECT / TEXTAREA
// ============================================================

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-atmr-l border border-atmr-border text-atmr-fg placeholder:text-atmr-fg-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-atmr-accent/20 focus:border-atmr-accent ' +
  'transition-colors duration-atmr-2xs bg-atmr-bg-surface1 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const selectClass = inputClass;

export const textareaClass = `${inputClass} resize-none min-h-[80px]`;