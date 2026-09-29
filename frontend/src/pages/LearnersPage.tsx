// frontend/src/pages/LearnersPage.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Learner } from '@/types';
import {
  listLearners,
  deleteLearner,
  type LearnerImportResult,
} from '@/lib/learners';
import {
  parseLearnersExcel,
  importParsedLearners,
} from '@/lib/learnersExcel';
import {
  Button,
  EmptyState,
  inputClass,
  Avatar,
} from '@/components/ui';
import { asArray } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { LearnerDetailModal } from '@/components/LearnerDetailModal';

interface Props {
  onNotice: (msg: string) => void;
}

export function LearnersPage({ onNotice }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [selected, setSelected] = useState<Learner | null>(null);
  const [importResult, setImportResult] = useState<LearnerImportResult | null>(null);
  const [busyImport, setBusyImport] = useState(false);

  const canDelete = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listLearners({
        pageSize: 200,
        search: debounced || undefined,
      });
      setItems(asArray(list));
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (l: Learner) => {
    if (!window.confirm(`Удалить слушателя «${l.last_name} ${l.first_name}»?`)) {
      return;
    }
    const err = await deleteLearner(l.id);
    onNotice(err ? `Ошибка: ${err}` : 'Удалено.');
    if (!err) await load();
  };

  const handleFile = async (file: File) => {
    setBusyImport(true);
    try {
      const { rows, unknownHeaders } = await parseLearnersExcel(file);
      if (unknownHeaders.length > 0) {
        onNotice(
          `Неизвестные колонки: ${unknownHeaders.slice(0, 3).join(', ')}${
            unknownHeaders.length > 3 ? '…' : ''
          }`,
        );
      }
      if (rows.length === 0) {
        onNotice('Файл пустой или не соответствует шаблону.');
        return;
      }
      const result = await importParsedLearners(rows, 'upsert');
      setImportResult(result);
      onNotice(
        `Импорт: +${result.inserted}, обновлено ${result.updated}, ошибок ${result.failed}`,
      );
      await load();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка чтения файла.');
    } finally {
      setBusyImport(false);
    }
  };

  const exportFile = async (kind: 'xlsx' | 'pdf') => {
    try {
      const { userManager } = await import('@/lib/oidc');
      const u = await userManager.getUser();
      if (!u || u.expired) {
        onNotice('Сессия истекла.');
        return;
      }
      const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(
        `${apiBase}/learners/export.${kind}?search=${encodeURIComponent(debounced)}`,
        { headers: { Authorization: `Bearer ${u.access_token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learners-${new Date().toISOString().slice(0, 10)}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Слушатели курсов</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Слушатели
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ПД уровня УЗ-1 — просмотр и импорт доступны с 2FA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportFile('xlsx')}>
            <FileSpreadsheet size={15} /> XLSX
          </Button>
          <Button variant="secondary" onClick={() => void exportFile('pdf')}>
            <FileText size={15} /> PDF
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={busyImport}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleFile(f);
              }}
            />
            <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50">
              <Upload size={15} />
              {busyImport ? 'Импорт…' : 'Загрузить Excel'}
            </span>
          </label>
        </div>
      </section>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ФИО"
          className={`${inputClass} pl-10`}
        />
      </div>

      {importResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Результат импорта
            </p>
            <button
              onClick={() => setImportResult(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Скрыть
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-700">Создано</p>
              <p className="text-xl font-bold">{importResult.inserted}</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20">
              <p className="text-xs text-sky-700">Обновлено</p>
              <p className="text-xl font-bold">{importResult.updated}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20">
              <p className="text-xs text-rose-700">Ошибок</p>
              <p className="text-xl font-bold">{importResult.failed}</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-rose-500 cursor-pointer">
                Показать ошибки ({importResult.errors.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600">
                    Строка {e.rowIndex}: {e.message}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : items.length === 0 ? (
        <EmptyState
          text="Слушателей нет"
          hint="Импортируйте файл из Excel"
          icon={FileSpreadsheet}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="text-left font-medium px-4 py-3">ФИО</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Телефон</th>
                  <th className="text-left font-medium px-4 py-3">СНИЛС</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(l)}
                        className="flex items-center gap-2 text-left"
                      >
                        <Avatar
                          name={`${l.last_name} ${l.first_name}`}
                          size="sm"
                        />
                        <span className="text-slate-700 dark:text-slate-200">
                          {l.last_name} {l.first_name} {l.middle_name ?? ''}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {l.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {l.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {l.snils ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <button
                          onClick={() => void handleDelete(l)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                          aria-label="Удалить"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <LearnerDetailModal
          learnerId={selected.id}
          onClose={() => setSelected(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}