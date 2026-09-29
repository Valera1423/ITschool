import { Check, Trash2, Bell, BellOff } from 'lucide-react';
import type { AppNotification } from '@/types';
import { formatDateTime } from '@/lib/utils';

interface Props {
  items: AppNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function NotificationsPanel({
  items, loading, onMarkRead, onMarkAllRead, onRemove, onClose,
}: Props) {
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <div className="fixed inset-0 z-atmr-2xl" onClick={onClose} />

      <div className="absolute right-0 top-12 z-atmr-3xl w-96 max-h-[70vh] bg-atmr-bg-elevated-xl rounded-atmr-xl shadow-atmr-xl border border-atmr-border-soft overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-atmr-border-soft flex items-center justify-between">
          <div>
            <p className="atmr-body-m-strong text-atmr-fg">Уведомления</p>
            <p className="atmr-desc-l text-atmr-fg-muted">
              {unread} непрочитанных
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={onMarkAllRead}
              className="atmr-desc-l-strong text-atmr-accent hover:text-atmr-accent-hover flex items-center gap-1 transition-colors duration-atmr-fast"
            >
              <Check size={14} /> Прочитать все
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 text-center atmr-body-s text-atmr-fg-muted">
              Загрузка…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-8 text-center">
              <BellOff size={28} className="mx-auto text-atmr-fg-muted mb-2" />
              <p className="atmr-body-s text-atmr-fg-muted">Уведомлений нет</p>
            </div>
          )}

          {items.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-3 px-5 py-3 border-b border-atmr-border-soft last:border-0 hover:bg-atmr-bg-surface2 transition-colors ${
                !n.read ? 'bg-atmr-accent-muted' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-atmr-m flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  n.read
                    ? 'bg-atmr-bg-surface2 text-atmr-fg-muted'
                    : 'bg-atmr-accent-soft text-atmr-accent'
                }`}
              >
                <Bell size={14} />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`atmr-body-s ${
                    n.read
                      ? 'text-atmr-fg-soft'
                      : 'atmr-body-s-strong text-atmr-fg'
                  }`}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="atmr-desc-l text-atmr-fg-muted mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                )}
                <p className="atmr-desc-m text-atmr-fg-muted mt-1">
                  {formatDateTime(n.created_at)}
                </p>
              </div>

              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-atmr-fast">
                {!n.read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="p-1 rounded-atmr-s text-atmr-fg-muted hover:text-atmr-success transition-colors"
                    title="Прочитано"
                    aria-label="Отметить прочитанным"
                  >
                    <Check size={13} />
                  </button>
                )}
                <button
                  onClick={() => onRemove(n.id)}
                  className="p-1 rounded-atmr-s text-atmr-fg-muted hover:text-atmr-error transition-colors"
                  title="Удалить"
                  aria-label="Удалить"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}