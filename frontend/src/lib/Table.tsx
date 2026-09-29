// frontend/src/components/ui/Table.tsx
import type {
  ReactNode,
  ThHTMLAttributes,
  TdHTMLAttributes,
  HTMLAttributes,
} from 'react';

/**
 * Универсальные обёртки для таблиц.
 * Гарантируют единый стиль заголовков, ячеек, границ.
 */

export function Table({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={`w-full atmr-body-s ${className}`}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-atmr-bg-surface2">{children}</thead>;
}

export function THeadRow({ children }: { children: ReactNode }) {
  return (
    <tr className="atmr-desc-l-strong text-atmr-fg-muted border-b border-atmr-border-soft">
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = 'left',
  className = '',
  ...rest
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
} & ThHTMLAttributes<HTMLTableCellElement>) {
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`${alignCls} font-medium px-4 py-3 ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TRow({
  children,
  hoverable = true,
  className = '',
  ...rest
}: {
  children: ReactNode;
  hoverable?: boolean;
} & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b border-atmr-border-soft last:border-0 ${
        hoverable ? 'hover:bg-atmr-bg-surface2 transition-colors duration-atmr-fast' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = 'left',
  className = '',
  ...rest
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
} & TdHTMLAttributes<HTMLTableCellElement>) {
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`${alignCls} px-4 py-3 text-atmr-fg ${className}`} {...rest}>
      {children}
    </td>
  );
}