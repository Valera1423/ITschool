// frontend/src/components/ui/Icon.tsx
import type { LucideIcon } from 'lucide-react';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
};

/**
 * Обёртка над lucide-иконками.
 * Гарантирует одинаковые размеры и `aria-hidden`.
 */
export function Icon({
  icon: IconCmp,
  size = 'md',
  className = '',
  title,
}: {
  icon: LucideIcon;
  size?: Size;
  className?: string;
  title?: string;
}) {
  return (
    <IconCmp
      size={SIZE_MAP[size]}
      className={className}
      aria-hidden={!title}
      aria-label={title}
    />
  );
}