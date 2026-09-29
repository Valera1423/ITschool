// frontend/src/lib/onboarding.ts
import { api } from './api';
import type { OnboardingStep, UserPreferences } from '@/types';

/**
 * Onboarding: шаги тура и пользовательские настройки.
 *
 * Backend хранит:
 * - шаги в onboarding_steps
 * - прогресс в onboarding_progress
 * - настройки в user_preferences
 *
 * Все эндпоинты защищены auth и определяют пользователя из токена —
 * userId в query передавать НЕ нужно (раньше передавали как мёртвый параметр).
 */

export async function listSteps(): Promise<OnboardingStep[]> {
  try {
    const items = await api.get<OnboardingStep[]>('/onboarding/steps');
    // Отсеиваем некорректные записи
    return items
      .filter((s) => typeof s?.step_key === 'string' && s.step_key.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  } catch {
    return [];
  }
}

/**
 * Прогресс текущего пользователя.
 * Backend определяет userId из токена — передавать явно не нужно.
 */
export async function getCompletedSteps(): Promise<string[]> {
  try {
    const list = await api.get<Array<{ step_key: string }>>(
      '/onboarding/progress',
    );
    return list.map((r) => r.step_key);
  } catch {
    return [];
  }
}

export async function completeStep(_userId: string, stepKey: string): Promise<void> {
  // userId оставлен в сигнатуре для совместимости с существующими вызовами,
  // но backend определяет его из токена.
  try {
    await api.post('/onboarding/progress', { stepKey });
  } catch {
    // Прогресс не критичен — не мешаем туру
  }
}

/**
 * Пользовательские настройки.
 * Если записи нет — backend создаст её с дефолтными значениями.
 *
 * ВАЖНО: userId в query НЕ передаём — backend читает его из токена,
 * а лишний параметр может валидироваться в Zod-схеме.
 */
export async function getPreferences(
  _userId?: string,
): Promise<UserPreferences | null> {
  try {
    return await api.get<UserPreferences>('/user-preferences/me');
  } catch {
    return null;
  }
}

export async function updatePreferences(
  _userId: string,
  patch: Partial<UserPreferences>,
): Promise<string | null> {
  // userId оставлен в сигнатуре для обратной совместимости.
  try {
    await api.patch('/user-preferences/me', patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Не удалось сохранить настройки';
  }
}