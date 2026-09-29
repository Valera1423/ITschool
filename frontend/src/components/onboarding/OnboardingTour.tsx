// frontend/src/components/onboarding/OnboardingTour.tsx
import { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import type { OnboardingStep } from '@/types';
import { completeStep } from '@/lib/onboarding';

/**
 * Обучающий тур для новых пользователей.
 *
 * Показывает подсветку целевых элементов + тултип с описанием.
 * Шаги задаются в БД (onboarding_steps), selector — CSS-селектор.
 *
 * Если целевой элемент не найден (например, шаг для admin-only раздела,
 * а пользователь — nam), показываем tooltip по центру с пометкой
 * «элемент недоступен на этой странице».
 */
interface Props {
  steps: OnboardingStep[];
  userId: string;
  onComplete: () => Promise<void>;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ steps, userId, onComplete, onSkip }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [elementMissing, setElementMissing] = useState(false);

  const step = steps[index];

  // Находим целевой элемент и подсвечиваем его
  useEffect(() => {
    if (!step?.target_selector) {
      setRect(null);
      setElementMissing(false);
      return;
    }

    const el = document.querySelector(step.target_selector) as HTMLElement | null;

    if (!el) {
      setRect(null);
      setElementMissing(true);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          `[OnboardingTour] target_selector "${step.target_selector}" не найден. ` +
            `Шаг "${step.title}" показан по центру.`,
        );
      }
      return;
    }

    setElementMissing(false);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  if (!step) return null;

  const next = async () => {
    // Пробуем записать прогресс — если сеть упала, не блокируем тур.
    try {
      await completeStep(userId, step.step_key);
    } catch {
      /* прогресс не критичен */
    }
    if (index < steps.length - 1) setIndex(index + 1);
    else await onComplete();
  };

  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

  // Позиция тултипа
  const tooltipStyle = (): React.CSSProperties => {
    if (!rect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const offset = 12;
    const tooltipWidth = 360;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'bottom':
        return {
          top: rect.top + rect.height + offset,
          left: Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16)),
          width: tooltipWidth,
        };
      case 'top':
        return {
          top: rect.top - tooltipHeight - offset,
          left: Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16)),
          width: tooltipWidth,
        };
      case 'right':
        return {
          top: rect.top,
          left: rect.left + rect.width + offset,
          width: tooltipWidth,
        };
      case 'left':
        return {
          top: rect.top,
          left: Math.max(16, rect.left - tooltipWidth - offset),
          width: tooltipWidth,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: tooltipWidth,
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {/* Затемнение */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] pointer-events-auto"
        onClick={onSkip}
      />

      {/* Подсветка целевого элемента */}
      {rect && (
        <div
          className="absolute border-2 border-sky-400 rounded-xl pointer-events-none transition-all duration-300 animate-pulse"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          }}
        />
      )}

      {/* Тултип */}
      <div
        className="absolute pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-5 animate-fade-in"
        style={tooltipStyle()}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <span className="text-xs text-slate-400">из {steps.length}</span>
          </div>
          <button
            onClick={onSkip}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Пропустить тур"
          >
            <X size={14} />
          </button>
        </div>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
          {step.title}
        </h3>
        {step.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {step.description}
          </p>
        )}

        {/* Предупреждение, если элемент не найден */}
        {elementMissing && (
          <div className="mb-4 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Этот раздел сейчас недоступен (например, для вашей роли). Шаг
              показан без подсветки.
            </span>
          </div>
        )}

        {/* Прогресс-точки */}
        <div className="flex gap-1 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i <= index ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={prev}
            disabled={index === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft size={13} /> Назад
          </button>

          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Пропустить
            </button>
            <button
              onClick={() => void next()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700"
            >
              {index === steps.length - 1 ? (
                <>
                  Завершить <Check size={13} />
                </>
              ) : (
                <>
                  Далее <ChevronRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}