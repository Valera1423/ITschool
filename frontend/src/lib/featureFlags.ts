import { api } from './api';

export interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rollout: number | null;
  config: Record<string, unknown>;
  allowed_roles: string[];
}

export interface FlagValue {
  enabled: boolean;
  config: unknown;
}

// ============================================================
// Реактивный кэш
// ============================================================

const cache: Record<string, FlagValue> = {};
let loadPromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn());
}

/**
 * Загрузить флаги (один раз). Повторные вызовы ждут тот же промис.
 * Кэш шарится между вызовами внутри одной сессии пользователя.
 */
export async function loadFlags(): Promise<Record<string, FlagValue>> {
  if (Object.keys(cache).length > 0) return cache;

  if (loadPromise) {
    await loadPromise;
    return cache;
  }

  loadPromise = api
    .get<Record<string, FlagValue>>('/feature-flags/me')
    .then((data) => {
      Object.assign(cache, data);
      notifySubscribers();
    })
    .catch(() => {
      // Не падаем — приложение работает без флагов
    })
    .finally(() => {
      loadPromise = null;
    });

  await loadPromise;
  return cache;
}

/** Полная инвалидация кэша. Вызывать при logout. */
export function clearFeatureFlagsCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  loadPromise = null;
  notifySubscribers();
}

/** Алиас для обратной совместимости. */
export function invalidateFeatureFlags(): void {
  clearFeatureFlagsCache();
}

// ============================================================
// CRUD для страницы FeatureFlagsPage
// ============================================================

export async function listAllFlags(): Promise<FeatureFlag[]> {
  try {
    return await api.get<FeatureFlag[]>('/feature-flags');
  } catch {
    return [];
  }
}

export async function updateFlag(
  key: string,
  patch: Partial<FeatureFlag>,
): Promise<string | null> {
  try {
    await api.patch(`/feature-flags/${key}`, patch);
    invalidateFeatureFlags();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// Публичный API для компонентов
// ============================================================

/** Подписка на изменения кэша — используется useFlag. */
export function subscribeToFlags(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Синхронное чтение — не реактивно, использовать с осторожностью. */
export function getCachedFlag(key: string): boolean {
  return cache[key]?.enabled ?? false;
}