import { useCallback, useEffect, useRef } from 'react';
import { useApi } from './useApi';
import { showLocalNotification } from '@/lib/push';
import type { Interaction, CrmUser } from '@/types';

interface Options {
  enabled: boolean;
  user: CrmUser | null;
}

interface DueReminder {
  id: string;
  title: string;
  start_time: string;
  minutes_before: number;
}

/**
 * Клиентские напоминания.
 *
 * ВАЖНО: не дёргаем /reminders/due каждую минуту — при 10 вкладках
 * это 10 запросов/мин с каждого пользователя. Только:
 *   1) при монтировании
 *   2) при возврате фокуса во вкладку (дебаунс 30 сек)
 *
 * Backend дедуплицирует напоминания через ReminderLog — повторные
 * вызовы не приведут к спаму уведомлений.
 */
export function useReminders({ enabled, user }: Options) {
  const api = useApi();
  const lastRunRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const userRef = useRef(user);

  useEffect(() => {
    enabledRef.current = enabled;
    userRef.current = user;
  });

  const runOnce = useCallback(async () => {
    if (!enabledRef.current || !userRef.current) return;

    // Дебаунс 30 сек
    const now = Date.now();
    if (now - lastRunRef.current < 30_000) return;
    lastRunRef.current = now;

    try {
      const due = await api.get<DueReminder[]>('/reminders/due');
      if (!Array.isArray(due)) return;

      // Параллельно, но не падаем на первой ошибке
      await Promise.allSettled(
        due.map((ev) =>
          showLocalNotification(
            `Через ${ev.minutes_before} мин: ${ev.title}`,
            ev.start_time ? `Начало в ${ev.start_time.slice(0, 5)}` : '',
            '/?view=calendar',
          ),
        ),
      );
    } catch {
      /* ignore */
    }
  }, [api]);

  useEffect(() => {
    if (!enabled || !user) return;

    void runOnce();

    const onFocus = () => void runOnce();
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, user, runOnce]);
}

/**
 * Утилита для UI: ближайшие события.
 * Возвращает только валидные события — с корректной датой и временем.
 */
export function upcomingReminders(
  interactions: Interaction[],
  withinDays = 2,
): Interaction[] {
  const safe = Array.isArray(interactions) ? interactions : [];
  const now = new Date();
  const limit = new Date(now.getTime() + withinDays * 86400000);

  return safe
    .filter((i) => {
      if (i.status === 'Завершено' || i.status === 'Отменено') return false;
      if (!i.start_time) return false;
      const start = new Date(`${i.interaction_date}T${i.start_time}`);
      if (isNaN(start.getTime())) return false;
      return start >= now && start <= limit;
    })
    .sort((a, b) => {
      const aStart = new Date(`${a.interaction_date}T${a.start_time}`);
      const bStart = new Date(`${b.interaction_date}T${b.start_time}`);
      return aStart.getTime() - bStart.getTime();
    });
}