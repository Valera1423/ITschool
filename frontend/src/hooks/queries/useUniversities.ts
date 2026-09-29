import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { queryKeys } from '@/lib/queryClient';
import type { University } from '@/types';

interface Filters {
  search?: string;
  status?: string;
  tagId?: string;
  managerId?: string;
  directionId?: string;
  productId?: string;
  handoverStatus?: string;
}

export function useUniversities(filters: Filters = {}) {
  const api = useApi();

  return useQuery({
    queryKey: queryKeys.universities.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      });
      params.set('pageSize', '100');
      return api.get<University[]>(`/universities?${params.toString()}`);
    },
    staleTime: 30_000,
  });
}

export function useUniversity(id: string | null | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.universities.detail(id ?? ''),
    queryFn: () => api.get<University>(`/universities/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useUpdateUniversity() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<University> }) =>
      api.patch<University>(`/universities/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.universities.detail(updated.id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.universities.all });
    },
  });
}

export function useDeleteUniversity() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/universities/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.universities.all });
    },
  });
}

export function useBulkUniversityAction() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      ids: string[];
      action:
        | 'update_status'
        | 'assign_manager'
        | 'add_tag'
        | 'remove_tag'
        | 'soft_delete';
      status?: string;
      managerId?: string;
      tagId?: string;
    }) => api.post<{ affected: number }>('/universities/bulk', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.universities.all });
    },
  });
}