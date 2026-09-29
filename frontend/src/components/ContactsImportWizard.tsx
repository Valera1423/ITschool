import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, Download, Users } from 'lucide-react';
import {
  parseContactsExcel, importContacts, downloadContactsTemplate,
  CONTACT_FIELDS, type ParsedContactRow, type ContactImportResult,
} from '@/lib/contacts';
import { SimpleModal, Button } from '@/components/ui';

interface Props {
  onClose: () => void;
  onDone: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function ContactsImportWizard({ onClose, onDone, onNotice }: Props) {
  const [step, setStep] = useState<'pick' | 'preview' | 'result'>('pick');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedContactRow[]>([]);
  const [createMissing, setCreateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContactImportResult | null>(null);

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseContactsExcel(file);
      if (parsed.length === 0) { onNotice('Файл пустой или не соответствует шаблону.'); return; }
      setFileName(file.name);
      setRows(parsed);
      setStep('preview');
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка чтения файла.');
    }
  };

  const doImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.data);
    if (valid.length === 0) { onNotice('Нет валидных строк.'); return; }
    setBusy(true);
    const r = await importContacts(valid, createMissing);
    setBusy(false);
    setResult(r);
    setStep('result');
    await onDone();
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <SimpleModal title="Импорт контактов из Excel" onClose={onClose} wide>
      {step === 'pick' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-4 text-xs text-sky-700 dark:text-sky-300 space-y-1">
            <p className="font-medium">Колонки шаблона:</p>
            <p>{CONTACT_FIELDS.map((f) => f.label).join(' · ')}</p>
            <p className="opacity-80">
              Контакт привязывается к вузу по точному названию (без учёта регистра).
            </p>
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
              Перетащите .xlsx с контактами
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <label className="inline-block">
                <input
                  type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                />
                <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700">
                  <Upload size={14} /> Выбрать файл
                </span>
              </label>
              <Button variant="secondary" onClick={downloadContactsTemplate}>
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

          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => setCreateMissing(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 text-amber-600"
            />
            <span className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Users size={14} /> Создавать вузы, если их нет в базе
            </span>
          </label>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Стр.</th>
                  {CONTACT_FIELDS.map((f) => (
                    <th key={f.key} className="text-left px-3 py-2 font-medium text-slate-500">{f.label}</th>
                  ))}
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowIndex} className={`border-t border-slate-100 dark:border-slate-800 ${r.errors.length ? 'bg-rose-50/40 dark:bg-rose-900/20' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{r.rowIndex}</td>
                    {CONTACT_FIELDS.map((f) => (
                      <td key={f.key} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {String((r.data as unknown as Record<string, unknown>)[f.key] ?? '') || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-rose-600">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStep('pick')}>Назад</Button>
            <Button onClick={() => void doImport()} disabled={busy || validCount === 0}>
              {busy ? 'Импорт…' : `Импортировать ${validCount}`}
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
          <p className="text-lg font-semibold">Импорт завершён</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Создано" value={result.inserted} color="emerald" />
            <Stat label="Обновлено" value={result.updated} color="sky" />
            <Stat label="Вузов создано" value={result.universitiesCreated} color="violet" />
            <Stat label="Ошибок" value={result.failed} color={result.failed > 0 ? 'rose' : 'slate'} />
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300 text-left space-y-1">
              {result.errors.map((e, i) => (
                <p key={i}>Строка {e.rowIndex + 1}: {e.message}</p>
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
    violet: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
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