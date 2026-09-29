import { useState } from 'react';
import { X, Plus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Button,
  EmptyState,
  SimpleModal,
  Avatar,
  StatusBadge,
} from '@/components/ui';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { asArray, formatDate } from '@/lib/utils';
import type { University } from '@/types';

interface CompareRow {
  id: string;
  name: string;
  city: string;
  direction: string;
  product: string;
  status: string;
  manager: string;
  contractValue: number;
  contractsTotal: number;
  contractsCount: number;
  interactionsCount: number;
  openTasksCount: number;
  lastTouchAt: string | null;
  licenseSigned: boolean;
  licenseExpiresAt: string | null;
  handoverStatus: string;
}

interface Props {
  universities: University[];
  onNotice: (msg: string) => void;
}

const MAX_COMPARE = 20;

/** Индекс, до которого подсвечиваем best/worst. Дальше — серым. */
const HIGHLIGHT_LIMIT = 10;

export function ComparePage({ universities, onNotice }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<CompareRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [comparing, setComparing] = useState(false);

  const safeUniversities = asArray<University>(universities);

  const compare = async () => {
    if (selected.length < 2) return;
    setComparing(true);
    try {
      const result = await api.post<CompareRow[]>(
        '/compare/universities',
        { ids: selected },
      );
      setData(asArray(result));
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setComparing(false);
    }
  };

  const removeUniversity = (id: string) => {
    setSelected((s) => s.filter((x) => x !== id));
    setData((d) => d.filter((x) => x.id !== id));
  };

  const toggleUniversity = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_COMPARE) return s;
      return [...s, id];
    });
  };

  const rows: {
    label: string;
    key: keyof CompareRow;
    format?: (v: unknown) => string;
    highlight?: 'max' | 'min';
  }[] = [
    { label: 'Город', key: 'city' },
    { label: 'Направление', key: 'direction' },
    { label: 'Продукт', key: 'product' },
    { label: 'Статус', key: 'status' },
    { label: 'Менеджер', key: 'manager' },
    {
      label: 'Сумма договоров',
      key: 'contractsTotal',
      format: (v) =>
        new Intl.NumberFormat('ru-RU').format(Number(v)) + ' ₽',
      highlight: 'max',
    },
    {
      label: 'Кол-во договоров',
      key: 'contractsCount',
      highlight: 'max',
    },
    {
      label: 'Взаимодействий',
      key: 'interactionsCount',
      highlight: 'max',
    },
    { label: 'Открытых задач', key: 'openTasksCount' },
    {
      label: 'Последнее касание',
      key: 'lastTouchAt',
      format: (v) =>
        v ? formatDate(String(v).slice(0, 10)) : '—',
    },
    {
      label: 'Лицензия',
      key: 'licenseSigned',
      format: (v) => (v ? '✓ Подписана' : '—'),
    },
    {
      label: 'Срок лицензии',
      key: 'licenseExpiresAt',
      format: (v) => (v ? formatDate(String(v).slice(0, 10)) : '—'),
    },
    { label: 'Передача ПО', key: 'handoverStatus' },
  ];

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Бок о бок</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Сравнение вузов
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Выберите от 2 до {MAX_COMPARE} вузов, чтобы сравнить ключевые
            метрики.
          </p>
        </div>
        <Button onClick={() => setPickerOpen(true)}>
          <Plus size={18} /> Добавить вуз
        </Button>
      </section>

      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            {selected.map((id) => {
              const u = safeUniversities.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
                >
                  {u?.name ?? id.slice(0, 8)}
                  <button
                    onClick={() => removeUniversity(id)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Убрать из сравнения"
                  >
                    <X size={14} />
                  </button>
                </span>
              );
            })}
            {selected.length >= 2 && (
              <Button
                onClick={() => void compare()}
                size="sm"
                loading={comparing}
              >
                Сравнить ({selected.length})
              </Button>
            )}
          </div>

          {selected.length > 10 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
              ⚠️ Сравнение {selected.length} вузов — рекомендуем не более 10 для читаемости.
              Подсветка лучших/худших значений работает только для первых 10.
            </div>
          )}
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState
          text="Пока нет данных для сравнения"
          hint="Добавьте хотя бы два вуза"
          icon={TrendingUp}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <ResponsiveTable minWidth={220 + data.length * 180}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-400 text-xs sticky left-0 bg-white dark:bg-slate-900 z-10">
                    Характеристика
                  </th>
                  {data.map((u, idx) => (
                    <th
                      key={u.id}
                      className={`text-left px-4 py-3 min-w-[180px] ${
                        idx >= HIGHLIGHT_LIMIT
                          ? 'text-slate-400 dark:text-slate-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} size="sm" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {u.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let bestValue: unknown = null;
                  let worstValue: unknown = null;

                  if (row.highlight) {
                    const values = data.map((u) => Number(u[row.key]));
                    const best =
                      row.highlight === 'max'
                        ? Math.max(...values)
                        : Math.min(...values);
                    const worst =
                      row.highlight === 'max'
                        ? Math.min(...values)
                        : Math.max(...values);
                    bestValue = best;
                    worstValue = worst;
                  }

                  return (
                    <tr
                      key={String(row.key)}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs sticky left-0 bg-slate-50 dark:bg-slate-800/40 z-10">
                        {row.label}
                      </td>
                      {data.map((u, idx) => {
                        const raw = u[row.key];
                        const display = row.format
                          ? row.format(raw)
                          : String(raw ?? '—');
                        // Подсветка только для первых HIGHLIGHT_LIMIT вузов,
                        // чтобы при 20+ колонках не рябило от цветов.
                        const inHighlightRange = idx < HIGHLIGHT_LIMIT;
                        const isBest =
                          inHighlightRange &&
                          row.highlight &&
                          Number(raw) === Number(bestValue);
                        const isWorst =
                          inHighlightRange &&
                          row.highlight &&
                          Number(raw) === Number(worstValue) &&
                          data.length > 1 &&
                          !isBest;

                        return (
                          <td
                            key={u.id}
                            className={`px-4 py-3 ${
                              isBest
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                                : isWorst
                                  ? 'bg-rose-50/60 dark:bg-rose-900/10 text-rose-600 dark:text-rose-300'
                                  : idx >= HIGHLIGHT_LIMIT
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      {pickerOpen && (
        <SimpleModal
          title="Выберите вузы"
          onClose={() => setPickerOpen(false)}
          wide
        >
          <div className="max-h-96 overflow-y-auto space-y-1">
            {safeUniversities.map((u) => {
              const checked = selected.includes(u.id);
              const disabled = !checked && selected.length >= MAX_COMPARE;
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUniversity(u.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors disabled:opacity-50 ${
                    checked
                      ? 'bg-sky-50 dark:bg-sky-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      checked ? 'bg-sky-500 border-sky-500' : 'border-slate-300'
                    }`}
                  >
                    {checked && <span className="text-white text-xs">✓</span>}
                  </div>
                  <Avatar name={u.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-slate-400">{u.city}</p>
                  </div>
                  <StatusBadge status={u.status} />
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400">
              Выбрано: {selected.length} / {MAX_COMPARE}
            </span>
            <Button
              onClick={() => {
                setPickerOpen(false);
                void compare();
              }}
              disabled={selected.length < 2}
            >
              Сравнить
            </Button>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}