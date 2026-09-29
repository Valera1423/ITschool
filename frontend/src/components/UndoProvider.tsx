// frontend/src/components/UndoProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Undo/redo-контекст для обратимых действий.
 *
 * Позволяет каждому сервисному действию зарегистрировать пару
 * `do()` / `undo()` — тогда пользователь может откатить его
 * через Ctrl+Z или через историю.
 *
 * ВАЖНО: стек in-memory — при перезагрузке страницы пропадает.
 * Так осознанно: хранение потенциально опасных колбэков в
 * localStorage открывало бы XSS-риски.
 */

export interface UndoAction {
  id: string;
  label: string;
  do: () => Promise<void>;
  undo: () => Promise<void>;
  at: number;
}

interface HistoryContextValue {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  push: (action: Omit<UndoAction, 'id' | 'at'>) => void;
  clear: () => void;
  items: UndoAction[];
}

interface UndoContextValue {
  notifyWithUndo: (message: string, undoFn: () => Promise<void>) => void;
}

const MAX_STACK = 50;
const TOAST_TIMEOUT = 8000;

// ============================================================
// History (undo/redo)
// ============================================================
const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

function HistoryProvider({ children }: { children: ReactNode }) {
  const [past, setPast] = useState<UndoAction[]>([]);
  const [future, setFuture] = useState<UndoAction[]>([]);
  const busyRef = useRef(false);

  const push = useCallback((action: Omit<UndoAction, 'id' | 'at'>) => {
    setPast((prev) => {
      const next = [
        ...prev,
        {
          ...action,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
        },
      ];
      return next.slice(-MAX_STACK);
    });
    setFuture([]);
  }, []);

  const undo = useCallback(async () => {
    if (busyRef.current) return;
    const last = past[past.length - 1];
    if (!last) return;
    busyRef.current = true;
    try {
      await last.undo();
      setPast((prev) => prev.slice(0, -1));
      setFuture((prev) => [last, ...prev].slice(0, MAX_STACK));
    } finally {
      busyRef.current = false;
    }
  }, [past]);

  const redo = useCallback(async () => {
    if (busyRef.current) return;
    const next = future[0];
    if (!next) return;
    busyRef.current = true;
    try {
      await next.do();
      setFuture((prev) => prev.slice(1));
      setPast((prev) => [...prev, next].slice(-MAX_STACK));
    } finally {
      busyRef.current = false;
    }
  }, [future]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const value: HistoryContextValue = {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    push,
    clear,
    items: past,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within UndoProvider');
  return ctx;
}

// ============================================================
// Undo (toast-уведомления с кнопкой «Отменить»)
// ============================================================
interface Toast {
  id: string;
  message: string;
  undo: () => Promise<void>;
  at: number;
}

const UndoContext = createContext<UndoContextValue | undefined>(undefined);

function UndoToastStack({
  toasts,
  onUndo,
  onDismiss,
}: {
  toasts: Toast[];
  onUndo: (t: Toast) => void;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl animate-slide-up"
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            onClick={() => onUndo(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20"
          >
            Отменить
          </button>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-xs text-slate-400 hover:text-white"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notifyWithUndo = useCallback(
    (message: string, undoFn: () => Promise<void>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = { id, message, undo: undoFn, at: Date.now() };
      setToasts((prev) => [...prev, toast]);

      const timer = window.setTimeout(() => {
        dismiss(id);
      }, TOAST_TIMEOUT);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const handleUndo = useCallback(
    async (t: Toast) => {
      try {
        await t.undo();
        dismiss(t.id);
      } catch {
        /* ошибку покажет сервис */
      }
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return (
    <UndoContext.Provider value={{ notifyWithUndo }}>
      {children}
      <UndoToastStack toasts={toasts} onUndo={handleUndo} onDismiss={dismiss} />
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}

// ============================================================
// Композитный провайдер
// ============================================================
export function UndoProvider({ children }: { children: ReactNode }) {
  return (
    <HistoryProvider>
      <UndoToastProvider>{children}</UndoToastProvider>
    </HistoryProvider>
  );
}