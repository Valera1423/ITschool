import { useState } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { downloadExport, downloadTemplate, uploadImport, type ImportResult } from '@/lib/excelSync';
import { Button, SimpleModal } from '@/components/ui';

interface Props {
  entity: 'universities' | 'tasks' | 'interactions';
  filters?: Record<string, unknown>;
  onImported?: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function ExcelSyncPanel({ entity, filters, onImported, onNotice }: Props) {
  const [busy, setBusy] = useState<'export' | 'import' | 'template' | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleExport = async () => {
    setBusy('export');
    try {
      await downloadExport(entity, filters);
      onNotice('Файл скачан. Редактируйте его в Excel и загрузите обратно.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(null);
    }
  };

  const handleTemplate = async () => {
    setBusy('template');
    try {
      await downloadTemplate(entity);
      onNotice('Шаблон скачан.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    setBusy('import');
    try {
      const r = await uploadImport(entity, file);
      setResult(r);
      onNotice(`Импорт завершён: +${r.updated} изменено, ${r.failed} ошибок`);
      if (onImported) await onImported();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void handleExport()} disabled={!!busy}>
          <Download size={15} /> {busy === 'export' ? 'Готовим…' : 'Скачать Excel'}
        </Button>
        <Button variant="secondary" onClick={() => void handleTemplate()} disabled={!!busy}>
          <FileSpreadsheet size={15} /> {busy === 'template' ? 'Готовим…' : 'Шаблон'}
        </Button>
        <label className="inline-flex">
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void handleImport(f);
            }}
          />
          <span
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 ${
              busy ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <Upload size={15} /> {busy === 'import' ? 'Импорт…' : 'Загрузить Excel'}
          </span>
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Скачайте файл → отредактируйте в Excel → загрузите. Изменённые строки обновятся,
        в колонке «_delete» поставьте «да», чтобы удалить строку.
      </p>

      {result && (
        <SimpleModal title="Результат импорта" onClose={() => setResult(null)} wide>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Обновлено" value={result.updated} color="sky" />
            <Stat label="Без изменений" value={result.unchanged} color="slate" />
            <Stat label="Удалено" value={result.deleted} color="amber" />
            <Stat label="Ошибок" value={result.failed} color={result.failed > 0 ? 'rose' : 'emerald'} />
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-rose-600 mb-2 flex items-center gap-1">
                <AlertTriangle size={14} /> Ошибки ({result.errors.length})
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600">
                    Строка {e.row}: {e.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {result.errors.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={16} /> Импорт прошёл без ошибок
            </div>
          )}
        </SimpleModal>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  };
  return (
    <div className={`p-3 rounded-xl ${colors[color] ?? colors.slate}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}