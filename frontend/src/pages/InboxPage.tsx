import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCheck,
  ExternalLink,
  Filter,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  Reply,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { InboxMessage, University } from '@/types';
import {
  fetchInbox,
  markRead,
  markAllRead,
  archiveMessage,
  deleteMessage,
  replyToMessage,
  channelLabel,
  CHANNELS,
} from '@/lib/inbox';
import {
  EmptyState,
  Button,
  StatusBadge,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';
import { asArray, formatDateTime } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Единый инбокс.
 *
 * Собирает все каналы: Email, Telegram, WhatsApp, MAX, SMS, Web.
 * Фильтр «непрочитанные», поиск (debounced), ответы из карточки.
 */
interface Props {
  universities: University[];
  currentUserName: string;
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

const ICONS = {
  email: Mail,
  telegram: Send,
  whatsapp: MessageCircle,
  max: Zap,
  sms: MessageSquare,
  web: Inbox,
} as const;

export function InboxPage({ universities, onNotice }: Props) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [channelFilter, setChannelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InboxMessage | null>(null);

  // Debounce поиска — не дёргаем API на каждое нажатие
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchInbox({
        onlyUnread,
        channel: channelFilter,
        search: debouncedSearch,
      });
      setMessages(asArray(list));
    } finally {
      setLoading(false);
    }
  }, [onlyUnread, channelFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  // Обновление при возврате во вкладку — вместо WebSocket
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const unreadCount = messages.filter((m) => !m.read).length;

  const openMessage = async (msg: InboxMessage) => {
    setSelected(msg);
    if (!msg.read) {
      await markRead(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)),
      );
    }
  };

  const handleMarkAll = async () => {
    await markAllRead();
    await load();
    onNotice('Все прочитаны.');
  };

  const handleArchive = async (id: string) => {
    await archiveMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelected(null);
    onNotice('В архиве.');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить сообщение?')) return;
    await deleteMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelected(null);
    onNotice('Удалено.');
  };

  const handleReply = async (msg: InboxMessage, body: string) => {
    const r = await replyToMessage(msg, body);
    if (r.error) {
      onNotice(`Ошибка: ${r.error}`);
      return;
    }
    onNotice('Ответ отправлен.');
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">
            Все каналы в одном месте
          </p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Инбокс
          </h1>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={() => void handleMarkAll()}>
            <CheckCheck size={16} />
            Прочитать все ({unreadCount})
          </Button>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по отправителю, теме или телу"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setOnlyUnread(false)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !onlyUnread
                ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-700 dark:text-slate-200'
                : 'text-slate-500'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setOnlyUnread(true)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              onlyUnread
                ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-700 dark:text-slate-200'
                : 'text-slate-500'
            }`}
          >
            Непрочитанные
          </button>
        </div>
        <div className="relative">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className={`${selectClass} pl-9 sm:w-48`}
          >
            <option value="all">Все каналы</option>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-400 py-12">
          Загрузка…
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          text="Сообщений нет"
          icon={Inbox}
          hint="Когда придёт письмо или сообщение, оно появится здесь"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          {messages.map((m) => {
            const Icon = ICONS[m.channel] ?? Inbox;
            const uni = universities.find((u) => u.id === m.university_id);
            return (
              <div
                key={m.id}
                onClick={() => void openMessage(m)}
                className={`flex items-start gap-3 px-5 py-4 border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                  !m.read ? 'bg-sky-50/40 dark:bg-sky-900/10' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-sm ${
                        !m.read
                          ? 'font-semibold text-slate-800 dark:text-slate-100'
                          : 'font-medium text-slate-700 dark:text-slate-200'
                      } truncate`}
                    >
                      {m.from_name ?? m.from_address}
                    </span>
                    {m.direction === 'out' && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        исходящее
                      </span>
                    )}
                    {!m.read && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                    )}
                  </div>

                  <p
                    className={`text-sm truncate ${
                      !m.read
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.subject ?? m.body.slice(0, 80)}
                  </p>

                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800">
                      {channelLabel(m.channel)}
                    </span>
                    {uni && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {uni.name}
                      </span>
                    )}
                    <span>{formatDateTime(m.received_at)}</span>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => void handleArchive(m.id)}
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="В архив"
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => void handleDelete(m.id)}
                    className="p-1.5 rounded text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <MessageDetail
          message={selected}
          university={universities.find(
            (u) => u.id === selected.university_id,
          )}
          onClose={() => setSelected(null)}
          onReply={handleReply}
          onArchive={() => void handleArchive(selected.id)}
          onDelete={() => void handleDelete(selected.id)}
        />
      )}
    </div>
  );
}

function MessageDetail({
  message,
  university,
  onClose,
  onReply,
  onArchive,
  onDelete,
}: {
  message: InboxMessage;
  university?: University;
  onClose: () => void;
  onReply: (msg: InboxMessage, body: string) => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setReplying(true);
    await onReply(message, replyBody.trim());
    setReplying(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
              {message.subject ?? 'Без темы'}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <StatusBadge status={channelLabel(message.channel)} />
              <span>{message.from_name ?? message.from_address}</span>
              <span>→</span>
              <span>{message.to_address ?? 'crm'}</span>
              <span>{formatDateTime(message.received_at)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {university && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center gap-2">
              <Building2 size={15} className="text-slate-500" />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {university.name}
              </span>
              {university.contact_email && (
                <span className="text-xs text-slate-400">
                  · {university.contact_email}
                </span>
              )}
            </div>
          )}

          <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {message.body}
          </div>

          {asArray(message.attachments).length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-400 mb-2">
                Вложения
              </p>
              <div className="space-y-1">
                {message.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-sky-600 hover:underline"
                  >
                    <ExternalLink size={12} /> {a.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {message.direction === 'in' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={`Ответ для ${message.from_name ?? message.from_address}`}
              rows={3}
              className={textareaClass}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <button
                  onClick={onArchive}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <Archive size={12} /> В архив
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Удалить
                </button>
              </div>
              <Button
                onClick={() => void handleReply()}
                disabled={replying || !replyBody.trim()}
              >
                <Reply size={14} /> {replying ? 'Отправка…' : 'Ответить'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}