import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import type { University } from '@/types';
import { UniversitiesMap } from '@/components/UniversitiesMap';
import { UNIVERSITY_STATUSES } from '@/constants';
import { selectClass, inputClass } from '@/components/ui';
import { asArray } from '@/lib/utils';

interface Props {
  universities: University[];
  onNotice: (msg: string) => void;
}

export function MapPage({ universities, onNotice }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('Все');
  const [search, setSearch] = useState('');

  const safeUniversities = asArray<University>(universities);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return safeUniversities.filter((u) => {
      if (statusFilter !== 'Все' && u.status !== statusFilter) return false;
      if (q && !`${u.name} ${u.city}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [safeUniversities, statusFilter, search]);

  // Статистика по городам
  const cityStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of filtered) {
      map[u.city] = (map[u.city] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">География партнёров</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Карта вузов
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {filtered.length} вузов
          {cityStats.length > 0 ? ` в ${cityStats.length} городах` : ''}
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или городу"
          className={`${inputClass} flex-1`}
        />
        <div className="relative">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${selectClass} pl-9 sm:w-56`}
            aria-label="Фильтр по статусу"
          >
            <option>Все</option>
            {UNIVERSITY_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <UniversitiesMap
          universities={filtered}
          onSelect={(u) => onNotice(`Выбран: ${u.name}`)}
        />

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 h-fit">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Топ городов
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cityStats.slice(0, 20).map(([city, count]) => (
              <div key={city} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                  {city}
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {count}
                </span>
              </div>
            ))}
            {cityStats.length === 0 && (
              <p className="text-xs text-slate-400">
                Нет городов по фильтру
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Легенда
            </p>
            <div className="space-y-1.5">
              {(
                [
                  ['Новый', 'bg-sky-500'],
                  ['Переговоры', 'bg-amber-500'],
                  ['Обучение', 'bg-violet-500'],
                  ['Внедрение', 'bg-emerald-500'],
                  ['Партнёр', 'bg-teal-500'],
                  ['Отказ', 'bg-rose-500'],
                ] as const
              ).map(([status, color]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className={`w-3 h-3 rounded-full ${color}`} />
                  {status}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}