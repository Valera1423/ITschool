import { api } from './api';

/**
 * Проверка здоровья backend.
 * Используется индикатором «online» в топбаре.
 */

export interface HealthStatus {
  ok: boolean;
  service: string;
  version: string;
  env: string;
  uptime: number;
}

export async function checkHealth(): Promise<HealthStatus | null> {
  try {
    // Запрос напрямую к /health, а не через /api/v1
    const API_URL = import.meta.env.VITE_API_URL.replace('/api/v1', '');
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return null;
    return await res.json() as HealthStatus;
  } catch {
    return null;
  }
}

/**
 * Периодическая проверка связи с backend.
 * Возвращает функцию для остановки.
 */
export function startHealthCheck(
  onStatusChange: (online: boolean) => void,
  intervalMs = 30_000,
): () => void {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const result = await checkHealth();
    onStatusChange(!!result?.ok);
  };

  void tick();
  const timer = window.setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}