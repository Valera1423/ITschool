import { useState } from 'react';
import { Sparkles, X, Bug, Zap } from 'lucide-react';
import {
  CHANGELOG, currentVersion, unseenEntries, markVersionSeen,
  type ChangelogEntry,
} from '@/lib/changelog';
import { SimpleModal, Button } from '@/components/ui';

/**
 * Changelog-попап.
 *
 * Появляется один раз после обновления — до тех пор, пока не закрыт.
 * Если пользователь — «старый», показываем все новые записи с момента
 * последнего посещения. Если он тут впервые — только текущую версию.
 */
export function ChangelogPopup() {
  const [open, setOpen] = useState(() => unseenEntries().length > 0);
  const entries = unseenEntries();

  if (!open || entries.length === 0) return null;

  const close = () => {
    markVersionSeen();
    setOpen(false);
  };

  return (
    <SimpleModal title={`Что нового · v${currentVersion()}`} onClose={close} wide>
      <div className="space-y-5">
        {entries.map((e) => (
          <EntryBlock key={e.version} entry={e} />
        ))}

        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-xs text-sky-700 dark:text-sky-300">
          Полная история изменений — в файле <code>CHANGELOG.md</code> в репозитории.
        </div>

        <div className="flex justify-end">
          <Button onClick={close}>
            <Sparkles size={14} /> Понятно
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

function EntryBlock({ entry }: { entry: ChangelogEntry }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Версия {entry.version}
        </h3>
        <span className="text-xs text-slate-400">
          {new Date(entry.date).toLocaleDateString('ru-RU')}
        </span>
      </div>
      <ul className="space-y-1.5">
        {entry.changes.map((c, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <TypeIcon type={c.type} />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypeIcon({ type }: { type: ChangelogEntry['changes'][number]['type'] }) {
  if (type === 'feat') return <Sparkles size={14} className="text-sky-500 mt-0.5 flex-shrink-0" />;
  if (type === 'fix') return <Bug size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />;
  return <Zap size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />;
}

// Индекс версий — чтобы TS не ругался на неиспользуемую CHANGELOG
export const CHANGELOG_COUNT = CHANGELOG.length;