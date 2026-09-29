import { Rocket, X, ChevronRight, BookOpen, Compass } from 'lucide-react';

/**
 * Приветственный баннер на дашборде для новых пользователей.
 * Появляется, если onboarding не пройден.
 */
interface Props {
  userName: string;
  onStartTour: () => void;
  onOpenKnowledge: () => void;
  onDismiss: () => void;
}

export function OnboardingBanner({
  userName,
  onStartTour,
  onOpenKnowledge,
  onDismiss,
}: Props) {
  return (
    <div className="relative bg-gradient-to-br from-sky-500 to-sky-700 rounded-2xl p-6 text-white overflow-hidden">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        title="Скрыть"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Rocket size={22} />
        </div>

        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide opacity-80 mb-1">
            Добро пожаловать
          </p>
          <h2 className="text-xl font-bold mb-1">
            Привет, {userName.split(' ')[0]}!
          </h2>
          <p className="text-sm opacity-90 mb-4 max-w-2xl">
            Мы подготовили короткий обзор, чтобы вы быстрее разобрались.
            Займёт меньше минуты.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onStartTour}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-sky-700 hover:bg-sky-50 text-sm font-medium transition-colors"
            >
              <Compass size={15} /> Пройти тур
              <ChevronRight size={14} />
            </button>
            <button
              onClick={onOpenKnowledge}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors"
            >
              <BookOpen size={15} /> Открыть базу знаний
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}