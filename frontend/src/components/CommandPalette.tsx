import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckSquare,
  MessagesSquare,
  MessageCircle,
  Workflow,
  FileText, // NEW
  Search,
  CornerDownLeft,
} from 'lucide-react';
import { globalSearch, SEARCH_ENTITY_LABELS, targetViewFor } from '@/lib/search';
import type { SearchResult, ViewKey } from '@/types';

/**
 * Командная палитра ⌘K.
 *
 * Что умеет:
 * - Ищет по всем сущностям через backend RPC
 * - Стрелки ↑↓ навигация
 * - Enter — открыть
 * - Esc — закрыть
 * - Debounce 220 мс
 *
 * Использование:
 *   <CommandPalette open={open} onClose={...} onNavigate={...} />
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewKey, entityId?: string) => void;
}

const ICONS = {
  universities: Building2,
  tasks: CheckSquare,
  interactions: MessagesSquare,
  comments: MessageCircle,
  workflows: Workflow,
  documents: FileText, // NEW
} as const;

export function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // При открытии — сброс и фокус
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced поиск
  useEffect(() => {
    if (!open) return;

    const t = window.setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const r = await globalSearch(query);
      setResults(r);
      setActive(0);
      setLoading(false);
    }, 220);

    return () => window.clearTimeout(t);
  }, [query, open]);

  // Клавиатурная навигация
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' && results[active]) {
        const r = results[active];
        onNavigate(targetViewFor(r.entity), r.id);
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, active, onNavigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Ввод */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ищите вузы, задачи, взаимодействия…"
            className="flex-1 outline-none text-sm bg-transparent placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
          />
          <kbd className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Результаты */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="p-6 text-center text-sm text-slate-400">Поиск…</div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-6 text-center text-sm text-slate-400">
              Начните вводить хотя бы 2 символа
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">Ничего не найдено</div>
          )}

          {results.map((r, i) => {
            const Icon = ICONS[r.entity];
            return (
              <button
                key={`${r.entity}-${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onNavigate(targetViewFor(r.entity), r.id);
                  onClose();
                }}
                className={`w-full text-left px-5 py-3 flex items-center gap-3 border-l-2 transition-colors ${
                  active === i
                    ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-500'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active === i
                      ? 'bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {r.title}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {SEARCH_ENTITY_LABELS[r.entity]} · {r.subtitle}
                  </p>
                </div>
                {active === i && <CornerDownLeft size={14} className="text-slate-300" />}
              </button>
            );
          })}
        </div>

        {/* Подсказки */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">↑</kbd>
            <kbd className="font-mono border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">↓</kbd>
            навигация
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Enter</kbd>
            открыть
          </span>
        </div>
      </div>
    </div>
  );
}