// frontend/src/lib/activity.ts
import { api } from './api';

export interface ActivityItem {
  entity: string;
  entityId: string | null;
  action: 'view' | 'create' | 'update' | 'delete';
  label?: string;
  ts: number;
}

export async function fetchRecentActivity(limit = 10): Promise<ActivityItem[]> {
  try {
    return await api.get<ActivityItem[]>(`/users/me/activity?limit=${limit}`);
  } catch {
    return [];
  }
}

export async function clearActivity(): Promise<void> {
  try {
    await api.delete('/users/me/activity');
  } catch { /* ignore */ }
}

export const ENTITY_ROUTES: Record<string, string> = {
  universities: 'universities',
  tasks: 'tasks',
  interactions: 'interactions',
  contracts: 'contracts',
  workflows: 'workflows',
};

export const ACTION_LABELS: Record<ActivityItem['action'], string> = {
  view: 'открыл',
  create: 'создал',
  update: 'изменил',
  delete: 'удалил',
};