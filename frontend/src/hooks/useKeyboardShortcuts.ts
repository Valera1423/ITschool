import { useEffect, useRef } from 'react';
import type { ViewKey } from '@/types';

/**
 * Глобальные горячие клавиши.
 *
 * Навигация (два нажатия подряд в течение 1.2 сек):
 *   g d — Дашборд
 *   g u — Вузы
 *   g i — Взаимодействия
 *   g c — Календарь
 *   g t — Задачи
 *   g k — Канбан
 *   g w — Workflow
 *   g r — Отчёты
 *   g m — Показатели
 *   g a — Аналитика
 *   g v — Договоры
 *   g y — Безопасность
 *   g s — Настройки
 *   g j — Журнал
 *
 * Действия:
 *   n u — Новый вуз
 *   n t — Новая задача
 *   n i — Новое взаимодействие
 *   / — Поиск
 *   ⌘/Ctrl+K — Поиск
 *   ⌘/Ctrl+Z — Отменить
 *   ⌘/Ctrl+Shift+Z — Повторить
 *   ? или F1 — Справка
 *   t t — Переключить тему
 */

interface Handlers {
  onNavigate: (view: ViewKey) => void;
  onNewUniversity: () => void;
  onNewTask: () => void;
  onNewInteraction: () => void;
  onSearch: () => void;
  /** Справка — вызывается по `?` или `F1`. */
  onShowHelp?: () => void;
  /** Переключение темы — `t t`. */
  onToggleTheme?: () => void;
  /** Undo — ⌘/Ctrl+Z. */
  onUndo?: () => void;
  /** Redo — ⌘/Ctrl+Shift+Z. */
  onRedo?: () => void;
  disabled?: boolean;
}

const SEQ_TIMEOUT_MS = 1200;

export function useKeyboardShortcuts(h: Handlers) {
  const seqRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const handlersRef = useRef(h);

  useEffect(() => {
    handlersRef.current = h;
  }, [h]);

  useEffect(() => {
    if (h.disabled) return;

    /**
     * Проверяет, находится ли фокус в поле ввода.
     * Если да — игнорируем все shortcuts, кроме ⌘K / ⌘Z / ⌘⇧Z.
     */
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        (el as HTMLElement).isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const handlers = handlersRef.current;
      const key = e.key.toLowerCase();

      // ⌘K / Ctrl+K — поиск, работает всегда (в т.ч. в поле ввода)
      if (meta && key === 'k') {
        e.preventDefault();
        handlers.onSearch();
        return;
      }

      // ⌘Z / Ctrl+Z — Undo; ⌘⇧Z / Ctrl+Shift+Z — Redo.
      // Внутри input/textarea не перехватываем — пусть браузер сам
      // откатывает ввод пользователя (это ожидаемое поведение).
      if (meta && key === 'z' && !isTyping()) {
        e.preventDefault();
        if (e.shiftKey) handlers.onRedo?.();
        else handlers.onUndo?.();
        return;
      }

      // Если в поле ввода — не мешаем дальше
      if (isTyping()) return;
      if (meta || e.altKey) return;

      // `?` — справка (Shift+/)
      if (e.key === '?') {
        e.preventDefault();
        handlers.onShowHelp?.();
        return;
      }

      // F1 — справка
      if (e.key === 'F1') {
        e.preventDefault();
        handlers.onShowHelp?.();
        return;
      }

      // Одиночный `/` — поиск
      if (key === '/') {
        e.preventDefault();
        handlers.onSearch();
        return;
      }

      // Последовательности: сохраняем первый символ, ждём второй
      const now = Date.now();
      const seq = seqRef.current;

      if (now - seq.at > SEQ_TIMEOUT_MS) {
        seqRef.current = { key, at: now };
        return;
      }

      const combo = seq.key + key;
      seqRef.current = { key: '', at: 0 };

      switch (combo) {
        // Навигация — g + <буква>
        case 'gd': handlers.onNavigate('dashboard'); break;
        case 'gu': handlers.onNavigate('universities'); break;
        case 'gi': handlers.onNavigate('interactions'); break;
        case 'gc': handlers.onNavigate('calendar'); break;
        case 'gt': handlers.onNavigate('tasks'); break;
        case 'gk': handlers.onNavigate('kanban'); break;
        case 'gw': handlers.onNavigate('workflows'); break;
        case 'gr': handlers.onNavigate('reports'); break;
        case 'gm': handlers.onNavigate('metrics'); break;
        case 'gj': handlers.onNavigate('journal'); break;
        case 'ga': handlers.onNavigate('analytics'); break;
        case 'gv': handlers.onNavigate('contracts'); break;
        case 'gy': handlers.onNavigate('security'); break;
        case 'gs': handlers.onNavigate('settings'); break;

        // Создание — n + <буква>
        case 'nu': handlers.onNewUniversity(); break;
        case 'nt': handlers.onNewTask(); break;
        case 'ni': handlers.onNewInteraction(); break;

        // Прочие действия — t + t (тема)
        case 'tt': handlers.onToggleTheme?.(); break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h.disabled]);
}