// frontend/src/hooks/useRealtimeSync.ts
import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { userManager } from '@/lib/oidc';
import { logger } from '@/lib/logger';

export interface RealtimeEvent {
  type: string;
  entity?: string;
  entityId?: string | null;
  actor?: string;
  payload?: Record<string, unknown>;
  at?: number;
}

interface Options {
  enabled: boolean;
  onEvent?: (event: RealtimeEvent) => void;
  onNotice?: (msg: string) => void;
}

// ============================================================
// URL WS: собираем от текущего origin, а не от VITE_API_URL
// ============================================================
function buildWsUrl(token: string): string {
  // В dev: window.location.origin = http://localhost:5173, /ws проксируется Vite
  // В prod: nginx проксирует /ws → backend:4000/ws
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${proto}//${host}/ws?token=${encodeURIComponent(token)}`;
}

export function useRealtimeSync({ enabled, onEvent, onNotice }: Options) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const onEventRef = useRef(onEvent);
  const onNoticeRef = useRef(onNotice);
  const currentUserEmailRef = useRef<string | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onNoticeRef.current = onNotice;
  });

  // Кэшируем email текущего пользователя для фильтра «свои/чужие»
  useEffect(() => {
    void userManager.getUser().then((u) => {
      currentUserEmailRef.current = (u?.profile?.email as string) ?? null;
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let attempt = 0;
    const maxDelay = 60_000;

    const connect = async () => {
      if (stopped) return;

      const user = await userManager.getUser().catch(() => null);
      if (!user || user.expired) {
        reconnectTimerRef.current = window.setTimeout(connect, 30_000);
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(buildWsUrl(user.access_token));
      } catch (e) {
        logger.warn('WS: connect failed', e);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        logger.debug('WS connected');
      };

      ws.onmessage = (raw) => {
        try {
          const evt = JSON.parse(raw.data) as RealtimeEvent;

          if (
            evt.type === 'connected' ||
            evt.type === 'ping' ||
            evt.type === 'pong'
          ) {
            return;
          }

          invalidateByEvent(qc, evt);

          const isMine =
            !!evt.actor &&
            !!currentUserEmailRef.current &&
            evt.actor === currentUserEmailRef.current;

          if (!isMine && onNoticeRef.current) {
            const msg = messageFor(evt);
            if (msg) onNoticeRef.current(msg);
          }

          onEventRef.current?.(evt);
        } catch {
          /* malformed message — игнорируем */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!stopped) scheduleReconnect();
      };

      ws.onerror = () => {
        /* onclose всё обработает */
      };
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      const delay = Math.min(maxDelay, 3000 * 2 ** attempt);
      attempt++;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, qc]);
}

// ============================================================
// Инвалидация React Query
// ============================================================

/**
 * Покрываем ВСЕ типы событий, которые могут приходить:
 *
 *   - из сервисов (universities:transferred, workflows:transition,
 *     comments:created) — с богатым payload;
 *   - из realtimeExtension (create/update/delete по всем моделям)
 *     — с payload { count, ids, bulk }.
 *
 * Если добавляешь модель в MODEL_TO_ENTITY на бэке — не забудь
 * добавить сюда правило инвалидации, иначе событие придёт, но
 * данных не обновит.
 */
function invalidateByEvent(qc: QueryClient, evt: RealtimeEvent): void {
  const t = evt.type;

  // ── Вузы
  if (t.startsWith('universities:') || t.startsWith('university-contacts:')) {
    void qc.invalidateQueries({ queryKey: ['universities'] });
    if (evt.entityId) {
      void qc.invalidateQueries({
        queryKey: ['universities', 'detail', evt.entityId],
      });
    }
    return;
  }

  // ── Задачи
  if (t.startsWith('tasks:')) {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    return;
  }

  // ── Взаимодействия
  if (t.startsWith('interactions:')) {
    void qc.invalidateQueries({ queryKey: ['interactions'] });
    return;
  }

  // ── Комментарии
  if (t.startsWith('comments:')) {
    if (evt.entityId) {
      void qc.invalidateQueries({
        queryKey: ['universities', evt.entityId, 'comments'],
      });
    }
    void qc.invalidateQueries({ queryKey: ['comments'] });
    return;
  }

  // ── Workflow
  if (
    t === 'workflows:transition' ||
    t.startsWith('workflow-steps:') ||
    t.startsWith('workflow-universities:')
  ) {
    void qc.invalidateQueries({ queryKey: ['workflow-steps'] });
    void qc.invalidateQueries({ queryKey: ['workflow-universities'] });
    if (evt.entityId) {
      void qc.invalidateQueries({
        queryKey: ['workflows', 'university', evt.entityId],
      });
      void qc.invalidateQueries({
        queryKey: ['universities', 'detail', evt.entityId],
      });
    }
    void qc.invalidateQueries({ queryKey: ['universities'] });
    return;
  }

  // ── Договоры
  if (t.startsWith('contracts:') || t.startsWith('contract-approvals:')) {
    void qc.invalidateQueries({ queryKey: ['contracts'] });
    return;
  }

  // ── Уведомления (обрабатываем оба варианта — и :new, и :created)
  if (t === 'notifications:new' || t === 'notifications:created') {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
    return;
  }

  // ── Инбокс
  if (t.startsWith('inbox:')) {
    void qc.invalidateQueries({ queryKey: ['inbox'] });
    return;
  }

  // ── Каталоги / администрирование
  if (
    t.startsWith('managers:') ||
    t.startsWith('vendors:') ||
    t.startsWith('it-directions:') ||
    t.startsWith('it-products:') ||
    t.startsWith('catalogs:')
  ) {
    void qc.invalidateQueries({ queryKey: ['catalogs'] });
    return;
  }

  if (t.startsWith('profiles:') || t.startsWith('user-scopes:')) {
    void qc.invalidateQueries({ queryKey: ['profiles'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
    return;
  }

  if (t.startsWith('tags:')) {
    void qc.invalidateQueries({ queryKey: ['tags'] });
    return;
  }

  if (t.startsWith('custom-fields:') || t.startsWith('custom-field-values:')) {
    void qc.invalidateQueries({ queryKey: ['custom-fields'] });
    return;
  }

  if (t.startsWith('segments:')) {
    void qc.invalidateQueries({ queryKey: ['segments'] });
    return;
  }

  if (t.startsWith('knowledge:')) {
    void qc.invalidateQueries({ queryKey: ['knowledge'] });
    return;
  }

  if (t.startsWith('dashboards:')) {
    void qc.invalidateQueries({ queryKey: ['dashboards'] });
    return;
  }

  if (t.startsWith('integrations:')) {
    void qc.invalidateQueries({ queryKey: ['integrations'] });
    return;
  }

  if (t.startsWith('automation-rules:')) {
    void qc.invalidateQueries({ queryKey: ['automation'] });
    return;
  }

  if (t.startsWith('calls:')) {
    void qc.invalidateQueries({ queryKey: ['calls'] });
    return;
  }
}

// ============================================================
// Текст toast'а
// ============================================================

/**
 * Намеренно НЕ используем поля вроде `name`, `body`, `title` из payload —
 * потому что события от realtimeExtension их не содержат (там только
 * count / ids / bulk). Хочешь в toast название вуза — эмити его из
 * сервиса (пример — UniversitiesService.update()), и тогда добавь
 * сюда отдельный case.
 */
function messageFor(evt: RealtimeEvent): string | null {
  const actor = (evt.actor ?? '').split('@')[0] || 'коллега';
  const p = evt.payload ?? {};
  const count = typeof p.count === 'number' ? p.count : 1;

  switch (evt.type) {
    // ── Rich-события из сервисов (payload заполнен вручную)
    case 'universities:transferred':
      return `🔁 ${actor} передал вуз другому менеджеру`;

    case 'workflows:transition':
      return `🔄 ${actor}: статус → «${String(p.toStatus ?? '')}»`;

    case 'comments:created':
      return `💬 ${actor} прокомментировал: «${String(p.body ?? '').slice(0, 60)}»`;

    // ── Generic-события от realtimeExtension
    case 'universities:created':
      return `➕ ${actor} создал вуз`;
    case 'universities:updated':
      return count > 1
        ? `✏️ ${actor} изменил ${count} вузов`
        : `✏️ ${actor} обновил вуз`;
    case 'universities:deleted':
      return count > 1
        ? `🗑️ ${actor} удалил ${count} вузов`
        : `🗑️ ${actor} удалил вуз`;

    case 'tasks:created':
      return `📋 ${actor} создал задачу`;
    case 'tasks:updated':
      return count > 1
        ? `📋 ${actor} изменил ${count} задач`
        : `📋 ${actor} обновил задачу`;
    case 'tasks:deleted':
      return `🗑️ ${actor} удалил задачу`;

    case 'interactions:created':
      return `📞 ${actor} создал взаимодействие`;
    case 'interactions:updated':
      return `📞 ${actor} обновил взаимодействие`;

    case 'contracts:created':
      return `📄 ${actor} создал договор`;
    case 'contracts:updated':
      return `📄 ${actor} обновил договор`;

    // ── Личные уведомления — toast не нужен
    case 'notifications:new':
    case 'notifications:created':
      return null;

    default:
      return null;
  }
}