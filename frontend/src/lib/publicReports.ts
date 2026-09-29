import { api } from './api';

export interface PublicReportLink {
  id: string;
  token: string;
  report_type: string;
  params: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_view_at: string | null;
}

export async function createPublicLink(input: {
  report_type: string;
  params: Record<string, unknown>;
  expires_in_days?: number;
  password?: string;
}): Promise<{ url: string; token: string } | null> {
  try {
    return await api.post('/reports/links', {
      reportType: input.report_type,
      params: input.params,
      expiresInDays: input.expires_in_days,
      password: input.password,
    });
  } catch {
    return null;
  }
}

export async function listPublicLinks(): Promise<PublicReportLink[]> {
  try {
    return await api.get<PublicReportLink[]>('/reports/links');
  } catch {
    return [];
  }
}

export async function revokePublicLink(id: string): Promise<string | null> {
  try {
    await api.delete(`/reports/links/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function fetchPublicReport(token: string, password?: string) {
  const url = new URL(`${import.meta.env.VITE_API_URL}/public-reports/${token}`);
  if (password) url.searchParams.set('password', password);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}