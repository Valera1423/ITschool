// frontend/src/lib/sms.ts
import { api } from './api';

export interface SmsSubscription {
  id: string;
  user_id: string;
  phone: string;
  event_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const SMS_EVENTS = [
  { value: 'task_overdue', label: 'Просроченные задачи' },
  { value: 'interaction_reminder', label: 'Напоминание о встрече' },
  { value: 'license_expiring', label: 'Истекает лицензия' },
  { value: 'university_assigned', label: 'Назначен новый вуз' },
] as const;

export async function listSms(): Promise<SmsSubscription[]> {
  try {
    return await api.get<SmsSubscription[]>('/sms');
  } catch {
    return [];
  }
}

export async function upsertSms(input: {
  phone: string;
  event_types: string[];
  enabled: boolean;
}): Promise<string | null> {
  try {
    await api.post('/sms', input);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка сохранения';
  }
}

export async function deleteSms(id: string): Promise<string | null> {
  try {
    await api.delete(`/sms/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка удаления';
  }
}