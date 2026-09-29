import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { queryKeys } from '@/lib/queryClient';

interface Summary {
  universities: number;
  open_tasks: number;
  interactions: number;
  contracts: number;
  revenue: number;
}

export function useDashboardSummary() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reports.summary,
    queryFn: () => api.get<Summary>('/reports/dashboard-summary'),
    staleTime: 60_000,
  });
}