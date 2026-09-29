import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, FileJson, FileDown } from 'lucide-react';
import { SimpleModal, Button } from '@/components/ui';
import { downloadCSV } from '@/lib/utils';
import { exportRowsSpreadsheet, type ReportColumn } from '@/lib/excel';
import { downloadJson } from '@/lib/chartExport';

interface Props {
  title: string;
  filename: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  onClose: () => void;
  onNotice: (msg: string) => void;
}

type Format = 'xls' | 'xlsx' | 'csv' | 'pdf' | 'json';

/**
 * Модалка экспорта с выбором колонок и формата.
 * Форматы: XLS, XLSX, CSV, PDF, JSON.
 */
export function ExportWithColumnsModal({
  title,
  filename,
  columns,
  rows,
  onClose,
  onNotice,
}: Props) {
  const [selected, setSelected] = useState<string[]>(columns.map((c) => c.key));
  const [format, setFormat] = useState<Format>('xlsx');

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const handleExport = () => {
    const chosen = columns.filter((c) => selected.includes(c.key));
    if (chosen.length === 0) {
      onNotice('Выберите хотя бы одну колонку.');
      return;
    }

    const date = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const header = chosen.map((c) => c.label);
      const body = rows.map((r) => chosen.map((c) => String(r[c.key] ?? '')));
      downloadCSV(`${filename}-${date}.csv`, [header, ...body]);
    } else if (format === 'json') {
      const out = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        chosen.forEach((c) => { obj[c.key] = r[c.key] ?? null; });
        return obj;
      });
      downloadJson(`${filename}-${date}.json`, {
        generated_at: new Date().toISOString(),
        title,
        rows: out,
      });
    } else if (format === 'xls' || format === 'xlsx') {
      exportRowsSpreadsheet(rows, chosen, `${filename}-${date}`, format);
    } else if (format === 'pdf') {
      void (async () => {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(13).setFont('helvetica', 'bold');
        doc.text(title, 14, 15);
        doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120);
        doc.text(`Сгенерировано ${new Date().toLocaleString('ru-RU')}`, 14, 21);
        doc.setTextColor(0);

        autoTable(doc, {
          startY: 28,
          head: [chosen.map((c) => c.label)],
          body: rows.map((r) => chosen.map((c) => String(r[c.key] ?? '—'))),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [2, 132, 199], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        });

        doc.save(`${filename}-${date}.pdf`);
      })();
    }

    onNotice(`Файл ${format.toUpperCase()} сохранён.`);
    onClose();
  };

  const FORMATS: { key: Format; label: string; icon: typeof FileSpreadsheet }[] = [
    { key: 'xls', label: 'XLS', icon: FileSpreadsheet },
    { key: 'xlsx', label: 'XLSX', icon: FileSpreadsheet },
    { key: 'csv', label: 'CSV', icon: FileText },
    { key: 'pdf', label: 'PDF', icon: FileDown },
    { key: 'json', label: 'JSON', icon: FileJson },
  ];

  return (
    <SimpleModal title="Экспорт отчёта" onClose={onClose} wide>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Формат</p>
          <div className="grid grid-cols-5 gap-2">
            {FORMATS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                  format === key
                    ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-400 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Колонки ({selected.length} из {columns.length})
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(columns.map((c) => c.key))}
                className="text-xs text-sky-600 hover:underline"
              >
                Выбрать все
              </button>
              <button
                onClick={() => setSelected([])}
                className="text-xs text-slate-400 hover:underline"
              >
                Снять все
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {columns.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.key)}
                  onChange={() => toggle(c.key)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400">
          Будет выгружено <strong>{rows.length}</strong> строк × <strong>{selected.length}</strong> колонок
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={handleExport} disabled={selected.length === 0}>
            <Download size={14} /> Экспортировать
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}