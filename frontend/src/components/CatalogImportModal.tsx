// frontend/src/components/CatalogImportModal.tsx
import { useState } from 'react';
import { Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import {
  parseCatalogExcel,
  importCatalog,
  downloadCatalogTemplate,
  CATALOG_FIELDS,
  type CatalogEntity,
  type ParsedRow,
  type ImportResult,
} from '@/lib/catalogExcel';
import { SimpleModal, Button } from '@/components/ui';

interface Props {
  entity: CatalogEntity;
  entityLabel: string;
  onClose: () => void;
  onImported: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function CatalogImportModal({
  entity,
  entityLabel,
  onClose,
  onImported,
  onNotice,
}: Props) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mode, setMode] = useState<'upsert' | 'insert-only'>('upsert');
  const [step, setStep] = useState<'pick' | 'preview' | 'result'>('pick');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseCatalogExcel(file, entity);
      if (parsed.rows.length === 0) {
        onNotice('Файл пустой или не соответствует шаблону.');
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
      setStep('preview');
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка чтения файла.');
    }
  };

  const doImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.data);
    if (valid.length === 0) {
      onNotice('Нет валидных строк для импорта.');
      return;
    }
    setBusy(true);
    const r = await importCatalog(entity, valid, mode);
    setBusy(false);
    setResult(r);
    setStep('result');
    await onImported();
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <SimpleModal title={`Импорт: ${entityLabel}`} onClose={onClose} wide>
      {step === 'pick' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 p-4 text-xs text-sky-700 dark:text-sky-300 space-y-1">
            <p className="font-medium">Колонки шаблона:</p>
            <p>{CATALOG_FIELDS[entity].map((f) => f.label).join(' · ')}</p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center hover:border-sky-300 transition-colors"
          >
            <Upload size={32} className="mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              Перетащите .xlsx сюда
            </p>
            <p className="text-xs text-slate-400 mb-4">или</p>
            <div className="flex items-center justify-center gap-3">
              <label className="inline-block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700">
                  <Upload size={14} /> Выбрать файл
                </span>
              </label>
              <Button
                variant="secondary"
                onClick={() => void downloadCatalogTemplate(entity)}
              >
                <Download size={14} /> Шаблон
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Файл: <strong>{fileName}</strong>, {rows.length} строк.
          </p>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} /> Валидных: {validCount}
            </span>
            {invalidCount > 0 && (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle size={14} /> Ошибок: {invalidCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Режим:</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="upsert">Обновлять существующие + создавать новые</option>
              <option value="insert-only">Только создавать новые</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Стр.</th>
                  {CATALOG_FIELDS[entity].map((f) => (
                    <th key={f.key} className="text-left px-3 py-2 font-medium text-slate-500">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.rowIndex}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      r.errors.length ? 'bg-rose-50/40 dark:bg-rose-900/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-400">{r.rowIndex}</td>
                    {CATALOG_FIELDS[entity].map((f) => (
                      <td key={f.key} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {r.data[f.key] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-rose-600">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStep('pick')}>
              Назад
            </Button>
            <Button onClick={() => void doImport()} disabled={busy || validCount === 0}>
              {busy ? 'Импорт…' : `Импортировать ${validCount}`}
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4 text-center">
          <FileSpreadsheet size={48} className="mx-auto text-emerald-500" />
          <p className="text-lg font-semibold">Импорт завершён</p>

          <div className="grid grid-cols-4 gap-3">
            <Stat label="Создано" value={result.inserted} color="emerald" />
            <Stat label="Обновлено" value={result.updated} color="sky" />
            <Stat label="Пропущено" value={result.skipped} color="slate" />
            <Stat label="Ошибок" value={result.failed} color={result.failed > 0 ? 'rose' : 'slate'} />
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300 text-left space-y-1">
              {result.errors.map((e, i) => (
                <p key={i}>Строка {e.rowIndex}: {e.message}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      )}
    </SimpleModal>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  };
  return (
    <div className={`p-3 rounded-xl ${map[color] ?? map.slate}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}