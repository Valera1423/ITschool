import { useState } from 'react';
import { Upload, ChevronRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  parseExcel,
  autoMap,
  validateRows,
  importUniversitiesUpsert,
  UNIVERSITY_FIELDS,
  type ColumnMapping,
  type RowPreview,
  type ImportResult,
} from '@/lib/excel';
import { SimpleModal, Button, Field, selectClass } from '@/components/ui';

interface Props {
  onClose: () => void;
  onDone: () => Promise<void>;
  onNotice: (msg: string) => void;
}

type Step = 'pick' | 'map' | 'preview' | 'result';

/**
 * Мастер импорта вузов из Excel:
 * 1. Выбор файла (drag-n-drop)
 * 2. Сопоставление колонок (автоматически + ручная правка)
 * 3. Предпросмотр с ошибками
 * 4. Импорт + результат
 */
export function ExcelImportWizard({ onClose, onDone, onNotice }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [previews, setPreviews] = useState<RowPreview[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const { headers: h, rows: r } = await parseExcel(file);
      if (h.length === 0) { onNotice('Файл пустой.'); return; }
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      setMapping(autoMap(h));
      setStep('map');
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Не удалось прочитать файл.');
    }
  };

  const goPreview = () => {
    const nameCol = mapping['name'];
    if (nameCol === undefined || nameCol < 0) {
      onNotice('Укажите колонку для «Название вуза».');
      return;
    }
    setPreviews(validateRows(rows, mapping));
    setStep('preview');
  };

  const doImport = async () => {
    setBusy(true);
    const r = await importUniversitiesUpsert(previews);
    setResult(r);
    setBusy(false);
    setStep('result');
    await onDone();
  };

  const validCount = previews.filter((p) => p.errors.length === 0).length;
  const invalidCount = previews.length - validCount;

  return (
    <SimpleModal title="Импорт вузов из Excel" onClose={onClose} wide>
      {/* Индикатор шагов */}
      <div className="flex items-center gap-2 mb-5 text-xs flex-wrap">
        {(['pick', 'map', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-medium ${
                step === s
                  ? 'bg-sky-600 text-white'
                  : ['pick', 'map', 'preview', 'result'].indexOf(step) > i
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
            <span className={step === s ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'}>
              {s === 'pick' ? 'Файл' : s === 'map' ? 'Колонки' : s === 'preview' ? 'Предпросмотр' : 'Готово'}
            </span>
            {i < 3 && <ChevronRight size={12} className="text-slate-300" />}
          </div>
        ))}
      </div>

      {step === 'pick' && (
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
            Перетащите Excel-файл (.xlsx) сюда
          </p>
          <p className="text-xs text-slate-400 mb-4">или</p>
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
              Выбрать файл
            </span>
          </label>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Файл: <strong className="text-slate-700 dark:text-slate-200">{fileName}</strong>, {rows.length} строк.
            Проверьте соответствие колонок:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
            {UNIVERSITY_FIELDS.map((f) => (
              <Field key={String(f.key)} label={f.label + (f.required ? ' *' : '')}>
                <select
                  value={mapping[String(f.key)] ?? -1}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [String(f.key)]: Number(e.target.value) }))
                  }
                  className={selectClass}
                >
                  <option value={-1}>— Не импортировать —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Колонка ${i + 1}`}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep('pick')}>Назад</Button>
            <Button onClick={goPreview}>Далее</Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} />Валидных: {validCount}
            </span>
            {invalidCount > 0 && (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle size={14} />Ошибок: {invalidCount}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Стр.</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Название</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Город</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Статус</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Менеджер</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Проблемы</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((p) => (
                  <tr key={p.rowIndex} className={`border-t border-slate-50 dark:border-slate-800 ${p.errors.length ? 'bg-rose-50/40 dark:bg-rose-900/20' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{p.rowIndex + 1}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{p.data.name}</td>
                    <td className="px-3 py-2 text-slate-500">{p.data.city}</td>
                    <td className="px-3 py-2 text-slate-500">{p.data.status}</td>
                    <td className="px-3 py-2 text-slate-500">{p.data.manager}</td>
                    <td className="px-3 py-2 text-rose-600">{p.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep('map')}>Назад</Button>
            <Button onClick={doImport} disabled={busy || validCount === 0}>
              {busy ? 'Импорт…' : `Импортировать ${validCount}`}
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" />
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Импорт завершён</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{result.inserted}</div>
              <div className="text-xs text-emerald-600">Создано</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-sky-50 dark:bg-sky-900/30">
              <div className="text-2xl font-bold text-sky-700 dark:text-sky-300">{result.updated}</div>
              <div className="text-xs text-sky-600">Обновлено</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-violet-50 dark:bg-violet-900/30">
              <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{result.contactsImported ?? 0}</div>
              <div className="text-xs text-violet-600">Контактов</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30">
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{result.failed}</div>
              <div className="text-xs text-rose-600">Ошибок</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {result.errors.map((e, i) => (
                <p key={i}><X size={11} className="inline mr-1" />Строка {e.rowIndex + 1}: {e.message}</p>
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