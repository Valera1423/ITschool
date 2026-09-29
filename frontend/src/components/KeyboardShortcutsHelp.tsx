import { SimpleModal } from '@/components/ui';

const SECTIONS = [
  {
    title: 'Навигация',
    items: [
      ['⌘K / Ctrl+K', 'Быстрый поиск'],
      ['/', 'Поиск'],
      ['g d', 'Дашборд'],
      ['g u', 'Вузы'],
      ['g i', 'Взаимодействия'],
      ['g c', 'Календарь'],
      ['g t', 'Задачи'],
      ['g k', 'Канбан'],
      ['g w', 'Workflow'],
      ['g v', 'Договоры'],
      ['g a', 'Аналитика'],
      ['g r', 'Отчёты'],
      ['g m', 'Показатели'],
      ['g s', 'Настройки'],
      ['g y', 'Безопасность'],
      ['g j', 'Журнал'],
    ],
  },
  {
    title: 'Действия',
    items: [
      ['n u', 'Новый вуз'],
      ['n t', 'Новая задача'],
      ['n i', 'Новое взаимодействие'],
      ['⌘Z / Ctrl+Z', 'Отменить'],
      ['⌘⇧Z / Ctrl+Shift+Z', 'Повторить'],
      ['Esc', 'Закрыть модалку'],
      ['F1 или ?', 'Эта справка'],
    ],
  },
];

export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <SimpleModal title="Горячие клавиши" onClose={onClose} wide>
      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              {s.title}
            </h3>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {s.items.map(([keys, label]) => (
                <div
                  key={keys}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
                  <kbd className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SimpleModal>
  );
}