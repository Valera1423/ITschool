// frontend/src/pages/PublicReportPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, AlertTriangle, Download, BarChart3 } from 'lucide-react';
import { fetchPublicReport } from '@/lib/publicReports';
import { Button, inputClass, EmptyState, StatusBadge, Avatar } from '@/components/ui';
import { formatDate, downloadCSV } from '@/lib/utils';

interface AbcItem {
  university_id: string;
  name: string;
  manager: string;
  value: number;
  share: number;
  category: 'A' | 'B' | 'C';
}
interface RfmResult {
  university_id: string;
  name: string;
  manager: string;
  recency: number;
  frequency: number;
  monetary: number;
  segment: string;
}
interface PeriodComparison {
  metric: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
}
interface ReportUniversity {
  id: string;
  name: string;
  city: string;
  status: string;
  manager: string;
  direction: string;
  product: string;
}

type ReportData =
  | { type: 'universities'; items: ReportUniversity[]; total: number; params: Record<string, unknown> }
  | { type: 'abc-xyz'; abcItems: AbcItem[]; xyzItems: unknown[]; matrix: Record<string, number>; params: Record<string, unknown> }
  | { type: 'rfm'; items: RfmResult[]; params: Record<string, unknown> }
  | { type: 'period-comparison'; items: PeriodComparison[]; params: Record<string, unknown> };

export function PublicReportPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parts = window.location.pathname.split('/public/');
    const raw = parts[1]?.split('?')[0] ?? '';
    setToken(raw || null);
  }, []);

  const load = useCallback(
    async (pwd?: string) => {
      if (!token) {
        setError('Ссылка повреждена');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = (await fetchPublicReport(token, pwd)) as ReportData;
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token === null) return;
    if (token === '') {
      setError('Ссылка повреждена');
      setLoading(false);
      return;
    }
    void load();
  }, [token, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  if (error) {
    const needsPassword =
      error.toLowerCase().includes('пароль') ||
      error.toLowerCase().includes('password');
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3" />
          <h1 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100">
            Не удалось открыть отчёт
          </h1>
          <p className="text-sm text-slate-500 mb-4">{error}</p>

          {needsPassword && (
            <div className="space-y-3 text-left">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className={inputClass}
              />
              <Button onClick={() => void load(password)} className="w-full">
                <Lock size={14} /> Открыть
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <EmptyState text="Нет данных" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Публичный отчёт
            </p>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {reportTitle(data)}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Сгенерирован: {new Date().toLocaleString('ru-RU')}
            </p>
          </div>
          <ExportButton data={data} />
        </header>

        <ReportRenderer data={data} />
      </div>
    </div>
  );
}

// ============================================================
// Рендерер
// ============================================================

function reportTitle(data: ReportData): string {
  switch (data.type) {
    case 'universities': return 'Отчёт по вузам';
    case 'abc-xyz': return 'ABC/XYZ анализ';
    case 'rfm': return 'RFM-сегментация';
    case 'period-comparison': return 'Сравнение периодов';
    default: return 'Отчёт';
  }
}

function ReportRenderer({ data }: { data: ReportData }) {
  switch (data.type) {
    case 'universities':
      return <UniversitiesReport items={data.items} total={data.total} />;
    case 'abc-xyz':
      return <AbcXyzReport items={data.abcItems} matrix={data.matrix} />;
    case 'rfm':
      return <RfmReport items={data.items} />;
    case 'period-comparison':
      return <ComparisonReport items={data.items} />;
    default:
      return <EmptyState text="Неизвестный тип отчёта" />;
  }
}

function UniversitiesReport({
  items,
  total,
}: {
  items: ReportUniversity[];
  total: number;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Всего: <strong className="text-slate-700 dark:text-slate-200">{total}</strong>{' '}
          вузов
        </p>
      </div>
      <div className="table-scroll">
        <div style={{ minWidth: 720 }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <th className="text-left font-medium px-4 py-3">Название</th>
                <th className="text-left font-medium px-4 py-3">Город</th>
                <th className="text-left font-medium px-4 py-3">Направление</th>
                <th className="text-left font-medium px-4 py-3">Продукт</th>
                <th className="text-left font-medium px-4 py-3">Статус</th>
                <th className="text-left font-medium px-4 py-3">Менеджер</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.city}</td>
                  <td className="px-4 py-3 text-slate-500">{u.direction}</td>
                  <td className="px-4 py-3 text-slate-500">{u.product}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.manager} size="sm" />
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {u.manager}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AbcXyzReport({
  items,
  matrix,
}: {
  items: AbcItem[];
  matrix: Record<string, number>;
}) {
  const fmtMoney = (v: number) =>
    new Intl.NumberFormat('ru-RU').format(v) + ' ₽';

  return (
    <div className="space-y-6">
      {/* Матрица */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Матрица ABC × XYZ
        </h2>
        <div className="grid grid-cols-4 gap-2 max-w-2xl">
          <div />
          {(['X', 'Y', 'Z'] as const).map((x) => (
            <div
              key={x}
              className="text-center text-xs font-semibold text-slate-500 py-1"
            >
              {x}
            </div>
          ))}
          {(['A', 'B', 'C'] as const).map((a) => (
            <div key={a} className="contents">
              <div className="text-xs font-semibold text-slate-500 flex items-center">
                {a}
              </div>
              {(['X', 'Y', 'Z'] as const).map((x) => (
                <div
                  key={`${a}${x}`}
                  className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex flex-col items-center justify-center"
                >
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {matrix[`${a}${x}`] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Таблица ABC */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Всего: <strong>{items.length}</strong> записей
          </p>
        </div>
        <div className="table-scroll">
          <div style={{ minWidth: 720 }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="text-left font-medium px-4 py-3">Вуз</th>
                  <th className="text-left font-medium px-4 py-3">Менеджер</th>
                  <th className="text-right font-medium px-4 py-3">Выручка</th>
                  <th className="text-right font-medium px-4 py-3">Доля</th>
                  <th className="text-center font-medium px-4 py-3">ABC</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    key={a.university_id}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {a.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {a.manager}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-100">
                      {fmtMoney(a.value)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {a.share.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                          a.category === 'A'
                            ? 'bg-emerald-100 text-emerald-700'
                            : a.category === 'B'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {a.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RfmReport({ items }: { items: RfmResult[] }) {
  const SEGMENT_LABELS: Record<string, string> = {
    champions: 'Чемпионы',
    loyal: 'Лояльные',
    potential_loyalist: 'Перспективные',
    new: 'Новые',
    at_risk: 'В зоне риска',
    cant_lose: 'Нельзя терять',
    lost: 'Потерянные',
  };

  const groups: Record<string, number> = {};
  items.forEach((r) => {
    groups[r.segment] = (groups[r.segment] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-sky-500" />
          Распределение по сегментам
        </h2>
        <div className="space-y-3">
          {Object.entries(groups).map(([segment, count]) => {
            const pct = items.length ? (count / items.length) * 100 : 0;
            return (
              <div key={segment}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-300">
                    {SEGMENT_LABELS[segment] ?? segment}
                  </span>
                  <strong className="text-slate-700 dark:text-slate-200">
                    {count} ({pct.toFixed(0)}%)
                  </strong>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="table-scroll">
          <div style={{ minWidth: 800 }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="text-left font-medium px-4 py-3">Вуз</th>
                  <th className="text-left font-medium px-4 py-3">Менеджер</th>
                  <th className="text-right font-medium px-4 py-3">R (дн.)</th>
                  <th className="text-right font-medium px-4 py-3">F</th>
                  <th className="text-right font-medium px-4 py-3">M (₽)</th>
                  <th className="text-center font-medium px-4 py-3">Сегмент</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.university_id}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.manager}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {r.recency}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {r.frequency}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-100">
                      {new Intl.NumberFormat('ru-RU').format(r.monetary)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {SEGMENT_LABELS[r.segment] ?? r.segment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonReport({ items }: { items: PeriodComparison[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((p) => {
        const positive = p.change_pct > 0;
        return (
          <div
            key={p.metric}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              {p.metric}
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {p.current_value}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-400">
                было {p.previous_value}
              </span>
              <span
                className={`font-semibold ${
                  p.change_pct === 0
                    ? 'text-slate-400'
                    : positive
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                }`}
              >
                {positive ? '+' : ''}
                {p.change_pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExportButton({ data }: { data: ReportData }) {
  const handleExport = () => {
    let rows: string[][] = [];
    let name = 'report';

    if (data.type === 'universities') {
      name = 'universities';
      rows = [
        ['Название', 'Город', 'Направление', 'Продукт', 'Статус', 'Менеджер'],
        ...data.items.map((u) => [
          u.name,
          u.city,
          u.direction,
          u.product,
          u.status,
          u.manager,
        ]),
      ];
    } else if (data.type === 'abc-xyz') {
      name = 'abc-xyz';
      rows = [
        ['Вуз', 'Менеджер', 'Выручка', 'Доля %', 'Категория'],
        ...data.abcItems.map((a) => [
          a.name,
          a.manager,
          String(a.value),
          a.share.toFixed(1),
          a.category,
        ]),
      ];
    } else if (data.type === 'rfm') {
      name = 'rfm';
      rows = [
        ['Вуз', 'Менеджер', 'R', 'F', 'M', 'Сегмент'],
        ...data.items.map((r) => [
          r.name,
          r.manager,
          String(r.recency),
          String(r.frequency),
          String(r.monetary),
          r.segment,
        ]),
      ];
    } else if (data.type === 'period-comparison') {
      name = 'comparison';
      rows = [
        ['Метрика', 'Текущее', 'Предыдущее', 'Изменение %'],
        ...data.items.map((p) => [
          p.metric,
          String(p.current_value),
          String(p.previous_value),
          String(p.change_pct),
        ]),
      ];
    }

    if (rows.length > 0) {
      downloadCSV(`${name}-${formatDate(new Date().toISOString())}.csv`, rows);
    }
  };

  return (
    <Button variant="secondary" onClick={handleExport}>
      <Download size={15} /> CSV
    </Button>
  );
}