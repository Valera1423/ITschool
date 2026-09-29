import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { TimelineEvent } from '@/types';
import { fetchUniversityTimeline, TIMELINE_KIND_META, timelineColor } from '@/lib/timeline';
import { EmptyState } from '@/components/ui';
import { asArray, formatDateTime } from '@/lib/utils';

interface Props {
  universityId: string;
}

/**
 * Единая лента событий по вузу.
 * Данные собираются бэкендом через TimelineService (порт SQL RPC).
 */
export function UniversityTimeline({ universityId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const data = await fetchUniversityTimeline(universityId, 200);
      if (cancelled) return;
      setEvents(asArray(data));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [universityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        Загрузка ленты…
      </div>
    );
  }

  if (error) {
    return <EmptyState text={error} />;
  }

  if (events.length === 0) {
    return <EmptyState text="Пока нет событий" />;
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {events.map((e, idx) => {
        const meta = TIMELINE_KIND_META[e.kind] ?? {
          label: e.kind,
          color: 'slate',
        };
        const c = timelineColor(e.kind);

        return (
          <div key={`${e.kind}-${e.event_id}-${idx}`} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${c.bg} ${c.text} text-xs font-semibold`}
              >
                {meta.label[0]}
              </div>
              {idx < events.length - 1 && (
                <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 my-1" />
              )}
            </div>

            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDateTime(String(e.happened_at))}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {e.title}
              </p>

              {e.description && e.description !== e.title && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                  {e.description}
                </p>
              )}

              {e.actor && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Автор: {e.actor}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}