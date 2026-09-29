// frontend/src/components/workflow/WorkflowProgress.tsx
import { CheckCircle2, Circle, Clock3, XCircle, ChevronRight } from 'lucide-react';
import type { WorkflowStep, WorkflowStatusCatalog } from '@/types';
import { stepStatusLabel, stepStatusColor } from '@/lib/workflow';
import { StatusBadge, EmptyState } from '@/components/ui';

/**
 * Прогресс workflow — вертикальный список шагов.
 *
 * Используется:
 * - В карточке вуза (полный вид)
 * - В Compact (виджет) — только прогресс-бар
 *
 * Корректно обрабатывает пустой список шагов: не показывает 100%.
 */
interface Props {
  steps: WorkflowStep[];
  catalog: WorkflowStatusCatalog[];
  onStepClick?: (step: WorkflowStep) => void;
  compact?: boolean;
}

export function WorkflowProgress({
  steps,
  catalog,
  onStepClick,
  compact = false,
}: Props) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const total = sorted.length;
  const completed = sorted.filter((s) => s.status_code === 'done').length;
  // pct = 0 при 0 шагов (раньше было 100% из-за `total || 1`)
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Пусто — показываем EmptyState (или компактную заглушку)
  if (total === 0) {
    if (compact) {
      return (
        <div className="text-xs text-slate-400">
          Workflow не назначен
        </div>
      );
    }
    return (
      <EmptyState
        text="Workflow не назначен"
        hint="Привяжите вуз к workflow в разделе «Workflow»"
      />
    );
  }

  // Компактный режим — только прогресс
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {completed} из {total} шагов
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {pct}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Прогресс-бар */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Прогресс по workflow
          </p>
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
            {pct}%
          </span>
        </div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {completed} из {total} шагов завершено
        </p>
      </div>

      {/* Список шагов */}
      <div className="space-y-2">
        {sorted.map((s, i) => {
          const label = stepStatusLabel(s, catalog);
          stepStatusColor(s, catalog); // валидация, но цвет берём из StatusBadge

          // Иконка по статусу
          const Icon =
            s.status_code === 'done'
              ? CheckCircle2
              : s.status_code === 'cancelled'
                ? XCircle
                : s.status_code === 'in_progress'
                  ? Clock3
                  : Circle;

          const iconColor =
            s.status_code === 'done'
              ? 'text-emerald-500'
              : s.status_code === 'cancelled'
                ? 'text-rose-500'
                : s.status_code === 'in_progress'
                  ? 'text-amber-500'
                  : 'text-slate-300 dark:text-slate-600';

          return (
            <button
              key={s.id}
              onClick={() => onStepClick?.(s)}
              disabled={!onStepClick}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                s.status_code === 'done'
                  ? 'bg-emerald-50/40 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40'
                  : s.status_code === 'in_progress'
                    ? 'bg-amber-50/40 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              } ${onStepClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}
              >
                <Icon size={18} />
              </div>

              <div className="w-6 text-xs text-slate-400 font-mono flex-shrink-0">
                {i + 1}.
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    s.status_code === 'done'
                      ? 'text-slate-400 line-through'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {s.title}
                </p>
              </div>

              <StatusBadge status={label} />
              {onStepClick && <ChevronRight size={14} className="text-slate-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}