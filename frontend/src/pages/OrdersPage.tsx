// frontend/src/pages/OrdersPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { FileJson, Upload } from 'lucide-react';
import type { Order } from '@/types';
import {
  listOrders,
  importOrders,
  fetchOrderStats,
  type OrderImportResult,
  type OrderStats,
} from '@/lib/orders';
import { Button, EmptyState, StatusBadge, Avatar } from '@/components/ui';
import { asArray, formatDate } from '@/lib/utils';

interface Props {
  onNotice: (msg: string) => void;
}

interface RawPaymentRow {
  'Номер заявки': string;
  'Курс': string;
  'Фамилия': string;
  'Имя': string;
  'Отчество': string;
  'Телефон': string;
  'Email': string;
  'Номер потока': number;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  const map: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    violet:
      'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    emerald:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return (
    <div className={`rounded-2xl p-5 ${map[color] ?? map.sky}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export function OrdersPage({ onNotice }: Props) {
  const [items, setItems] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<OrderImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        listOrders({ pageSize: 200 }),
        fetchOrderStats(),
      ]);
      setItems(asArray(list));
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        onNotice('Файл должен быть JSON.');
        return;
      }

      if (!Array.isArray(parsed)) {
        onNotice('Ожидался массив заявок.');
        return;
      }

      const rows = (parsed as Array<RawPaymentRow | null>)
        .filter((r): r is RawPaymentRow => !!r && typeof r === 'object')
        .map((r) => ({
          externalId: r['Номер заявки'],
          courseName: r['Курс'],
          lastName: r['Фамилия'],
          firstName: r['Имя'],
          middleName: r['Отчество'] || null,
          phone: r['Телефон'] || null,
          email: r['Email'] || null,
          streamNumber: Number(r['Номер потока']) || 1,
        }));

      if (rows.length === 0) {
        onNotice('Файл пустой.');
        return;
      }

      const result = await importOrders(rows);
      setImportResult(result);
      onNotice(
        `Импорт: +${result.inserted}, пропущено ${result.skipped}, ошибок ${result.failed}`,
      );
      await load();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Заявки на курсы</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Заявки
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Идемпотентно по «Номер заявки». Слушатели создаются автоматически.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept=".json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void handleFile(f);
            }}
          />
          <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-sky-600 hover:bg-sky-700">
            <Upload size={15} /> {busy ? 'Импорт…' : 'Загрузить JSON'}
          </span>
        </label>
      </section>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Всего заявок" value={stats.totalOrders} color="sky" />
          <StatCard
            label="За 30 дней"
            value={stats.newOrdersLast30d}
            color="violet"
          />
          <StatCard
            label="Оплачено"
            value={stats.paidOrders}
            color="emerald"
          />
          <StatCard
            label="Конверсия"
            value={`${stats.conversionPct}%`}
            color="amber"
          />
        </div>
      )}

      {importResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Результат импорта
            </p>
            <button
              onClick={() => setImportResult(null)}
              className="text-xs text-slate-400"
            >
              Скрыть
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-700">Создано</p>
              <p className="text-xl font-bold">{importResult.inserted}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <p className="text-xs text-slate-700">Пропущено</p>
              <p className="text-xl font-bold">{importResult.skipped}</p>
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
          text="Заявок нет"
          hint="Импортируйте файл оплат.json"
          icon={FileJson}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="text-left font-medium px-4 py-3">№ заявки</th>
                  <th className="text-left font-medium px-4 py-3">Курс</th>
                  <th className="text-left font-medium px-4 py-3">Поток</th>
                  <th className="text-left font-medium px-4 py-3">Слушатель</th>
                  <th className="text-left font-medium px-4 py-3">Статус</th>
                  <th className="text-left font-medium px-4 py-3">Создано</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const fullName = o.learner
                    ? `${o.learner.last_name} ${o.learner.first_name}`.trim()
                    : '—';
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {o.external_id}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {o.course?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {o.stream ? `№${o.stream.number}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={fullName} size="sm" />
                          <span className="text-slate-700 dark:text-slate-200">
                            {fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(o.created_at.slice(0, 10))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}