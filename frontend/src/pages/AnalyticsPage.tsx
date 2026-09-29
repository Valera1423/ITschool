import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Layers,
  RefreshCw,
  Filter,
  Trophy,
  AlertTriangle,
  Download,
} from 'lucide-react';
import type {
  UniversityMetrics,
  PeriodComparison,
  RfmResult,
} from '@/types';
import {
  fetchUniversityMetrics,
  fetchAbcXyz,
  fetchRfm,
  fetchCohortRetention,
  fetchLtv,
  fetchPeriodComparison,
  defaultPeriods,
  rfmDistribution,
  RFM_SEGMENT_LABELS,
  type AbcItem,
  type XyzItem,
  type AbcXyzMatrix,
  type LtvEstimate,
  type CohortPivot,
} from '@/lib/analytics';
import { CategoryBadge, SegmentBadge } from '@/components/analytics/SegmentBadge';
import {
  Button,
  Field,
  inputClass,
  EmptyState,
  Avatar,
} from '@/components/ui';
import { ChartWrapper, ExportAllPdfButton } from '@/components/ChartWrapper';
import { useChartElements } from '@/hooks/useChartExport';
import { downloadCSV, downloadJson, asArray } from '@/lib/utils';

type Tab = 'comparison' | 'abc' | 'rfm' | 'cohort' | 'ltv';

interface Props {
  onNotice: (msg: string) => void;
}

export function AnalyticsPage({ onNotice }: Props) {
  const [tab, setTab] = useState<Tab>('comparison');
  const [metrics, setMetrics] = useState<UniversityMetrics[]>([]);
  const [abc, setAbc] = useState<AbcItem[]>([]);
  const [xyz, setXyz] = useState<XyzItem[]>([]);
  const [matrix, setMatrix] = useState<AbcXyzMatrix>({
    AX: 0, AY: 0, AZ: 0,
    BX: 0, BY: 0, BZ: 0,
    CX: 0, CY: 0, CZ: 0,
  });
  const [rfm, setRfm] = useState<RfmResult[]>([]);
  const [cohorts, setCohorts] = useState<CohortPivot[]>([]);
  const [ltv, setLtv] = useState<LtvEstimate[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison[]>([]);
  const [periods, setPeriods] = useState(defaultPeriods());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const { getElements } = useChartElements();

  // Защита от undefined — единообразно
  const safeComparison = asArray<PeriodComparison>(comparison);
  const safeAbc = asArray<AbcItem>(abc);
  const safeXyz = asArray<XyzItem>(xyz);
  const safeRfm = asArray<RfmResult>(rfm);
  const safeCohorts = asArray<CohortPivot>(cohorts);
  const safeLtv = asArray<LtvEstimate>(ltv);
  const safeMetrics = asArray<UniversityMetrics>(metrics);

  const load = async () => {
    setLoading(true);
    try {
      const [m, abcData, rfmData, cohortData, ltvData, cmp] = await Promise.all([
        fetchUniversityMetrics(periods.from, periods.to),
        fetchAbcXyz(periods.from, periods.to),
        fetchRfm(),
        fetchCohortRetention(12),
        fetchLtv(),
        fetchPeriodComparison(
          periods.from,
          periods.to,
          periods.prevFrom,
          periods.prevTo,
        ),
      ]);

      setMetrics(m);
      setAbc(abcData.abcItems);
      setXyz(abcData.xyzItems);
      setMatrix(abcData.matrix);
      setRfm(rfmData);
      setCohorts(cohortData);
      setLtv(ltvData);
      setComparison(cmp);
    } catch {
      onNotice('Не удалось загрузить аналитику.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAbc = useMemo(
    () => (filter ? safeAbc.filter((a) => a.category === filter) : safeAbc),
    [safeAbc, filter],
  );

  const filteredRfm = useMemo(
    () => (filter ? safeRfm.filter((r) => r.segment === filter) : safeRfm),
    [safeRfm, filter],
  );

  const rfmDist = useMemo(() => rfmDistribution(safeRfm), [safeRfm]);

  const xyzMap = useMemo(
    () => new Map(safeXyz.map((x) => [x.university_id, x])),
    [safeXyz],
  );

  const totalLtv = useMemo(
    () => safeLtv.reduce((s, x) => s + x.lifetime_value, 0),
    [safeLtv],
  );

  const avgLtv = useMemo(
    () => (safeLtv.length ? totalLtv / safeLtv.length : 0),
    [safeLtv, totalLtv],
  );

  const exportAbc = () => {
    downloadCSV('abc-xyz.csv', [
      [
        'Название',
        'Менеджер',
        'Выручка',
        'Доля %',
        'Категория ABC',
        'CV',
        'Категория XYZ',
      ],
      ...safeAbc.map((a) => {
        const x = xyzMap.get(a.university_id);
        return [
          a.name,
          a.manager,
          String(a.value),
          a.share.toFixed(1),
          a.category,
          (x?.cv ?? 0).toFixed(3),
          x?.category ?? '—',
        ];
      }),
    ]);
    onNotice('ABC/XYZ выгружено.');
  };

  const exportRfm = () => {
    downloadCSV('rfm.csv', [
      ['Вуз', 'Менеджер', 'R', 'F', 'M', 'R-балл', 'F-балл', 'M-балл', 'Сегмент'],
      ...safeRfm.map((r) => [
        r.name,
        r.manager,
        String(r.recency),
        String(r.frequency),
        String(r.monetary),
        String(r.r_score),
        String(r.f_score),
        String(r.m_score),
        RFM_SEGMENT_LABELS[r.segment],
      ]),
    ]);
    onNotice('RFM выгружено.');
  };

  const exportLtv = () => {
    downloadJson('ltv.json', safeLtv);
    onNotice('LTV выгружено.');
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Глубокий анализ</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Аналитика
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ABC/XYZ, RFM, когорты, LTV, сравнение периодов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Обновить"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <ExportAllPdfButton
            getElements={getElements}
            filename={`analytics-${periods.from}_${periods.to}`}
            onNotice={onNotice}
          />
        </div>
      </section>

      {/* Табы */}
      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {(
          [
            { key: 'comparison', label: 'Сравнение', icon: TrendingUp },
            { key: 'abc', label: 'ABC/XYZ', icon: BarChart3 },
            { key: 'rfm', label: 'RFM', icon: Users },
            { key: 'cohort', label: 'Когорты', icon: Layers },
            { key: 'ltv', label: 'LTV', icon: Target },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Расчёт метрик…</p>
      ) : safeMetrics.length === 0 ? (
        <EmptyState
          text="Нет данных для анализа"
          hint="Добавьте вузы и взаимодействия"
        />
      ) : (
        <>
          {/* Сравнение периодов */}
          {tab === 'comparison' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3">
                <Field label="Текущий с">
                  <input
                    type="date"
                    value={periods.from}
                    onChange={(e) =>
                      setPeriods({ ...periods, from: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="по">
                  <input
                    type="date"
                    value={periods.to}
                    onChange={(e) =>
                      setPeriods({ ...periods, to: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Предыдущий с">
                  <input
                    type="date"
                    value={periods.prevFrom}
                    onChange={(e) =>
                      setPeriods({ ...periods, prevFrom: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="по">
                  <input
                    type="date"
                    value={periods.prevTo}
                    onChange={(e) =>
                      setPeriods({ ...periods, prevTo: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Button onClick={() => void load()}>
                  <Filter size={14} />
                  Применить
                </Button>
              </div>

              <ChartWrapper title="Сравнение периодов" filename="analytics-comparison">
                <div data-chart-export data-chart-title="Сравнение периодов">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {safeComparison.map((p) => {
                      const positive = p.change_pct > 0;
                      const neutral = p.change_pct === 0;
                      const isMoney = p.metric === 'Выручка';
                      const fmt = (v: number) =>
                        isMoney
                          ? new Intl.NumberFormat('ru-RU', {
                              maximumFractionDigits: 0,
                            }).format(v) + ' ₽'
                          : new Intl.NumberFormat('ru-RU').format(v);
                      return (
                        <div
                          key={p.metric}
                          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
                        >
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                            {p.metric}
                          </p>
                          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            {fmt(p.current_value)}
                          </p>
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className="text-slate-400">
                              было {fmt(p.previous_value)}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-semibold ${
                                neutral
                                  ? 'text-slate-400'
                                  : positive
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                              }`}
                            >
                              {neutral ? (
                                '·'
                              ) : positive ? (
                                <TrendingUp size={12} />
                              ) : (
                                <TrendingDown size={12} />
                              )}
                              {p.change_pct > 0 ? '+' : ''}
                              {p.change_pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ChartWrapper>
            </div>
          )}

          {/* ABC/XYZ */}
          {tab === 'abc' && (
            <div className="space-y-4">
              <ChartWrapper title="Матрица ABC × XYZ" filename="chart-abc-xyz">
                <div data-chart-export data-chart-title="Матрица ABC × XYZ">
                  <div className="grid grid-cols-4 gap-2 max-w-2xl">
                    <div />
                    {(['X', 'Y', 'Z'] as const).map((x) => (
                      <div
                        key={x}
                        className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-1"
                      >
                        {x === 'X'
                          ? 'X (стабильно)'
                          : x === 'Y'
                            ? 'Y (средне)'
                            : 'Z (нестабильно)'}
                      </div>
                    ))}
                    {(['A', 'B', 'C'] as const).map((a) => (
                      <Fragment key={a}>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center">
                          {a === 'A'
                            ? 'A (топ)'
                            : a === 'B'
                              ? 'B (средн.)'
                              : 'C (низ)'}
                        </div>
                        {(['X', 'Y', 'Z'] as const).map((x) => {
                          const count = matrix[`${a}${x}`] ?? 0;
                          const color =
                            a === 'A' && x === 'X'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200'
                              : a === 'C' && x === 'Z'
                                ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';
                          return (
                            <div
                              key={`${a}${x}`}
                              className={`aspect-square rounded-xl border flex flex-col items-center justify-center ${color}`}
                            >
                              <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {count}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {a}
                                {x}
                              </span>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p>
                      <strong className="text-emerald-600">AX</strong> — ключевые
                      надёжные партнёры.
                    </p>
                    <p>
                      <strong className="text-rose-600">CZ</strong> — низкая
                      ценность + нестабильность.
                    </p>
                  </div>
                </div>
              </ChartWrapper>

              <div className="flex flex-wrap gap-2">
                {['', 'A', 'B', 'C'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filter === c
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {c === ''
                      ? `Все (${safeAbc.length})`
                      : `Категория ${c} (${safeAbc.filter((x) => x.category === c).length})`}
                  </button>
                ))}
                <div className="flex-1" />
                <Button variant="secondary" size="sm" onClick={exportAbc}>
                  <Download size={13} />
                  Экспорт
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="table-scroll">
                  <div style={{ minWidth: 800 }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                          <th className="text-left font-medium px-4 py-3">
                            Вуз
                          </th>
                          <th className="text-left font-medium px-4 py-3">
                            Менеджер
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            Выручка
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            Доля
                          </th>
                          <th className="text-center font-medium px-4 py-3">
                            ABC
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            CV
                          </th>
                          <th className="text-center font-medium px-4 py-3">
                            XYZ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAbc.map((a) => {
                          const x = xyzMap.get(a.university_id);
                          return (
                            <tr
                              key={a.university_id}
                              className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                            >
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                                {a.name}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Avatar name={a.manager} size="sm" />
                                  {a.manager}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-100">
                                {new Intl.NumberFormat('ru-RU').format(a.value)}{' '}
                                ₽
                              </td>
                              <td className="px-4 py-3 text-right text-slate-500">
                                {a.share.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-center">
                                <CategoryBadge category={a.category} />
                              </td>
                              <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                {(x?.cv ?? 0).toFixed(3)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {x ? (
                                  <CategoryBadge category={x.category} />
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RFM */}
          {tab === 'rfm' && (
            <div className="space-y-4">
              <ChartWrapper title="RFM — распределение" filename="chart-rfm">
                <div data-chart-export data-chart-title="RFM — распределение">
                  <div className="space-y-2">
                    {rfmDist.map((d) => (
                      <div key={d.segment} className="flex items-center gap-3">
                        <div className="w-40">
                          <SegmentBadge segment={d.segment} />
                        </div>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full"
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300 w-20 text-right">
                          {d.count} ({d.pct.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartWrapper>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === ''
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Все ({safeRfm.length})
                </button>
                {rfmDist.map((d) => (
                  <button
                    key={d.segment}
                    onClick={() => setFilter(d.segment)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filter === d.segment
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {RFM_SEGMENT_LABELS[d.segment]} ({d.count})
                  </button>
                ))}
                <div className="flex-1" />
                <Button variant="secondary" size="sm" onClick={exportRfm}>
                  <Download size={13} />
                  Экспорт
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="table-scroll">
                  <div style={{ minWidth: 900 }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                          <th className="text-left font-medium px-4 py-3">
                            Вуз
                          </th>
                          <th className="text-left font-medium px-4 py-3">
                            Менеджер
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            R (дн.)
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            F
                          </th>
                          <th className="text-right font-medium px-4 py-3">
                            M (₽)
                          </th>
                          <th className="text-center font-medium px-4 py-3">
                            R/F/M
                          </th>
                          <th className="text-center font-medium px-4 py-3">
                            Сегмент
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRfm.map((r) => (
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
                            <td className="px-4 py-3 text-center text-xs font-mono">
                              <span className="text-sky-600">{r.r_score}</span>/
                              <span className="text-violet-600">
                                {r.f_score}
                              </span>
                              /
                              <span className="text-emerald-600">
                                {r.m_score}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <SegmentBadge segment={r.segment} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Когорты */}
          {tab === 'cohort' && (
            <ChartWrapper title="Когортный retention" filename="chart-cohorts">
              <div data-chart-export data-chart-title="Когортный retention">
                {safeCohorts.length === 0 ? (
                  <EmptyState text="Нет когортных данных" />
                ) : (
                  <div className="table-scroll">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left font-medium text-slate-500 px-3 py-2 text-xs">
                            Когорта
                          </th>
                          <th className="text-center font-medium text-slate-500 px-3 py-2 text-xs">
                            Размер
                          </th>
                          {Array.from({
                            length: Math.max(
                              ...safeCohorts.map((c) => c.periods.length),
                              1,
                            ),
                          }).map((_, i) => (
                            <th
                              key={i}
                              className="text-center font-medium text-slate-500 px-3 py-2 text-xs"
                            >
                              M{i}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {safeCohorts.map((c) => {
                          const byOffset: Record<number, number> = {};
                          c.periods.forEach((p) => {
                            byOffset[p.offset] = p.retention;
                          });
                          const maxOffset = Math.max(
                            ...c.periods.map((p) => p.offset),
                            0,
                          );

                          return (
                            <tr key={c.cohort}>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                                {new Intl.DateTimeFormat('ru-RU', {
                                  month: 'short',
                                  year: 'numeric',
                                }).format(new Date(`${c.cohort}-01`))}
                              </td>
                              <td className="px-3 py-2 text-center text-slate-500">
                                {c.cohort_size}
                              </td>
                              {Array.from({ length: maxOffset + 1 }).map(
                                (_, i) => {
                                  const p = byOffset[i];
                                  const color =
                                    p === undefined
                                      ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-300'
                                      : p >= 80
                                        ? 'bg-emerald-500 text-white'
                                        : p >= 60
                                          ? 'bg-emerald-400 text-white'
                                          : p >= 40
                                            ? 'bg-amber-400 text-white'
                                            : p >= 20
                                              ? 'bg-orange-400 text-white'
                                              : p > 0
                                                ? 'bg-rose-400 text-white'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400';
                                  return (
                                    <td key={i} className="p-1">
                                      <div
                                        className={`h-8 rounded flex items-center justify-center text-xs font-semibold ${color}`}
                                      >
                                        {p !== undefined ? `${p}%` : ''}
                                      </div>
                                    </td>
                                  );
                                },
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ChartWrapper>
          )}

          {/* LTV */}
          {tab === 'ltv' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Суммарный LTV
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {new Intl.NumberFormat('ru-RU').format(
                      Math.round(totalLtv),
                    )}{' '}
                    ₽
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Средний LTV
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {new Intl.NumberFormat('ru-RU').format(
                      Math.round(avgLtv),
                    )}{' '}
                    ₽
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Вузов в базе
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {safeLtv.length}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Trophy size={18} className="text-amber-500" /> Топ-10 по
                    LTV
                  </h2>
                  <Button variant="secondary" size="sm" onClick={exportLtv}>
                    <Download size={13} />
                    Экспорт
                  </Button>
                </div>
                <ChartWrapper title="Топ-10 по LTV" filename="analytics-ltv">
                  <div data-chart-export data-chart-title="Топ-10 по LTV">
                    <div className="space-y-2">
                      {safeLtv.slice(0, 10).map((d, i) => (
                        <div
                          key={d.university_id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                              i === 0
                                ? 'bg-amber-100 text-amber-700'
                                : i === 1
                                  ? 'bg-slate-200 text-slate-700'
                                  : i === 2
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {d.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {d.manager} ·{' '}
                              {d.lifetime_months ?? d.months_in_base} мес. в базе
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {new Intl.NumberFormat('ru-RU').format(
                                d.lifetime_value,
                              )}{' '}
                              ₽
                            </p>
                            <p className="text-xs text-emerald-600">
                              +
                              {new Intl.NumberFormat('ru-RU').format(
                                d.projected_12m,
                              )}{' '}
                              ₽ / 12 мес
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartWrapper>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Низкий
                  LTV
                </h2>
                <div className="space-y-2">
                  {safeLtv
                    .slice(-5)
                    .reverse()
                    .map((d) => (
                      <div
                        key={d.university_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {d.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {d.manager}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          {new Intl.NumberFormat('ru-RU').format(
                            d.lifetime_value,
                          )}{' '}
                          ₽
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}