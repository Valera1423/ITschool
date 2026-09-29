import {
  LayoutDashboard, GraduationCap, CheckSquare, Inbox, Menu,
} from 'lucide-react';
import type { ViewKey } from '@/types';

interface Props {
  current: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onOpenMenu: () => void;
}

const ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { key: 'universities', label: 'Вузы', icon: GraduationCap },
  { key: 'tasks', label: 'Задачи', icon: CheckSquare },
  { key: 'inbox', label: 'Инбокс', icon: Inbox },
];

export function MobileBottomNav({ current, onNavigate, onOpenMenu }: Props) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-16">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">Ещё</span>
        </button>
      </div>
    </nav>
  );
}