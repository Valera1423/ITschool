import { useMemo, useState } from 'react';
import {
  Columns3,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import type { Interaction, University } from '@/types';
import {
  Button,
  Field,
  inputClass,
  selectClass,
  EmptyState,
  StatusBadge,
  Avatar,
  SimpleModal,
} from '@/components/ui';
import { asArray, downloadCSV, formatDate } from '@/lib/utils';

interface Props {
  interactions: Interaction[];
  universities: University[];
  onNotice: (msg: string) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  defaultOn?: boolean;
}

/** Доступные колонки отчёта — ТЗ п.4.4 */
const REPORT_COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Дата', defaultOn: true },
  { key: 'type', label: 'Тип', defaultOn: true },
  { key: 'title', label: 'Название', defaultOn: true },
  { key: 'university', label: 'Вуз', defaultOn: true },
  { key: 'direction', label: 'ИТ-направление', defaultOn: true },
  { key: 'product', label: 'ИТ-продукт', defaultOn: true },
  { key: 'status', label: 'Статус', defaultOn: true },
  { key: 'manager', label: 'Ответственный', defaultOn: true },
  { key: 'contact_name', label: 'Контакт', defaultOn: false },
  { key: 'contact_email', label: 'Email', defaultOn: false },
  { key: 'contact_phone', label: 'Телефон', defaultOn: false },
  { key: 'city', label: 'Город', defaultOn: false },
  { key: 'details', label: 'Детали', defaultOn: false },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Скачать файл с сервера, подставив Bearer-токен.
 * Простой `<a download>` не подходит, потому что backend требует JWT.
 */
async function downloadFromServer(path: string, filename: string): Promise<void> {
  const { userManager } = await import('@/lib/oidc');
  const user = await userManager.getUser();
  if (!user || user.expired) throw new Error('Сессия истекла — войдите заново');

  const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${user.access_token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || 'ошибка сервера'}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function InteractionsReportPage({
  interactions,
  universities,
  onNotice,
}: Props) {
  const safeInteractions = asArray<Interaction>(interactions);
  const safeUniversities = asArray<University>(universities);

  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoToday());
  const [managerFilter, setManagerFilter] = useState('Все');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [enabledColumns, setEnabledColumns] = useState<string[]>(
    REPORT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key),
  );

  const managers = useMemo(() => {
    const set = new Set(safeInteractions.map((i) => i.manager).filter(Boolean));
    return ['Все', ...Array.from(set)];
  }, [safeInteractions]);

  const rows = useMemo(() => {
    return safeInteractions
      .filter((i) => i.interaction_date >= from && i.interaction_date <= to)
      .filter((i) => managerFilter === 'Все' || i.manager === managerFilter)
      .map((i) => {
        const uni = safeUniversities.find((u) => u.id === i.university_id);
        return {
          date: i.interaction_date,
          type: i.type,
          title: i.title,
          university: uni?.name ?? '—',
          direction: uni?.direction ?? '—',
          product: uni?.product ?? '—',
          status: i.status,
          manager: i.manager,
          contact_name: uni?.contact_name ?? '—',
          contact_email: uni?.contact_email ?? '—',
          contact_phone: uni?.contact_phone ?? '—',
          city: uni?.city ?? '—',
          details: i.details ?? '',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [safeInteractions, safeUniversities, from, to, managerFilter]);

  const activeColumns = REPORT_COLUMNS.filter((c) =>
    enabledColumns.includes(c.key),
  );

  const exportCsv = () => {
    downloadCSV(`interactions-report-${from}_${to}.csv`, [
      activeColumns.map((c) => c.label),
      ...rows.map((r) => activeColumns.map((c) => String((r as never)[c.key] ?? ''))),
    ]);
    onNotice('Отчёт выгружен в CSV.');
  };

  /**
   * Сборка query-строки для серверного экспорта.
   *
   * ВАЖНО (ТЗ п.4.4): фильтр «Ответственный» передаём как managerName
   * через отдельный параметр. Основные фильтры — directionId/productId/
   * managerId — сейчас не используются (в UI их нет), но эндпоинт
   * их принимает.
   */
  const buildExportQuery = (): string => {
    const p = new URLSearchParams();
    p.set('from', from);
    p.set('to', to);
    if (managerFilter !== 'Все') p.set('managerName', managerFilter);
    return p.toString();
  };

  const exportPdf = async () => {
    try {
      await downloadFromServer(
        `/reports/interactions.pdf?${buildExportQuery()}`,
        `interactions-${from}_${to}.pdf`,
      );
      onNotice('PDF сформирован на сервере.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'не удалось'}`);
    }
  };

  const exportJson = () => {
    const out = rows.map((r) => {
      const obj: Record<string, unknown> = {};
      activeColumns.forEach((c) => {
        obj[c.key] = (r as never)[c.key];
      });
      return obj;
    });
    const blob = new Blob(
      [JSON.stringify({ from, to, count: out.length, rows: out }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interactions-report-${from}_${to}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotice('Отчёт выгружен в JSON.');
  };

  const exportXlsx = async () => {
    try {
      await downloadFromServer(
        `/reports/interactions.xlsx?${buildExportQuery()}`,
        `interactions-${from}_${to}.xlsx`,
      );
      onNotice('XLSX сформирован на сервере.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'не удалось'}`);
    }
  };

  const toggleColumn = (key: string) => {
    setEnabledColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Отчёт по ТЗ п.4.4</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Взаимодействия за период
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Колонки: {activeColumns.length} из {REPORT_COLUMNS.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setColumnsOpen(true)}>
            <Columns3 size={15} /> Колонки
          </Button>
          <Button variant="secondary" onClick={() => void exportXlsx()}>
            <FileSpreadsheet size={15} /> XLSX
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> CSV
          </Button>
          <Button variant="secondary" onClick={exportJson}>
            <FileJson size={15} /> JSON
          </Button>
          <Button variant="secondary" onClick={() => void exportPdf()}>
            <FileText size={15} /> PDF
          </Button>
        </div>
      </section>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3">
        <Field label="С даты">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="По дату">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Ответственный">
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className={selectClass}
          >
            {managers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <div className="flex-1" />
        <span className="text-xs text-slate-400 self-center">
          Найдено:{' '}
          <strong className="text-slate-700 dark:text-slate-200">{rows.length}</strong>{' '}
          взаимодействий
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="Нет взаимодействий за период" icon={FileSpreadsheet} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="table-scroll">
            <div style={{ minWidth: Math.max(720, activeColumns.length * 140) }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                    {activeColumns.map((c) => (
                      <th key={c.key} className="text-left font-medium px-4 py-3">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                    >
                      {activeColumns.map((c) => {
                        const value = (r as never)[c.key];
                        if (c.key === 'date') {
                          return (
                            <td key={c.key} className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {formatDate(String(value))}
                            </td>
                          );
                        }
                        if (c.key === 'status') {
                          return (
                            <td key={c.key} className="px-4 py-3">
                              <StatusBadge status={String(value)} />
                            </td>
                          );
                        }
                        if (c.key === 'manager') {
                          return (
                            <td key={c.key} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={String(value)} size="sm" />
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                  {String(value)}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={c.key}
                            className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-xs truncate"
                          >
                            {String(value ?? '—') || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {columnsOpen && (
        <SimpleModal
          title="Выбор колонок отчёта"
          onClose={() => setColumnsOpen(false)}
          wide
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Отметьте, какие колонки выгружать в отчёт
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setEnabledColumns(REPORT_COLUMNS.map((c) => c.key))
                  }
                  className="text-xs text-sky-600 hover:underline"
                >
                  Выбрать все
                </button>
                <button
                  onClick={() => setEnabledColumns([])}
                  className="text-xs text-slate-400 hover:underline"
                >
                  Снять все
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {REPORT_COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledColumns.includes(c.key)}
                    onChange={() => toggleColumn(c.key)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setColumnsOpen(false)}>Готово</Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}