import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedView } from '@/types';
import { useApi } from '@/hooks/useApi';

const KEYS = {
  all: (entity: string) => ['saved-views', entity] as const,
};

/**
 * Сохранённые виды (фильтры) с кэшем React Query.
 */
export function useSavedViews(
  userId: string | null | undefined,
  entity = 'universities',
) {
  const api = useApi();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEYS.all(entity),
    queryFn: async (): Promise<SavedView[]> => {
      try {
        const res = await api.get<SavedView[] | { items: SavedView[] }>(
          `/saved-views?entity=${entity}`,
        );
        if (Array.isArray(res)) return res;
        return (res as { items: SavedView[] }).items ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      entity: string;
      filters: Record<string, unknown>;
      sort?: Record<string, unknown>;
      color?: string;
      icon?: string;
      shared?: boolean;
      pinned?: boolean;
    }) => api.post<SavedView>('/saved-views', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.all(entity) });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SavedView> }) =>
      api.patch(`/saved-views/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.all(entity) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/saved-views/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.all(entity) });
    },
  });

  return {
    views: query.data ?? [],
    loading: query.isLoading,
    reload: () =>
      qc.invalidateQueries({ queryKey: KEYS.all(entity) }).then(() => undefined),
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
  };
}