// frontend/src/lib/workflow.ts
import type {
  WorkflowTransition,
  WorkflowStatusCatalog,
  WorkflowStep,
  WorkflowTemplateInfo,
  WorkflowTransitionRule,
} from '@/types';
import { api } from './api';

/**
 * Работа с workflow: переходы между статусами, каталог статусов.
 *
 * Использует backend API. Триггер на смену статуса шага и журналирование
 * переходов — на стороне БД (см. SQL-миграции).
 */

// ============================================================
// КАТАЛОГ СТАТУСОВ
// ============================================================

export async function listStatusCatalog(): Promise<WorkflowStatusCatalog[]> {
  try {
    return await api.get<WorkflowStatusCatalog[]>('/catalogs/statuses');
  } catch {
    return [];
  }
}

export async function upsertStatusCatalog(input: {
  id?: string;
  code: string;
  label: string;
  color?: string;
  sort_order?: number;
  is_final?: boolean;
}): Promise<string | null> {
  try {
    const payload = {
      code: input.code,
      label: input.label,
      color: input.color ?? 'slate',
      sortOrder: input.sort_order ?? 100,
      isFinal: input.is_final ?? false,
    };

    if (input.id) {
      await api.patch(`/catalogs/statuses/${input.id}`, payload);
    } else {
      await api.post('/catalogs/statuses', payload);
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка сохранения';
  }
}

export async function deleteStatusCatalog(id: string): Promise<string | null> {
  try {
    await api.delete(`/catalogs/statuses/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка удаления';
  }
}

// ============================================================
// ПЕРЕХОДЫ
// ============================================================

/**
 * Получить переходы по вузу.
 *
 * ВАЖНО: stepId фильтруется НА БЭКЕ (query-параметр), а не на клиенте —
 * иначе при большом количестве переходов тянем всё лишнее.
 */
export async function listTransitions(
  universityId: string,
  stepId?: string,
): Promise<WorkflowTransition[]> {
  try {
    const params = new URLSearchParams();
    if (stepId) params.set('stepId', stepId);
    const qs = params.toString();

    return await api.get<WorkflowTransition[]>(
      `/workflows/transitions/${universityId}${qs ? `?${qs}` : ''}`,
    );
  } catch {
    return [];
  }
}

/**
 * Создать переход между статусами.
 * Требует обязательный комментарий (по ТЗ п.2).
 */
export async function addTransition(input: {
  stepId: string;
  universityId: string;
  fromStatus: string | null;
  toStatus: string;
  comment: string;
  /**
   * Идентификаторы документов, уже загруженных через StorageClient.
   * Сервер сам резолвит name / url / size — клиент не может
   * подсунуть произвольный URL.
   */
  attachmentDocumentIds?: string[];
  actorName: string;
}): Promise<string | null> {
  try {
    await api.post('/workflows/transitions', {
      stepId: input.stepId,
      universityId: input.universityId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      comment: input.comment,
      attachmentDocumentIds: input.attachmentDocumentIds ?? [],
      actorName: input.actorName,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка создания перехода';
  }
}

// ============================================================
// ВИЗУАЛИЗАЦИЯ
// ============================================================

/** Получить русскую метку статуса шага. */
export function stepStatusLabel(
  step: Pick<WorkflowStep, 'status' | 'status_code'>,
  catalog: WorkflowStatusCatalog[],
): string {
  if (step.status_code) {
    const c = catalog.find((x) => x.code === step.status_code);
    if (c) return c.label;
  }
  return step.status;
}

/** Получить цвет статуса шага. */
export function stepStatusColor(
  step: Pick<WorkflowStep, 'status' | 'status_code'>,
  catalog: WorkflowStatusCatalog[],
): string {
  if (step.status_code) {
    const c = catalog.find((x) => x.code === step.status_code);
    if (c) return c.color;
  }
  return 'slate';
}

/**
 * Прогресс workflow: сколько шагов готово.
 */
export function workflowProgress(
  steps: WorkflowStep[],
  catalog: WorkflowStatusCatalog[],
): { completed: number; total: number; percent: number } {
  const total = steps.length || 1;
  const completed = steps.filter((s) => {
    const label = stepStatusLabel(s, catalog);
    return label === 'Готово' || s.status_code === 'done';
  }).length;

  return {
    completed,
    total: steps.length,
    percent: Math.round((completed / total) * 100),
  };
}

// ============================================================
// ШАБЛОНЫ
// ============================================================

export async function listWorkflowTemplates(): Promise<WorkflowTemplateInfo[]> {
  try {
    return await api.get<WorkflowTemplateInfo[]>('/workflows/templates');
  } catch {
    return [];
  }
}

export async function createWorkflowFromTemplate(input: {
  templateKey: string;
  name?: string;
  makeDefault?: boolean;
}): Promise<string | null> {
  try {
    await api.post('/workflows/from-template', {
      templateKey: input.templateKey,
      name: input.name,
      makeDefault: input.makeDefault ?? false,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка создания из шаблона';
  }
}

// ============================================================
// ГРАФ ПЕРЕХОДОВ
// ============================================================

export async function listTransitionRules(
  workflowId: string,
): Promise<WorkflowTransitionRule[]> {
  try {
    return await api.get<WorkflowTransitionRule[]>(
      `/workflows/${workflowId}/transition-rules`,
    );
  } catch {
    return [];
  }
}

export async function addTransitionRule(input: {
  workflowId: string;
  fromStepId: string;
  toStepId: string;
  condition?: Record<string, unknown>;
  requiresComment?: boolean;
}): Promise<string | null> {
  try {
    await api.post(`/workflows/${input.workflowId}/transition-rules`, {
      fromStepId: input.fromStepId,
      toStepId: input.toStepId,
      condition: input.condition ?? {},
      requiresComment: input.requiresComment ?? true,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка добавления правила';
  }
}

export async function deleteTransitionRule(
  workflowId: string,
  ruleId: string,
): Promise<string | null> {
  try {
    await api.delete(`/workflows/${workflowId}/transition-rules/${ruleId}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка удаления правила';
  }
}