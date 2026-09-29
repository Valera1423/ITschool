import { useCallback, useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { fetchGantt, moveGanttTask, type GanttData } from '@/lib/gantt';
import { GanttChart } from '@/components/GanttChart';
import {
  LoadingState,
  EmptyState,
  Button,
  selectClass,
} from '@/components/ui';
import { asArray } from '@/lib/utils';

interface Props {
  managers: string[];
  onNotice: (msg: string) => void;
}

export function GanttPage({ managers, onNotice }: Props) {
  const [data, setData] = useState<GanttData>({
    items: [],
    dependencies: [],
  });
  const [loading, setLoading] = useState(true);
  const [assignee, setAssignee] = useState('Все');

  const safeManagers = asArray<string>(managers);

  // Единственный источник загрузки — этот callback.
  // Отдельного useEffect'а нет (иначе двойной запрос при mount).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchGantt({
        assignee: assignee !== 'Все' ? assignee : undefined,
      });
      setData({
        items: asArray(result.items),
        dependencies: asArray(result.dependencies),
      });
    } finally {
      setLoading(false);
    }
  }, [assignee]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTaskMove = async (
    taskId: string,
    newStart: Date,
    newEnd: Date,
  ) => {
    const err = await moveGanttTask(
      taskId,
      newStart.toISOString(),
      newEnd.toISOString(),
    );
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Задача перемещена');
    await load();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Планирование</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Диаграмма Ганта
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Зависимости между задачами, перетаскивайте бары для смены срока.
          </p>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={`${selectClass} pl-9 sm:w-64`}
            aria-label="Фильтр по ответственному"
          >
            <option>Все</option>
            {safeManagers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-sm text-slate-400 self-center">
          {data.items.length} задач · {data.dependencies.length} зависимостей
        </span>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          text="Нет задач"
          hint="Создайте задачи в разделе «Задачи»"
        />
      ) : (
        <GanttChart
          tasks={data.items}
          dependencies={data.dependencies}
          onTaskMove={handleTaskMove}
          onTaskClick={(t) => onNotice(`Открыть: ${t.title}`)}
        />
      )}
    </div>
  );
}