import { api } from './api';

/**
 * Web Push — подписка, тестовые уведомления.
 *
 * Принцип:
 * 1. Service Worker регистрируется при загрузке страницы
 * 2. Пользователь нажимает «Включить» → браузер запрашивает разрешение
 * 3. При согласии создаётся PushSubscription через VAPID-ключ
 * 4. Подписка сохраняется на backend
 * 5. Backend отправляет push через web-push при напоминаниях
 */

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Конвертация base64-строки VAPID в Uint8Array.
 * Требуется для pushManager.subscribe.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Регистрация Service Worker. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Санитайзер URL для push. Только относительные пути нашего origin.
 */
function sanitizeNotificationUrl(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/')) return '/';
  // Отсекаем попытки open-redirect через //evil.com
  if (raw.startsWith('//')) return '/';
  return raw;
}


/**
 * Подписаться на push.
 * userId не используется — backend определяет пользователя из токена.
 * Параметр оставлен для совместимости, помечен опциональным.
 */
export async function subscribeToPush(
  _userId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Браузер не поддерживает push' };
  if (!VAPID_PUBLIC) return { ok: false, error: 'VAPID_PUBLIC_KEY не задан' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: 'Разрешение не выдано' };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, error: 'Не удалось зарегистрировать SW' };

  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    }));

  const json = sub.toJSON();
  const payload = {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    userAgent: navigator.userAgent,
  };

  try {
    await api.post('/push/subscribe', payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

/** Отписаться. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
    } catch {
      /* ignore */
    }
    await sub.unsubscribe();
  }
}

/** Есть ли активная подписка. */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/** Локальное уведомление (когда вкладка открыта). */
export async function showLocalNotification(
  title: string,
  body: string,
  url = '/',
): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({
    type: 'SHOW_NOTIFICATION',
    title,
    body,
    url: sanitizeNotificationUrl(url),
    tag: `crm-${Date.now()}`,
  });
}

/** Отправить тестовое уведомление. */
export async function sendTestNotification(): Promise<void> {
  await showLocalNotification(
    'ИТ Школа РТК',
    'Push-уведомления работают! Скоро придёт напоминание о событии.',
    '/',
  );
}