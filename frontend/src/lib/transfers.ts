import { api } from './api';

export async function transferUniversity(
  universityId: string,
  toManagerId: string,
  comment?: string,
): Promise<string | null> {
  try {
    await api.post(`/universities/${universityId}/transfer`, {
      toManagerId,
      comment,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function transferTask(
  taskId: string,
  toAssignee: string,
  comment?: string,
): Promise<string | null> {
  try {
    await api.post(`/tasks/${taskId}/transfer`, { toAssignee, comment });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}