import { vi } from 'vitest';

vi.mock('react-oidc-context', () => ({
  useAuth: () => ({
    user: {
      access_token: 'test-token',
      profile: { sub: 'test-sub', email: 'test@rt.ru' },
      expired: false,
    },
    isLoading: false,
    error: null,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
    signinSilent: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));