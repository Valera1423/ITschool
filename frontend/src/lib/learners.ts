// frontend/src/lib/learners.ts
import { api } from './api';
import type { Learner } from '@/types';

export interface LearnerImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
}

export async function listLearners(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
  } = {},
): Promise<Learner[]> {
  try {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params.search) sp.set('search', params.search);
    return await api.get<Learner[]>(`/learners?${sp.toString()}`);
  } catch {
    return [];
  }
}

export async function getLearner(id: string): Promise<Learner | null> {
  try {
    return await api.get<Learner>(`/learners/${id}`);
  } catch {
    return null;
  }
}

export async function importLearners(
  rows: Record<string, unknown>[],
  mode: 'upsert' | 'create-only' = 'upsert',
): Promise<LearnerImportResult> {
  try {
    return await api.post<LearnerImportResult>('/learners/import', {
      rows,
      mode,
    });
  } catch (e) {
    return {
      inserted: 0,
      updated: 0,
      failed: rows.length,
      errors: [
        { rowIndex: -1, message: e instanceof Error ? e.message : 'Ошибка' },
      ],
    };
  }
}

export async function deleteLearner(id: string): Promise<string | null> {
  try {
    await api.delete(`/learners/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}