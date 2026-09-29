import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}

export function ResponsiveTable({ children, className = '', minWidth = 720 }: Props) {
  return (
    <div className={`table-scroll ${className}`}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

export function VirtualTableBody<T>({
  items, estimateSize = 48, renderRow, className = '',
}: {
  items: T[];
  estimateSize?: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  return (
    <div
      ref={parentRef}
      className={`overflow-auto bg-atmr-bg-surface1 ${className}`}
      style={{ maxHeight: '70vh' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}