// ============================================================
// CRM Service Worker
// ============================================================

const CACHE_VERSION = 'v5';
const STATIC_CACHE = `crm-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `crm-runtime-${CACHE_VERSION}`;
const API_CACHE = `crm-api-${CACHE_VERSION}`;
const POST_QUEUE_CACHE = 'crm-post-queue'; // без версии — очередь не сбрасываем при апдейте

const ALL_CACHES = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE];

const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  OFFLINE_URL,
];

// Публичные GET-API, которые МОЖНО кешировать (не ПД).
// После logout кеш инвалидируется через CLEAR_API_CACHE.
const CACHEABLE_API = [
  '/api/v1/catalogs/',
  '/api/v1/knowledge/',
  '/api/v1/feature-flags/',
];

const ALLOWED_PUSH_ORIGIN = self.location.origin;

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // allSettled — не падаем, если один URL не отдался (например,
      // /offline.html ещё не задеплоен на момент первого запуска SW).
      await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
    }),
  );
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // POST_QUEUE_CACHE не удаляем — очередь отправляется
            // при следующем online, даже после апдейта SW.
            .filter((k) => !ALL_CACHES.includes(k) && k !== POST_QUEUE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Навигации (HTML-страницы) — network-first с фолбэком
  //    на offline.html при офлайне. `mode === 'navigate'` — самый
  //    надёжный признак полноценного перехода (в т.ч. при F5),
  //    в отличие от `destination === 'document'`, который иногда
  //    срабатывает и для iframe'ов.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  // 2. Остальные запросы — только GET.
  if (request.method !== 'GET') return;

  // Чужие origin не трогаем
  if (url.origin !== self.location.origin) return;

  // Keycloak-пути не кешируем
  if (
    url.pathname.includes('/realms/') ||
    url.pathname.includes('/protocol/') ||
    url.pathname.includes('/resources/')
  ) {
    return;
  }

  // API
  if (url.pathname.startsWith('/api/')) {
    const cacheable = CACHEABLE_API.some((p) => url.pathname.startsWith(p));
    if (cacheable) {
      event.respondWith(networkFirst(request, API_CACHE));
    } else {
      event.respondWith(
        fetch(request).catch(
          () =>
            new Response(
              JSON.stringify({
                ok: false,
                code: 'NETWORK_ERROR',
                message: 'Нет соединения',
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
        ),
      );
    }
    return;
  }

  // Статика — cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});

// ============================================================
// Стратегии
// ============================================================

/**
 * Навигация: network-first. Если сети нет и страницы нет в кеше —
 * отдаём offline.html (precache’нут на install), чтобы пользователь
 * видел осмысленный экран вместо браузерной «нет соединения».
 *
 * Если и offline.html отсутствует (SW только что установился и
 * install не успел завершиться) — отдаём минимальную заглушку,
 * чтобы не падать с ошибкой.
 */
async function handleNavigate(request) {
  try {
    const res = await fetch(request);
    // Успешный HTML кешируем в STATIC_CACHE — пригодится при офлайне
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, res.clone()).catch(() => {
        /* переполнение — не критично */
      });
    }
    return res;
  } catch {
    // Сначала пытаемся отдать ту же страницу из кеша
    const cached = await caches.match(request);
    if (cached) return cached;

    // Затем — offline.html из precache
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    // И в самом крайнем случае — минимальная HTML-заглушка,
    // чтобы браузер не показывал свою страницу ошибки.
    return new Response(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Нет соединения</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Нет соединения</h1><p>Проверьте интернет и обновите страницу.</p></body></html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }
}

/**
 * Network-first. cache.put оборачиваем в await, чтобы запись
 * завершилась, пока воркер ещё жив (иначе — потеря кеша).
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') {
      // Клонируем и записываем СИНХРОННО в контексте этого промиса
      try {
        await cache.put(request, res.clone());
      } catch {
        /* кеш может быть переполнен — не критично */
      }
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

/**
 * Cache-first.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(cacheName);
      try {
        await cache.put(request, res.clone());
      } catch {
        /* ignore */
      }
    }
    return res;
  } catch {
    throw new Error('offline');
  }
}

// ============================================================
// BACKGROUND SYNC — досылка POST-запросов, отложенных в офлайне
// ============================================================
//
// Как это работает:
//
// 1. Клиент ловит сетевую ошибку при POST и складывает запрос
//    в кеш `crm-post-queue`:
//
//    const cache = await caches.open('crm-post-queue');
//    await cache.put(
//      new Request(url, { method: 'POST', headers }),
//      new Response(body, { headers })
//    );
//    const reg = await navigator.serviceWorker.ready;
//    await reg.sync.register('crm-post-queue');
//
// 2. Когда браузер снова онлайн, он сам будит SW и вызывает
//    `sync` с тем же тегом. Мы перебираем очередь, повторяем
//    запросы, успешные — удаляем.
//
// ВАЖНО: Background Sync API работает в Chrome/Edge и в
// установленных PWA. В Safari/Firefox его нет — там `sync`
// не сработает, но и не сломает SW: просто ничего не вызовется.
// Для таких браузеров клиент должен сам повторить при `online`.

self.addEventListener('sync', (event) => {
  if (event.tag === 'crm-post-queue') {
    event.waitUntil(replayPostQueue());
  }
});

/**
 * Пройтись по очереди отложенных POST-запросов и повторно
 * их отправить.
 *
 * Логика обработки ответа:
 *   - 2xx — успех, удаляем из очереди;
 *   - 4xx — клиентская ошибка (невалидные данные, 401, 403),
 *     повтор не поможет — удаляем, чтобы не копить мусор;
 *   - 5xx — серверная ошибка, оставляем для следующей попытки;
 *   - fetch бросил (offline) — оставляем, попробуем позже.
 */
async function replayPostQueue() {
  const cache = await caches.open(POST_QUEUE_CACHE);
  const requests = await cache.keys();

  for (const req of requests) {
    try {
      const cached = await cache.match(req);
      if (!cached) continue;

      const body = await cached.text();

      // Собираем заголовки из закешированного ответа (мы сохраняли
      // туда и заголовки запроса — см. пример на клиенте).
      const headers = new Headers();
      cached.headers.forEach((value, key) => {
        // Content-Length пересчитается сам, не копируем
        if (key.toLowerCase() !== 'content-length') {
          headers.set(key, value);
        }
      });

      const res = await fetch(req.url, {
        method: req.method || 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Успех или клиентская ошибка → из очереди убираем
        await cache.delete(req);
      }
      // 5xx — оставляем в очереди для следующей попытки
    } catch {
      // Сеть всё ещё недоступна — оставляем, повторим при следующем sync
    }
  }

  // Сообщаем открытым клиентам, что очередь обработана —
  // чтобы UI мог перезапросить данные и показать актуальное состояние.
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({ type: 'POST_QUEUE_REPLAYED' });
  }
}

// ============================================================
// PUSH
// ============================================================
self.addEventListener('push', (event) => {
  let data = { title: 'ИТ Школа РТК', body: '', url: '/', tag: 'crm' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  if (typeof data.url !== 'string' || !data.url.startsWith('/')) {
    data.url = '/';
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    }),
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url ?? '/';
  const url =
    typeof rawUrl === 'string' && rawUrl.startsWith('/') ? rawUrl : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(ALLOWED_PUSH_ORIGIN) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

// ============================================================
// MESSAGE — команды из приложения
// ============================================================
self.addEventListener('message', (event) => {
  const { type, title, body, url, tag } = event.data ?? {};

  if (type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(title ?? 'ИТ Школа', {
      body: body ?? '',
      icon: '/icons/icon-192.png',
      tag: tag ?? `crm-${Date.now()}`,
      data: { url: url ?? '/' },
    });
    return;
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE));
    return;
  }
});