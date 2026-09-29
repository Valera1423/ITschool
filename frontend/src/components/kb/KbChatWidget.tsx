import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Sparkles, Send, Loader2, ExternalLink, X } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string; slug: string; snippet: string }[];
  loading?: boolean;
}

interface Props {
  onOpenArticle?: (slug: string) => void;
  onClose: () => void;
}

export function KbChatWidget({ onOpenArticle, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Здравствуйте! Спросите что-нибудь про CRM — например, «как добавить вуз?» или «как экспортировать отчёт?». Я поищу ответ в базе знаний.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: question,
    };
    const loadingMsg: Message = {
      id: 'loading',
      role: 'assistant',
      content: '',
      loading: true,
    };

    setMessages((m) => [...m, userMsg, loadingMsg]);
    setInput('');
    setBusy(true);

    try {
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post<{
        answer: string;
        sources: { id: string; title: string; slug: string; snippet: string }[];
        sessionId: string;
        latencyMs: number;
      }>('/ai/kb-chat', {
        question,
        sessionId,
        history,
      });

      setSessionId(res.sessionId);
      setMessages((m) => [
        ...m.filter((x) => x.id !== 'loading'),
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m.filter((x) => x.id !== 'loading'),
        {
          id: String(Date.now() + 2),
          role: 'assistant',
          content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-[60] w-[420px] max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[600px] animate-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              Спросить AI
            </p>
            <p className="text-[10px] text-slate-400">
              отвечает по базе знаний
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {m.loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Ищу ответ…
                </span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wide opacity-70">
                        Источники
                      </p>
                      {m.sources.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onOpenArticle?.(s.slug)}
                          className="w-full text-left text-xs flex items-start gap-1.5 hover:underline"
                        >
                          <ExternalLink size={11} className="mt-0.5 flex-shrink-0" />
                          <span className="truncate">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Задайте вопрос…"
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
            aria-label="Отправить"
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}