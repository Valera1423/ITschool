// frontend/src/lib/queryClient.ts
import { MutationCache, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (typeof error === 'object' && error !== null && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      retryOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      // eslint-disable-next-line no-console
      console.error('[mutation]', error);
    },
  }),
});

export const queryKeys = {
  me: ['me'] as const,

  universities: {
    all: ['universities'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['universities', 'list', filters] as const,
    detail: (id: string) => ['universities', 'detail', id] as const,
    contacts: (id: string) => ['universities', id, 'contacts'] as const,
    comments: (id: string) => ['universities', id, 'comments'] as const,
    documents: (id: string) => ['universities', id, 'documents'] as const,
  },

  interactions: {
    all: ['interactions'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['interactions', 'list', filters] as const,
    detail: (id: string) => ['interactions', 'detail', id] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },

  contracts: {
    all: ['contracts'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['contracts', 'list', filters] as const,
    detail: (id: string) => ['contracts', 'detail', id] as const,
  },

  workflows: {
    all: ['workflows'] as const,
    detail: (id: string) => ['workflows', 'detail', id] as const,
    steps: ['workflow-steps'] as const,
    forUniversity: (universityId: string) =>
      ['workflows', 'university', universityId] as const,
    transitions: (universityId: string) =>
      ['workflows', 'transitions', universityId] as const,
  },

  catalogs: {
    all: ['catalogs'] as const,
    vendors: ['catalogs', 'vendors'] as const,
    directions: ['catalogs', 'directions'] as const,
    products: ['catalogs', 'products'] as const,
    managers: (activeOnly?: boolean) =>
      ['catalogs', 'managers', activeOnly] as const,
    statuses: ['catalogs', 'statuses'] as const,
  },

  reports: {
    all: ['reports'] as const,
    summary: ['reports', 'dashboard-summary'] as const,
    interactions: (filters?: Record<string, unknown>) =>
      ['reports', 'interactions', filters ?? {}] as const,
  },

  analytics: {
    all: ['analytics'] as const,
    abcXyz: (from?: string, to?: string) =>
      ['analytics', 'abc-xyz', { from, to }] as const,
    rfm: ['analytics', 'rfm'] as const,
    ltv: ['analytics', 'ltv'] as const,
    cohorts: (monthsBack: number) =>
      ['analytics', 'cohorts', monthsBack] as const,
    metrics: (from?: string, to?: string) =>
      ['analytics', 'metrics', from, to] as const,
    comparison: (p: Record<string, string>) =>
      ['analytics', 'comparison', p] as const,
  },

  dashboards: {
    all: ['dashboards'] as const,
    list: (userId: string) => ['dashboards', 'list', userId] as const,
  },

  knowledge: ['knowledge'] as const,
  notifications: ['notifications'] as const,
  inbox: ['inbox'] as const,
  calls: ['calls'] as const,
  integrations: ['integrations'] as const,
  automation: ['automation'] as const,
  profiles: ['profiles'] as const,
  audit: ['audit'] as const,
  segments: ['segments'] as const,
  tags: ['tags'] as const,
  customFields: ['custom-fields'] as const,
  orders: ['orders'] as const,
  learners: ['learners'] as const,
  courses: ['courses'] as const,
} as const;