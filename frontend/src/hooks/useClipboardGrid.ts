import { useCallback, useRef } from 'react';

export interface GridRow {
  id: string;
  [key: string]: unknown;
}

export interface GridColumn {
  key: string;
  label: string;
}

export function useClipboardGrid<T extends GridRow>(params: {
  selectedIds: string[];
  allRows: T[];
  columns: GridColumn[];
  disabled?: boolean;
  onPaste: (rows: Partial<T>[]) => Promise<void>;
}) {
  const {
    selectedIds,
    allRows,
    columns,
    disabled = false,
    onPaste,
  } = params;
  const ref = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      if (selectedIds.length === 0) return;
      const selected = allRows.filter((r) => selectedIds.includes(r.id));
      if (selected.length === 0) return;

      const header = columns.map((c) => c.label).join('\t');
      const body = selected.map((r) =>
        columns
          .map((c) => String(r[c.key] ?? '').replace(/\t|\n/g, ' '))
          .join('\t'),
      );
      const tsv = [header, ...body].join('\n');

      e.clipboardData.setData('text/plain', tsv);
      e.preventDefault();
    },
    [selectedIds, allRows, columns, disabled],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const raw = e.clipboardData.getData('text/plain');
      if (!raw || !raw.includes('\t')) return;

      e.preventDefault();
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return;

      const firstLine = lines[0].split('\t');

      const headersMatch =
        firstLine.length === columns.length &&
        firstLine.every(
          (h, i) => h.trim().toLowerCase() === columns[i].label.toLowerCase(),
        );

      const dataLines = headersMatch ? lines.slice(1) : lines;

      const parsed: Partial<T>[] = dataLines.map((line) => {
        const cells = line.split('\t');
        const row: Record<string, unknown> = {};
        columns.forEach((c, i) => {
          if (i < cells.length) row[c.key] = cells[i].trim();
        });
        return row as Partial<T>;
      });

      if (parsed.length === 0) return;
      if (!window.confirm(`Вставить ${parsed.length} строк?`)) return;
      void onPaste(parsed);
    },
    [columns, onPaste, disabled],
  );

  return { ref, handleCopy, handlePaste };
}