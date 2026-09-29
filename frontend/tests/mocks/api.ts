import { vi } from 'vitest';

/**
 * Мок ApiClient.
 *
 * ВАЖНО: НЕ содержит vi.mock('@/lib/api').
 *
 * Раньше здесь был vi.mock, но это не работает: vi.mock хойстится
 * только в тот файл, где он объявлен. Чтобы мок применился в тесте,
 * нужно вызвать vi.mock('@/lib/api', ...) внутри самого тестового файла:
 *
 *   import { mockApi } from '../mocks/api';
 *   vi.mock('@/lib/api', () => ({ api: mockApi }));
 */
export const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getPaginated: vi.fn(),
  upload: vi.fn(),
};