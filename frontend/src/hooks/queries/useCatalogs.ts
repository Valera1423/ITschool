import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { queryKeys } from '@/lib/queryClient';
import type {
  Vendor,
  ItDirection,
  ItProduct,
  Manager,
  WorkflowStatusCatalog,
} from '@/types';

/**
 * Каталоги через React Query.
 * Меняются редко — staleTime 5 минут.
 */

export function useVendors() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogs.vendors,
    queryFn: () => api.get<Vendor[]>('/catalogs/vendors'),
    staleTime: 5 * 60_000,
  });
}

export function useDirections() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogs.directions,
    queryFn: () => api.get<ItDirection[]>('/catalogs/directions'),
    staleTime: 5 * 60_000,
  });
}

export function useProducts() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogs.products,
    queryFn: () => api.get<ItProduct[]>('/catalogs/products'),
    staleTime: 5 * 60_000,
  });
}

export function useManagers(activeOnly = false) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogs.managers(activeOnly),
    queryFn: () =>
      api.get<Manager[]>(
        `/catalogs/managers${activeOnly ? '?activeOnly=true' : ''}`,
      ),
    staleTime: 5 * 60_000,
  });
}

export function useWorkflowStatuses() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogs.statuses,
    queryFn: () => api.get<WorkflowStatusCatalog[]>('/catalogs/statuses'),
    staleTime: 5 * 60_000,
  });
}