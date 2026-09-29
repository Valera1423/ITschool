// frontend/src/components/ui/AtomIcon.tsx
import {
  lazy,
  Suspense,
  type CSSProperties,
  type ComponentType,
  type SVGProps,
} from 'react';
import type { IconName } from './iconNames';

/**
 * Иконка дизайн-системы Атомаро.
 *
 * Все SVG лежат в src/assets/icons/ и подтягиваются лениво через Vite.
 * Именование: "24/AddLarge", "Alert/AttentionColor", "Logo/Telegram".
 */
const icons = import.meta.glob<{ default: ComponentType<SVGProps<SVGSVGElement>> }>(
  '@/assets/icons/**/*.svg',
  { query: '?react', import: 'default' },
);

interface AtomIconProps {
  name: IconName | string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  secondaryColor?: string;
  tertiaryColor?: string;
  'aria-label'?: string;
}

export function AtomIcon({
  name,
  size = 24,
  className = '',
  style,
  secondaryColor,
  tertiaryColor,
  'aria-label': ariaLabel,
}: AtomIconProps) {
  const key = `/src/assets/icons/${name}.svg`;
  const importer = icons[key];

  if (!importer) {
    if (import.meta.env.DEV) {
      console.warn(`[AtomIcon] Иконка не найдена: ${name}`);
    }
    return null;
  }

  const SvgComponent = lazy(importer);

  return (
    <Suspense
      fallback={
        <span
          style={{ width: size, height: size, display: 'inline-block' }}
          aria-hidden
        />
      }
    >
      <SvgComponent
        width={size}
        height={size}
        className={className}
        style={{ color: 'currentColor', ...style }}
        aria-hidden={!ariaLabel}
        aria-label={ariaLabel}
        {...(secondaryColor && { 'data-secondary-color': secondaryColor })}
        {...(tertiaryColor && { 'data-tertiary-color': tertiaryColor })}
      />
    </Suspense>
  );
}