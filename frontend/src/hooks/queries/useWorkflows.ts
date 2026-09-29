import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { queryKeys } from '@/lib/queryClient';
import type { Workflow, WorkflowStep } from '@/types';

export function useWorkflows() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.workflows.all,
    queryFn: () => api.get<Workflow[]>('/workflows'),
    staleTime: 60_000,
  });
}

export function useWorkflowSteps() {
  const api = useApi();
  return useQuery({
    // Вынес в queryKeys, чтобы инвалидация работала из Shell
    queryKey: ['workflow-steps'] as const,
    queryFn: () => api.get<WorkflowStep[]>('/workflow-steps'),
    staleTime: 60_000,
  });
}

export function useWorkflowForUniversity(
  universityId: string | null | undefined,
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.workflows.forUniversity(universityId ?? ''),
    queryFn: () =>
      api.get<{
        workflow: Workflow;
        currentStepId: string | null;
        status: string;
      }>(`/workflows/universities/${universityId}`),
    enabled: !!universityId,
    staleTime: 30_000,
  });
}