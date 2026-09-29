import { api } from './api';

export interface SmartHint {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

export async function fetchSmartHints(limit = 20): Promise<SmartHint[]> {
  try {
    const res = await api.get<SmartHint[]>(`/notifications?type=smart_hint&limit=${limit}`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function runSmartHints(): Promise<{ created: number }> {
  try {
    return await api.post<{ created: number }>('/smart-hints/run');
  } catch {
    return { created: 0 };
  }
}