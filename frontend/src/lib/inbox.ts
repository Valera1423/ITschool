import type { InboxMessage } from '@/types';
import { api } from './api';

export const CHANNELS = [
  { value: 'email', label: 'Email', color: 'sky' },
  { value: 'telegram', label: 'Telegram', color: 'sky' },
  { value: 'whatsapp', label: 'WhatsApp', color: 'emerald' },
  { value: 'max', label: 'MAX', color: 'violet' },
  { value: 'sms', label: 'SMS', color: 'amber' },
  { value: 'web', label: 'Web', color: 'slate' },
] as const;

export function channelLabel(ch: string): string {
  return CHANNELS.find((c) => c.value === ch)?.label ?? ch;
}

export function channelColor(ch: string): string {
  return CHANNELS.find((c) => c.value === ch)?.color ?? 'slate';
}

export async function fetchInbox(filter: {
  onlyUnread?: boolean;
  channel?: string;
  search?: string;
  limit?: number;
}): Promise<InboxMessage[]> {
  try {
    const params = new URLSearchParams();
    if (filter.onlyUnread) params.set('onlyUnread', 'true');
    if (filter.channel && filter.channel !== 'all') params.set('channel', filter.channel);
    if (filter.search) params.set('search', filter.search);
    params.set('limit', String(filter.limit ?? 100));

    const res = await api.get<InboxMessage[] | { items: InboxMessage[] }>(
      `/inbox?${params.toString()}`,
    );
    if (Array.isArray(res)) return res;
    return (res as { items: InboxMessage[] }).items ?? [];
  } catch {
    return [];
  }
}

export async function markRead(id: string, read = true): Promise<void> {
  try {
    await api.patch(`/inbox/${id}`, { read });
  } catch {
    /* ignore */
  }
}

export async function markAllRead(): Promise<void> {
  try {
    await api.post('/inbox/mark-all-read');
  } catch {
    /* ignore */
  }
}

export async function archiveMessage(id: string): Promise<void> {
  try {
    await api.patch(`/inbox/${id}`, { archived: true });
  } catch {
    /* ignore */
  }
}

export async function deleteMessage(id: string): Promise<void> {
  try {
    await api.delete(`/inbox/${id}`);
  } catch {
    /* ignore */
  }
}

export async function replyToMessage(
  msg: InboxMessage,
  body: string,
): Promise<{ error?: string }> {
  try {
    await api.post(`/inbox/${msg.id}/reply`, { body });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Ошибка отправки' };
  }
}

export async function sendMessage(input: {
  integrationId: string;
  to: string;
  toName?: string;
  subject?: string;
  body: string;
  universityId?: string;
}): Promise<{ error?: string }> {
  try {
    await api.post('/inbox/send', input);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Ошибка отправки' };
  }
}